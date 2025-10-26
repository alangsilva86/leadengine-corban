import { Buffer } from 'node:buffer';
import { downloadContentFromMessage, downloadMediaMessage, type MediaType } from '@whiskeysockets/baileys';
import { fetch } from 'undici';

import { logger } from '../../../config/logger.js';
import {
  buildWhatsAppBrokerUrl,
  createBrokerTimeoutSignal,
  handleWhatsAppBrokerError,
  resolveWhatsAppBrokerConfig,
  WhatsAppBrokerError,
  WhatsAppBrokerNotConfiguredError,
} from '../../../services/whatsapp-broker-client.js';
import { mapErrorForLog } from './logging.js';

export interface InboundMediaDownloadInput {
  brokerId?: string | null;
  instanceId?: string | null;
  tenantId?: string | null;
  mediaKey?: string | null;
  directPath?: string | null;
  messageId?: string | null;
  mediaType?: string | null;
}

export interface InboundMediaDownloadResult {
  buffer: Buffer;
  mimeType?: string | null;
  fileName?: string | null;
  size?: number | null;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const decodeBinaryCandidate = (candidate: unknown): Buffer | null => {
  if (!candidate) {
    return null;
  }
  if (candidate instanceof Buffer) {
    return candidate.length > 0 ? candidate : null;
  }
  if (candidate instanceof Uint8Array) {
    return candidate.byteLength > 0 ? Buffer.from(candidate) : null;
  }
  if (candidate instanceof ArrayBuffer) {
    const view = new Uint8Array(candidate);
    return view.byteLength > 0 ? Buffer.from(view) : null;
  }
  if (Array.isArray(candidate) && candidate.every((entry) => typeof entry === 'number')) {
    return candidate.length > 0 ? Buffer.from(candidate) : null;
  }
  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const buffer = Buffer.from(trimmed, 'base64');
      return buffer.length > 0 ? buffer : null;
    } catch (error) {
      logger.debug('Unable to decode base64 payload from broker media response', { error });
      return null;
    }
  }
  return null;
};

const normalizeJsonMediaPayload = (value: unknown): InboundMediaDownloadResult | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const mediaRecord =
    record.media && typeof record.media === 'object' && !Array.isArray(record.media)
      ? (record.media as Record<string, unknown>)
      : null;

  const buffer =
    decodeBinaryCandidate(record.buffer) ??
    decodeBinaryCandidate(record.data) ??
    decodeBinaryCandidate(record.base64) ??
    decodeBinaryCandidate(record.content) ??
    (mediaRecord
      ? decodeBinaryCandidate(mediaRecord.buffer) ??
        decodeBinaryCandidate(mediaRecord.data) ??
        decodeBinaryCandidate(mediaRecord.base64) ??
        decodeBinaryCandidate(mediaRecord.content)
      : null);

  if (!buffer) {
    return null;
  }

  const readString = (...candidates: unknown[]): string | null => {
    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }
    return null;
  };

  const readNumber = (...candidates: unknown[]): number | null => {
    for (const candidate of candidates) {
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        return candidate;
      }
      if (typeof candidate === 'string') {
        const parsed = Number(candidate);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
    return null;
  };

  const mimeType = readString(
    record.mimeType,
    record.mimetype,
    record.contentType,
    mediaRecord?.mimeType,
    mediaRecord?.mimetype,
    mediaRecord?.contentType
  );
  const fileName = readString(record.fileName, record.filename, record.name, mediaRecord?.fileName, mediaRecord?.filename);
  const size = readNumber(record.size, record.length, mediaRecord?.size, mediaRecord?.length) ?? buffer.length;

  return {
    buffer,
    mimeType: mimeType ?? null,
    fileName: fileName ?? null,
    size,
  };
};

const parseContentDisposition = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const filenameMatch = value.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
  if (!filenameMatch) {
    return null;
  }

  const encoded = filenameMatch[1] ?? filenameMatch[2];
  if (!encoded) {
    return null;
  }

  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
};

const DEFAULT_MEDIA_DOWNLOAD_TIMEOUT_MS = 15_000;
const DEFAULT_WHATSAPP_MEDIA_HOST = 'https://mmg.whatsapp.net';

const DEFAULT_MIME_BY_TYPE: Record<string, string> = {
  IMAGE: 'image/jpeg',
  VIDEO: 'video/mp4',
  AUDIO: 'audio/ogg',
  DOCUMENT: 'application/octet-stream',
  STICKER: 'image/webp',
};

const DEFAULT_MEDIA_TYPE = 'DOCUMENT';

const resolveDefaultMime = (mediaType: string | null): string | null => {
  if (!mediaType) {
    return null;
  }

  const normalized = mediaType.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  return DEFAULT_MIME_BY_TYPE[normalized] ?? null;
};

type BaileysMediaConfig = { messageKey: string; downloadType: MediaType };

