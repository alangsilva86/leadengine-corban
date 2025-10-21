import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { createSignedGetUrl, uploadObject } from './supabase-storage';

const DEFAULT_SIGNED_URL_TTL_SECONDS = (() => {
  const configured = process.env.WHATSAPP_MEDIA_SIGNED_URL_TTL_SECONDS;
  if (!configured) {
    return 900;
  }

  const parsed = Number.parseInt(configured, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 900;
  }

  return parsed;
})();

const mimeExtensionMap = new Map(
  Object.entries({
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/mpeg': '.mpeg',
    'video/quicktime': '.mov',
    'audio/mpeg': '.mp3',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'application/pdf': '.pdf',
  })
);

const sanitizeSegment = (value: string | null | undefined, fallback: string): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    return fallback;
  }

  const normalized = trimmed
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\-_.]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return normalized || fallback;
};

const resolveExtension = (originalName?: string, mimeType?: string): string => {
  if (originalName) {
    const normalizedName = originalName.trim();
    if (normalizedName.length > 0) {
      const ext = path.extname(normalizedName).toLowerCase().trim();
      if (ext) {
        return ext;
      }
    }
  }

  if (mimeType) {
    const normalized = mimeType.toLowerCase().trim();
    const mapped = mimeExtensionMap.get(normalized);
    if (mapped) {
      return mapped;
    }

    if (normalized.startsWith('image/')) {
      return `.${normalized.split('/')[1] ?? 'img'}`;
    }
    if (normalized.startsWith('video/')) {
      return `.${normalized.split('/')[1] ?? 'mp4'}`;
    }
    if (normalized.startsWith('audio/')) {
      return `.${normalized.split('/')[1] ?? 'audio'}`;
    }
  }

  return '.bin';
};

const resolveSignedUrlTtl = (candidate?: number | null): number => {
  if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
    return Math.floor(candidate);
  }

  return DEFAULT_SIGNED_URL_TTL_SECONDS;
};

const resolveContentDisposition = (originalName?: string): string | undefined => {
  if (!originalName) {
    return undefined;
  }

  const trimmed = originalName.trim();
  if (!trimmed) {
    return undefined;
  }

  const safe = trimmed.replace(/"/g, '');
  const encoded = encodeURIComponent(trimmed);

  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
};

export interface SaveWhatsAppMediaInput {
  buffer: Buffer;
  tenantId?: string | null;
  instanceId?: string | null;
  chatId?: string | null;
  messageId?: string | null;
  originalName?: string;
  mimeType?: string;
  signedUrlTtlSeconds?: number | null;
}

export interface WhatsAppMediaDescriptor {
  mediaUrl: string;
  expiresInSeconds: number;
}

export const saveWhatsAppMedia = async ({
  buffer,
  tenantId,
  instanceId,
  chatId,
  messageId,
  originalName,
  mimeType,
  signedUrlTtlSeconds,
}: SaveWhatsAppMediaInput): Promise<WhatsAppMediaDescriptor> => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Arquivo inválido para upload.');
  }

  const safeTenant = sanitizeSegment(tenantId, 'tenant');
  const safeInstance = sanitizeSegment(instanceId, 'instance');
  const safeChat = sanitizeSegment(chatId, 'chat');
  const fallbackMessageId = sanitizeSegment(messageId, randomUUID());
  const extension = resolveExtension(originalName, mimeType);

  const key = path.posix.join(
    'whatsapp',
    safeTenant,
    safeInstance,
    safeChat,
    `${fallbackMessageId}${extension}`
  );

  const resolvedMime = mimeType && mimeType.trim().length > 0 ? mimeType : 'application/octet-stream';
  const expiresInSeconds = resolveSignedUrlTtl(signedUrlTtlSeconds);

  await uploadObject({
    key,
    body: buffer,
    contentType: resolvedMime,
    contentDisposition: resolveContentDisposition(originalName),
  });

  const mediaUrl = await createSignedGetUrl({
    key,
    expiresInSeconds,
  });

  return {
    mediaUrl,
    expiresInSeconds,
  };
};

export default saveWhatsAppMedia;
