import { Buffer } from 'node:buffer';
import { fetch } from 'undici';

import { logger } from '../../../config/logger.js';
import {
  DEFAULT_WHATSAPP_MEDIA_ORIGIN,
  downloadAndDecryptMedia,
  downloadAndDecryptMessageMedia,
  isWhatsAppCryptoError,
  type MediaDownloadOptions,
  type WhatsAppMediaType,
} from '../../../lib/whatsapp-crypto';
import {
  buildWhatsAppBrokerUrl,
  createBrokerTimeoutSignal,
  handleWhatsAppBrokerError,
  resolveWhatsAppBrokerConfig,
  WhatsAppBrokerError,
  WhatsAppBrokerNotConfiguredError,
} from '../../../services/whatsapp-broker-client.js';
import { mapErrorForLog } from './logging.js';
import { asRecord as parseAsRecord, readNumber, readString } from '../utils/webhook-parsers';

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

type DownloadableMessageKey =
  | 'imageMessage'
  | 'videoMessage'
  | 'audioMessage'
  | 'documentMessage'
  | 'stickerMessage';

type DownloadContentType = Extract<WhatsAppMediaType, 'image' | 'video' | 'audio' | 'document' | 'sticker'>;

const MEDIA_KEY_TO_DOWNLOAD_TYPE: Record<DownloadableMessageKey, DownloadContentType> = {
  imageMessage: 'image',
  videoMessage: 'video',
  audioMessage: 'audio',
  documentMessage: 'document',
  stickerMessage: 'sticker',
};

const MEDIA_KEY_PRIORITY: DownloadableMessageKey[] = [
  'imageMessage',
  'videoMessage',
  'audioMessage',
  'documentMessage',
  'stickerMessage',
];

const DEFAULT_MEDIA_DOWNLOAD_TIMEOUT_MS = 15_000;

const CDN_REQUEST_HEADERS: Record<string, string> = {
  Accept: 'application/octet-stream',
  'User-Agent': 'Mozilla/5.0 (LeadEngine WhatsApp)',
  Referer: 'https://web.whatsapp.com/',
};