const BAILEYS_MEDIA_TYPE_BY_MESSAGE: Record<string, BaileysMediaConfig> = {
  IMAGE: { messageKey: 'imageMessage', downloadType: 'image' },
  VIDEO: { messageKey: 'videoMessage', downloadType: 'video' },
  AUDIO: { messageKey: 'audioMessage', downloadType: 'audio' },
  DOCUMENT: { messageKey: 'documentMessage', downloadType: 'document' },
  STICKER: { messageKey: 'stickerMessage', downloadType: 'sticker' },
};

const DEFAULT_BAILEYS_MEDIA_CONFIG: BaileysMediaConfig = {
  messageKey: 'documentMessage',
  downloadType: 'document',
};

const resolveBaileysMediaType = (mediaType: string | null): BaileysMediaConfig => {
  if (!mediaType) {
    return DEFAULT_BAILEYS_MEDIA_CONFIG;
  }

  const normalized = mediaType.trim().toUpperCase() || DEFAULT_MEDIA_TYPE;
  if (!normalized) {
    return DEFAULT_BAILEYS_MEDIA_CONFIG;
  }

  const candidate = BAILEYS_MEDIA_TYPE_BY_MESSAGE[normalized];
  return candidate ?? DEFAULT_BAILEYS_MEDIA_CONFIG;
};

const buildWhatsAppMediaUrl = (
  directPath: string
): { directPath?: string; url?: string } | null => {
  const trimmed = directPath.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return { url: trimmed };
  }

  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return {
    directPath: normalized,
    url: `${DEFAULT_WHATSAPP_MEDIA_HOST}${normalized}`,
  };
};

const downloadMediaViaMediaKey = async ({
  directPath,
  mediaKey,
  mediaType,
  timeoutMs,
  tenantId,
  instanceId,
  messageId,
}: {
  directPath: string;
  mediaKey: string;
  mediaType: string | null;
  timeoutMs?: number;
  tenantId?: string | null;
  instanceId?: string | null;
  messageId?: string | null;
}): Promise<InboundMediaDownloadResult | null> => {
  const normalizedDirectPath = directPath.trim();
  const normalizedMediaKey = mediaKey.trim();

  if (!normalizedDirectPath || !normalizedMediaKey) {
    return null;
  }

  let mediaKeyBuffer: Buffer;
  try {
    mediaKeyBuffer = Buffer.from(normalizedMediaKey, 'base64');
  } catch (error) {
    logger.debug('WhatsApp Baileys media download: invalid media key base64', {
      error: mapErrorForLog(error),
    });
    return null;
  }

  if (mediaKeyBuffer.length === 0) {
    return null;
  }

  const downloadFields = buildWhatsAppMediaUrl(normalizedDirectPath);
  if (!downloadFields) {
    return null;
  }

  const { messageKey, downloadType } = resolveBaileysMediaType(mediaType);
  const fallbackMime = resolveDefaultMime(mediaType);

  const axiosOptions = {
    timeout: timeoutMs ?? DEFAULT_MEDIA_DOWNLOAD_TIMEOUT_MS,
    headers: {
      Accept: 'application/octet-stream',
      'User-Agent': 'Mozilla/5.0 (LeadEngine WhatsApp)',
      Origin: 'https://web.whatsapp.com',
      Referer: 'https://web.whatsapp.com/',
    },
  };

  const buildLogContext = () => ({
    tenantId: tenantId ?? null,
    instanceId: instanceId ?? null,
    messageId: messageId ?? null,
    directPath: downloadFields.directPath ?? null,
    url: downloadFields.url ?? null,
  });

  const downloadInput: Parameters<typeof downloadContentFromMessage>[0] = {
    mediaKey: mediaKeyBuffer,
    directPath: downloadFields.directPath ?? null,
    url: downloadFields.url ?? null,
  };

  const mediaRecord: Record<string, unknown> = {
    ...downloadInput,
  };

  if (fallbackMime) {
    mediaRecord.mimetype = fallbackMime;
  }

  mediaRecord.mediaKey = mediaKeyBuffer;

  const minimalMessage = {
    key: { remoteJid: 'status@broadcast', id: 'media-download', fromMe: false },
    message: {
      [messageKey]: mediaRecord,
    },
  } as unknown as Parameters<typeof downloadMediaMessage>[0];

  try {
    const buffer = await downloadMediaMessage(minimalMessage, 'buffer', { options: axiosOptions });
    const resolvedBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    if (resolvedBuffer.length > 0) {
      return {
        buffer: resolvedBuffer,
        mimeType: fallbackMime,
        fileName: null,
        size: resolvedBuffer.length,
      };
    }
  } catch (error) {
    logger.debug('WhatsApp Baileys direct media download failed via downloadMediaMessage', {
      error,
      ...buildLogContext(),
    });
  }

  try {
    const stream = await downloadContentFromMessage(downloadInput, downloadType, {
      options: axiosOptions,
    });
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = chunks.length === 1 ? chunks[0]! : Buffer.concat(chunks);

    if (buffer.length > 0) {
      return {
        buffer,
        mimeType: fallbackMime,
        fileName: null,
        size: buffer.length,
      };
    }
  } catch (error) {
    logger.debug('WhatsApp Baileys direct media download failed via downloadContentFromMessage', {
      error,
      ...buildLogContext(),
    });
  }

  return null;
};

