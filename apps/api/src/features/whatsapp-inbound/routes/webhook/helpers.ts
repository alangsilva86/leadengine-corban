import { DEFAULT_RAW_PREVIEW_MAX_LENGTH, toRawPreview as baseToRawPreview } from '../../utils/webhook-parsers';

export const MAX_RAW_PREVIEW_LENGTH = DEFAULT_RAW_PREVIEW_MAX_LENGTH;

export const toRawPreview = (value: unknown): string =>
  baseToRawPreview(value, MAX_RAW_PREVIEW_LENGTH);

export const sanitizeMetadataValue = (value: unknown): unknown => {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return undefined;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return (value as Buffer).toString('base64');
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeMetadataValue(entry));
  }

  if (typeof value === 'object') {
    const record: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (nested === undefined) {
        continue;
      }
      record[key] = sanitizeMetadataValue(nested);
    }
    return record;
  }

  return value;
};

export const parseTimestampToDate = (value: unknown): Date | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value > 1_000_000_000_000 ? value : value * 1000);
  }

  if (typeof value === 'bigint') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return new Date(numeric > 1_000_000_000_000 ? numeric : numeric * 1000);
    }
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return new Date(numeric > 1_000_000_000_000 ? numeric : numeric * 1000);
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  }

  return null;
};
