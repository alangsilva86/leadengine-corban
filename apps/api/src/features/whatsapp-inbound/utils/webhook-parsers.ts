import { logger } from '../../../config/logger';
import type { RawBaileysUpsertEvent } from '../services/baileys-raw-normalizer';

export const readString = (...candidates: unknown[]): string | null => {
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

export const readNumber = (...candidates: unknown[]): number | null => {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (!trimmed) {
        continue;
      }
      const parsed = Number(trimmed);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
};

export const normalizeApiKey = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const bearerMatch = /^bearer\s+(.+)$/i.exec(value);
  const normalized = (bearerMatch?.[1] ?? value).trim();

  return normalized.length > 0 ? normalized : null;
};

export const asArray = (value: unknown): unknown[] => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.events)) {
      return record.events;
    }
    return [record];
  }
  return [];
};

export const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

export const unwrapWebhookEvent = (
  entry: unknown
): { event: RawBaileysUpsertEvent; envelope: Record<string, unknown> } | null => {
  const envelope = asRecord(entry);
  if (!envelope) {
    return null;
  }

  const bodyRecord = asRecord(envelope.body);
  if (!bodyRecord) {
    return { event: envelope as RawBaileysUpsertEvent, envelope };
  }

  const merged: Record<string, unknown> = { ...bodyRecord };

  for (const [key, value] of Object.entries(envelope)) {
    if (key === 'body') {
      continue;
    }
    if (!(key in merged)) {
      merged[key] = value;
    }
  }

  return { event: merged as RawBaileysUpsertEvent, envelope };
};

export const DEFAULT_RAW_PREVIEW_MAX_LENGTH = 2_000;

export const toRawPreview = (value: unknown, maxLength = DEFAULT_RAW_PREVIEW_MAX_LENGTH): string => {
  try {
    const json = JSON.stringify(value);
    if (!json) {
      return '';
    }
    return json.length > maxLength ? json.slice(0, maxLength) : json;
  } catch (error) {
    const fallback = String(value);
    logger.debug('Failed to serialize raw Baileys payload; using fallback string', { error });
    return fallback.length > maxLength ? fallback.slice(0, maxLength) : fallback;
  }
};