export const downloadInboundMediaFromBroker = async (
  input: InboundMediaDownloadInput
): Promise<InboundMediaDownloadResult | null> => {
  const directPath = isNonEmptyString(input.directPath) ? input.directPath!.trim() : null;
  const mediaKey = isNonEmptyString(input.mediaKey) ? input.mediaKey!.trim() : null;
  const normalizedMediaType = isNonEmptyString(input.mediaType) ? input.mediaType!.trim() : null;

  if (directPath && mediaKey) {
    const directDownload = await downloadMediaViaMediaKey({
      directPath,
      mediaKey,
      mediaType: normalizedMediaType,
      tenantId: isNonEmptyString(input.tenantId) ? input.tenantId!.trim() : null,
      instanceId: isNonEmptyString(input.instanceId) ? input.instanceId!.trim() : null,
      messageId: isNonEmptyString(input.messageId) ? input.messageId!.trim() : null,
    });

    if (directDownload) {
      return directDownload;
    }
  }

  const sessionIdCandidate =
    (typeof input.brokerId === 'string' && input.brokerId.trim().length > 0 ? input.brokerId.trim() : null) ||
    (typeof input.instanceId === 'string' && input.instanceId.trim().length > 0 ? input.instanceId.trim() : null);

  if (!sessionIdCandidate) {
    return null;
  }

  if (!directPath && !mediaKey) {
    return null;
  }

  const requestBody: Record<string, unknown> = {};
  if (directPath) {
    requestBody.directPath = directPath;
  }
  if (mediaKey) {
    requestBody.mediaKey = mediaKey;
  }
  if (isNonEmptyString(input.instanceId)) {
    requestBody.instanceId = input.instanceId!.trim();
  }
  if (isNonEmptyString(input.tenantId)) {
    requestBody.tenantId = input.tenantId!.trim();
  }
  if (isNonEmptyString(input.messageId)) {
    requestBody.messageId = input.messageId!.trim();
  }
  if (normalizedMediaType) {
    requestBody.mediaType = normalizedMediaType;
  }

  let config;
  try {
    config = resolveWhatsAppBrokerConfig();
  } catch (error) {
    if (error instanceof WhatsAppBrokerNotConfiguredError) {
      throw error;
    }
    throw new WhatsAppBrokerNotConfiguredError('WhatsApp broker configuration is incomplete');
  }

  const encodedSessionId = encodeURIComponent(sessionIdCandidate);
  const url = buildWhatsAppBrokerUrl(config, `/instances/${encodedSessionId}/media/download`);
  const headers = new Headers();
  headers.set('X-API-Key', config.apiKey);
  headers.set('Accept', 'application/octet-stream, application/json');
  headers.set('Content-Type', 'application/json');

  const { signal, cancel } = createBrokerTimeoutSignal(config.timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal,
    });

    const durationMs = Date.now() - startedAt;
    const requestId = response.headers?.get?.('x-request-id') ?? null;

    if (!response.ok) {
      logger.warn('⚠️ [WhatsApp Broker] Falha ao baixar mídia inbound', {
        sessionId: sessionIdCandidate,
        instanceId: input.instanceId ?? null,
        tenantId: input.tenantId ?? null,
        status: response.status,
        durationMs,
        requestId,
      });
      await handleWhatsAppBrokerError(response);
    }

    const contentType = response.headers?.get?.('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as Record<string, unknown>;
      const normalized = normalizeJsonMediaPayload(payload);
      if (!normalized) {
        throw new WhatsAppBrokerError('WhatsApp broker media payload missing data', {
          code: 'MEDIA_DOWNLOAD_FAILED',
          brokerStatus: response.status,
          requestId: requestId ?? undefined,
        });
      }

      return normalized;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer.length) {
      throw new WhatsAppBrokerError('WhatsApp broker returned empty media payload', {
        code: 'MEDIA_DOWNLOAD_EMPTY',
        brokerStatus: response.status,
        requestId: requestId ?? undefined,
      });
    }

    const mimeTypeHeader = contentType ? contentType.split(';')[0]?.trim() : null;
    const disposition = response.headers?.get?.('content-disposition') ?? null;
    const fileName = parseContentDisposition(disposition);
    const lengthHeader = response.headers?.get?.('content-length');
    const size = lengthHeader ? Number(lengthHeader) : buffer.length;

    return {
      buffer,
      mimeType: mimeTypeHeader && mimeTypeHeader.length > 0 ? mimeTypeHeader : null,
      fileName,
      size: Number.isFinite(size) ? size : buffer.length,
    };
  } catch (error) {
    if (error instanceof WhatsAppBrokerError || error instanceof WhatsAppBrokerNotConfiguredError) {
      throw error;
    }

    throw new WhatsAppBrokerError('Unexpected error downloading inbound WhatsApp media', {
      code: 'MEDIA_DOWNLOAD_FAILED',
      cause: error,
    });
  } finally {
    cancel();
  }
};

export default downloadInboundMediaFromBroker;
