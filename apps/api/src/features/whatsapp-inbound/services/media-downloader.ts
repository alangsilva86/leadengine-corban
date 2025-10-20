import { Buffer } from 'node:buffer';
import { fetch } from 'undici';

import { logger } from '../../../config/logger';
import {
  buildWhatsAppBrokerUrl,
  createBrokerTimeoutSignal,
  handleWhatsAppBrokerError,
  resolveWhatsAppBrokerConfig,
  WhatsAppBrokerError,
  WhatsAppBrokerNotConfiguredError,
} from '../../../services/whatsapp-broker-client';

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

export const downloadInboundMediaFromBroker = async (
  input: InboundMediaDownloadInput
): Promise<InboundMediaDownloadResult | null> => {
  const sessionIdCandidate =
    (typeof input.brokerId === 'string' && input.brokerId.trim().length > 0 ? input.brokerId.trim() : null) ||
    (typeof input.instanceId === 'string' && input.instanceId.trim().length > 0 ? input.instanceId.trim() : null);

  if (!sessionIdCandidate) {
    return null;
  }

  const directPath = isNonEmptyString(input.directPath) ? input.directPath : null;
  const mediaKey = isNonEmptyString(input.mediaKey) ? input.mediaKey : null;

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
  if (isNonEmptyString(input.mediaType)) {
    requestBody.mediaType = input.mediaType!.trim();
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
