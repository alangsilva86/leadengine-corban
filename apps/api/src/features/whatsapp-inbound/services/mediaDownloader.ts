import { Buffer } from 'node:buffer';

import {
  downloadContentFromMessage,
  downloadMediaMessage,
  type WAMessage,
} from '@whiskeysockets/baileys';

import { logger } from '../../../config/logger';
import { mapErrorForLog } from './logging';
import {
  downloadInboundMediaFromBroker,
  type InboundMediaDownloadInput,
  type InboundMediaDownloadResult,
} from './media-downloader';

type DownloadableMessageKey = 'imageMessage' | 'videoMessage' | 'audioMessage' | 'documentMessage' | 'stickerMessage';

type DownloadContentType = 'image' | 'video' | 'audio' | 'document' | 'sticker';

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asRecord = (value: unknown): Record<string, unknown> | null => (isRecord(value) ? value : null);

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

const consumeStream = async (stream: AsyncIterable<Uint8Array>): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return chunks.length === 1 ? chunks[0]! : Buffer.concat(chunks);
};

const normalizeToBuffer = (value: unknown): Buffer | null => {
  if (!value) {
    return null;
  }

  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
    return Buffer.from(value as Uint8Array);
  }

  if (Array.isArray(value) && value.every((entry) => typeof entry === 'number')) {
    return Buffer.from(value);
  }

  if (typeof value === 'string') {
    try {
      return Buffer.from(value, 'base64');
    } catch {
      return null;
    }
  }

  return null;
};

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

export const downloadViaBaileys = async (
  rawMessage: Record<string, unknown> | null | undefined,
  preferredKey?: DownloadableMessageKey | null
): Promise<InboundMediaDownloadResult | null> => {
  if (!rawMessage || !isRecord(rawMessage)) {
    return null;
  }

  const candidates = collectCandidates(rawMessage, preferredKey);

  if (isRecord(rawMessage.message)) {
    try {
      const buffer = await downloadMediaMessage(rawMessage as unknown as WAMessage, 'buffer');

      const normalizedBuffer = normalizeToBuffer(buffer);
      if (normalizedBuffer && normalizedBuffer.length > 0) {
        return buildResultFromCandidate(normalizedBuffer, candidates[0] ?? null);
      }
    } catch (error) {
      logger.debug('whatsapp-inbound: falha ao usar downloadMediaMessage', {
        error: mapErrorForLog(error),
      });
    }
  }

  for (const candidate of candidates) {
    try {
      const stream = await downloadContentFromMessage(
        candidate.record as unknown as Record<string, unknown>,
        candidate.downloadType
      );
      const buffer = await consumeStream(stream);
      if (buffer.length > 0) {
        return buildResultFromCandidate(buffer, candidate);
      }
    } catch (error) {
      logger.debug('whatsapp-inbound: falha ao usar downloadContentFromMessage', {
        error: mapErrorForLog(error),
        mediaKey: candidate.key,
      });
    }
  }

  return null;
};

export const downloadViaBroker = async (
  input: InboundMediaDownloadInput
): Promise<InboundMediaDownloadResult | null> => downloadInboundMediaFromBroker(input);

export type { InboundMediaDownloadInput, InboundMediaDownloadResult } from './media-downloader';