const parsePositiveInteger = (value: string | undefined): number | undefined => {
  const parsed = value ? Number.parseInt(value.trim(), 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

/**
 * Options for direct downloads from the WhatsApp CDN. `WHATSAPP_MEDIA_MAX_BYTES` overrides the
 * module default (64 MiB); larger media fall back to the broker download.
 */
const buildCdnDownloadOptions = (timeoutMs?: number): MediaDownloadOptions => {
  const options: MediaDownloadOptions = {
    timeoutMs: timeoutMs ?? DEFAULT_MEDIA_DOWNLOAD_TIMEOUT_MS,
    headers: CDN_REQUEST_HEADERS,
  };
  const maxBytes = parsePositiveInteger(process.env.WHATSAPP_MEDIA_MAX_BYTES);
  if (maxBytes) {
    options.maxBytes = maxBytes;
  }
  return options;
};

const describeCdnError = (error: unknown) => ({
  error: mapErrorForLog(error),
  errorCode: isWhatsAppCryptoError(error) ? error.code : null,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  (isRecord(value) ? (value as Record<string, unknown>) : parseAsRecord(value));

interface MediaCandidate {
  key: DownloadableMessageKey;
  record: Record<string, unknown>;
  downloadType: DownloadContentType;
}

const collectCandidates = (
  rawMessage: Record<string, unknown>,
  preferredKey?: DownloadableMessageKey | null
): MediaCandidate[] => {
  const candidates: MediaCandidate[] = [];
  const pushed = new Set<Record<string, unknown>>();
  const keysInPriority = preferredKey
    ? ([preferredKey, ...MEDIA_KEY_PRIORITY.filter((key) => key !== preferredKey)] as DownloadableMessageKey[])
    : MEDIA_KEY_PRIORITY;

  const pushCandidate = (key: DownloadableMessageKey, value: unknown): void => {
    if (!isRecord(value) || pushed.has(value)) {
      return;
    }

    pushed.add(value);
    candidates.push({ key, record: value, downloadType: MEDIA_KEY_TO_DOWNLOAD_TYPE[key] });
  };

  for (const key of keysInPriority) {
    pushCandidate(key, rawMessage[key]);
  }

  const nestedMessage = asRecord(rawMessage.message);
  if (nestedMessage) {
    for (const key of keysInPriority) {
      pushCandidate(key, nestedMessage[key]);
    }
  }

  return candidates;
};

const buildResultFromCandidate = (
  buffer: Buffer,
  candidate: MediaCandidate | null
): InboundMediaDownloadResult => {
  const record = candidate?.record ?? {};
  const mimeType = readString(record.mimeType, record.mimetype, record.contentType);
  const fileName = readString(record.fileName, record.filename, record.name);
  const size = readNumber(record.fileLength, record.fileSize, record.size, record.length) ?? buffer.length;

  return {
    buffer,
    mimeType: mimeType ?? null,
    fileName: fileName ?? null,
    size,
  };
};

/**
 * Downloads and decrypts inbound media straight from the WhatsApp CDN using the media key carried
 * by the raw message (lib/whatsapp-crypto: MAC verified, WhatsApp hosts only, timeout and size limit).
 * Returns `null` when nothing could be downloaded so callers fall back to the broker.
 */
export const downloadViaWhatsAppCdn = async (
  rawMessage: Record<string, unknown> | null | undefined,
  preferredKey?: DownloadableMessageKey | null
): Promise<InboundMediaDownloadResult | null> => {
  if (!rawMessage || !isRecord(rawMessage)) {
    return null;
  }

  const candidates = collectCandidates(rawMessage, preferredKey);
  const options = buildCdnDownloadOptions();

  if (isRecord(rawMessage.message)) {
    try {
      const { buffer } = await downloadAndDecryptMessageMedia(rawMessage, options);
      if (buffer.length > 0) {
        return buildResultFromCandidate(buffer, candidates[0] ?? null);
      }
    } catch (error) {
      logger.debug('whatsapp-inbound: falha ao baixar a mídia da mensagem pelo CDN do WhatsApp', describeCdnError(error));
    }
  }

  for (const candidate of candidates) {
    const { record } = candidate;
    try {
      const buffer = await downloadAndDecryptMedia(
        {
          mediaKey: record.mediaKey ?? record.mediakey,
          directPath: readString(record.directPath) ?? null,
          url: readString(record.url) ?? null,
          fileSha256: record.fileSha256,
          fileEncSha256: record.fileEncSha256,
        },
        candidate.downloadType,
        options
      );
      if (buffer.length > 0) {
        return buildResultFromCandidate(buffer, candidate);
      }
    } catch (error) {
      logger.debug('whatsapp-inbound: falha ao baixar mídia pelo CDN do WhatsApp', {
        ...describeCdnError(error),
        mediaKey: candidate.key,
      });
    }
  }

  return null;
};

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

const CDN_MEDIA_TYPE_BY_MESSAGE: Record<string, DownloadContentType> = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  DOCUMENT: 'document',
  STICKER: 'sticker',
};

const DEFAULT_CDN_MEDIA_TYPE: DownloadContentType = 'document';

/** Maps the normalized message type (IMAGE, VIDEO…) to the media type used to derive the keys. */
const resolveCdnMediaType = (mediaType: string | null): DownloadContentType => {
  if (!mediaType) {
    return DEFAULT_CDN_MEDIA_TYPE;
  }

  const normalized = mediaType.trim().toUpperCase() || DEFAULT_MEDIA_TYPE;
  return CDN_MEDIA_TYPE_BY_MESSAGE[normalized] ?? DEFAULT_CDN_MEDIA_TYPE;
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
    url: `${DEFAULT_WHATSAPP_MEDIA_ORIGIN}${normalized}`,
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

  const downloadFields = buildWhatsAppMediaUrl(normalizedDirectPath);
  if (!downloadFields) {
    return null;
  }

  const downloadType = resolveCdnMediaType(mediaType);
  const fallbackMime = resolveDefaultMime(mediaType);

  try {
    const buffer = await downloadAndDecryptMedia(
      {
        mediaKey: normalizedMediaKey,
        directPath: downloadFields.directPath ?? null,
        url: downloadFields.url ?? null,
      },
      downloadType,
      buildCdnDownloadOptions(timeoutMs)
    );

    if (buffer.length > 0) {
      return {
        buffer,
        mimeType: fallbackMime,
        fileName: null,
        size: buffer.length,
      };
    }
  } catch (error) {
    logger.debug('WhatsApp direct media download failed (CDN)', {
      ...describeCdnError(error),
      tenantId: tenantId ?? null,
      instanceId: instanceId ?? null,
      messageId: messageId ?? null,
      directPath: downloadFields.directPath ?? null,
      url: downloadFields.url ?? null,
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

export const downloadViaBroker = async (
  input: InboundMediaDownloadInput
): Promise<InboundMediaDownloadResult | null> => downloadInboundMediaFromBroker(input);

export default downloadInboundMediaFromBroker;
