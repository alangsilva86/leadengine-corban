import { NotFoundError } from '@ticketz/core';
import type { Message, PaginatedResult, Pagination } from '../../../types/tickets';
import {
  findTicketById as storageFindTicketById,
  listMessages as storageListMessages,
  updateMessage as storageUpdateMessage,
} from '@ticketz/storage';
import { createSignedGetUrl, readSupabaseS3Config } from '../../supabase-storage';
import { logger } from '../../../config/logger';
import { normalizeMessageMetadata, resolveProviderMessageId } from '../shared/whatsapp';

const DEFAULT_SIGNED_URL_TTL_SECONDS = (() => {
  const configured = process.env.WHATSAPP_MEDIA_SIGNED_URL_TTL_SECONDS;
  if (!configured) return 900;

  const parsed = Number.parseInt(configured, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 900;
})();

const resolveSignedUrlTtl = (candidate?: number | null): number => {
  if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
    return Math.floor(candidate);
  }

  return DEFAULT_SIGNED_URL_TTL_SECONDS;
};

const parseAmzDate = (value: string | null): number | null => {
  if (!value || !/^\d{8}T\d{6}Z$/.test(value)) {
    return null;
  }

  const [year, month, day, hour, minute, second] = [
    value.slice(0, 4),
    value.slice(4, 6),
    value.slice(6, 8),
    value.slice(9, 11),
    value.slice(11, 13),
    value.slice(13, 15),
  ];

  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  const timestamp = Date.parse(iso);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const resolveSignedUrlExpiration = (
  mediaUrl: string,
  mediaMetadata: Record<string, unknown> | null,
  createdAt: Date
): number | null => {
  try {
    const parsed = new URL(mediaUrl);
    const amzExpires = parsed.searchParams.get('X-Amz-Expires');
    const amzDate = parsed.searchParams.get('X-Amz-Date');

    if (amzExpires && amzDate) {
      const expiresInSeconds = Number.parseInt(amzExpires, 10);
      const signedAt = parseAmzDate(amzDate);

      if (Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 && signedAt) {
        return signedAt + expiresInSeconds * 1000;
      }
    }
  } catch (error) {
    logger.debug('tickets.messages.list: failed to parse signed URL params', {
      mediaUrl,
      error,
    });
  }

  const metadataTtlCandidate = mediaMetadata?.['urlExpiresInSeconds'];
  const metadataTtl =
    typeof metadataTtlCandidate === 'number'
      ? metadataTtlCandidate
      : typeof metadataTtlCandidate === 'string'
        ? Number.parseInt(metadataTtlCandidate, 10)
        : null;

  if (metadataTtl && Number.isFinite(metadataTtl) && metadataTtl > 0) {
    const createdAtMs = createdAt instanceof Date ? createdAt.getTime() : Number.NaN;
    return Number.isNaN(createdAtMs) ? null : createdAtMs + metadataTtl * 1000;
  }

  return null;
};

const extractStorageKeyFromSignedUrl = (mediaUrl: string): string | null => {
  let bucket: string | undefined;
  try {
    bucket = readSupabaseS3Config().bucket;
  } catch (error) {
    logger.warn('tickets.messages.list: missing Supabase bucket config for media refresh', { error });
    return null;
  }

  try {
    const parsed = new URL(mediaUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length < 2) {
      return null;
    }

    const [signedBucket, ...rest] = segments;
    if (signedBucket !== bucket) {
      return null;
    }

    return decodeURIComponent(rest.join('/'));
  } catch (error) {
    logger.warn('tickets.messages.list: failed to extract storage key from media URL', { mediaUrl, error });
    return null;
  }
};

const refreshMediaUrlIfExpired = async (tenantId: string, message: Message): Promise<Message> => {
  if (!message.mediaUrl) {
    return message;
  }

  const mediaMetadata =
    message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
      ? (message.metadata as Record<string, unknown>).media &&
        typeof (message.metadata as Record<string, unknown>).media === 'object' &&
          !Array.isArray((message.metadata as Record<string, unknown>).media)
        ? ({ ...(message.metadata as Record<string, unknown>).media } as Record<string, unknown>)
        : null
      : null;

  const expiration = resolveSignedUrlExpiration(message.mediaUrl, mediaMetadata, message.createdAt);
  if (expiration && expiration > Date.now() + 30_000) {
    return message;
  }

  const storageKey = extractStorageKeyFromSignedUrl(message.mediaUrl);
  if (!storageKey) {
    return message;
  }

  const expiresInSeconds = resolveSignedUrlTtl(mediaMetadata?.urlExpiresInSeconds as number | null | undefined);

  try {
    const refreshedUrl = await createSignedGetUrl({ key: storageKey, expiresInSeconds });
    const updatedMetadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
      ? { ...(message.metadata as Record<string, unknown>) }
      : {};

    const resolvedMediaMetadata = mediaMetadata ? { ...mediaMetadata } : {};
    resolvedMediaMetadata.url = refreshedUrl;
    resolvedMediaMetadata.urlExpiresInSeconds = expiresInSeconds;
    updatedMetadata.media = resolvedMediaMetadata;

    await storageUpdateMessage(tenantId, message.id, { mediaUrl: refreshedUrl, metadata: updatedMetadata });

    return {
      ...message,
      mediaUrl: refreshedUrl,
      metadata: updatedMetadata,
    };
  } catch (error) {
    logger.warn('tickets.messages.list: failed to refresh expired media URL', {
      tenantId,
      messageId: message.id,
      mediaUrl: message.mediaUrl,
      storageKey,
      error,
    });

    return message;
  }
};

export const listMessages = async (
  tenantId: string,
  ticketId: string,
  pagination: Pagination
): Promise<PaginatedResult<Message>> => {
  const ticket = await storageFindTicketById(tenantId, ticketId);
  if (!ticket) {
    throw new NotFoundError('Ticket', ticketId);
  }

  const result = await storageListMessages(tenantId, { ticketId }, pagination);

  const items = await Promise.all(
    result.items.map(async (message) => {
      const hydratedMessage = await refreshMediaUrlIfExpired(tenantId, message);

      const existingProviderId =
        'providerMessageId' in hydratedMessage &&
        typeof (hydratedMessage as { providerMessageId?: unknown }).providerMessageId === 'string' &&
        ((hydratedMessage as { providerMessageId: string }).providerMessageId.trim().length > 0)
          ? (hydratedMessage as { providerMessageId: string }).providerMessageId.trim()
          : null;

      const providerMessageId =
        existingProviderId ??
        resolveProviderMessageId(hydratedMessage.metadata) ??
        (typeof hydratedMessage.externalId === 'string' && hydratedMessage.externalId.trim().length > 0
          ? hydratedMessage.externalId.trim()
          : null);

      return {
        ...hydratedMessage,
        providerMessageId: providerMessageId ?? null,
        metadata: normalizeMessageMetadata(hydratedMessage.metadata, providerMessageId ?? null),
      };
    })
  );

  return {
    ...result,
    items,
  };
};
