import type { Prisma } from '@prisma/client';
import type { InstanceLastError, InstanceMetadata } from './types';

export const pickString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
};

export const compactRecord = (input: Record<string, unknown>): Record<string, unknown> => {
  const entries = Object.entries(input).filter(([, value]) => {
    if (value === undefined || value === null) {
      return false;
    }
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    return true;
  });

  return Object.fromEntries(entries);
};

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

export const buildHistoryEntry = (action: string, actorId: string, details?: Record<string, unknown>) => ({
  action,
  by: actorId,
  at: new Date().toISOString(),
  ...(details ?? {}),
});

export const readLastErrorFromMetadata = (metadata: InstanceMetadata): InstanceLastError | null => {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const source = metadata as Record<string, unknown>;
  const payload = source.lastError && typeof source.lastError === 'object'
    ? (source.lastError as Record<string, unknown>)
    : null;

  if (!payload) {
    return null;
  }

  const message = pickString(payload.message, payload.error, payload.description);
  const code = pickString(payload.code, payload.errorCode, payload.error_code);
  const requestId = pickString(
    payload.requestId,
    payload.request_id,
    payload.traceId,
    payload.trace_id
  );
  const at = pickString(payload.at, payload.timestamp, payload.attemptedAt, payload.attempted_at);

  if (!message && !code && !requestId && !at) {
    return null;
  }

  return {
    ...(code ? { code } : {}),
    ...(message ? { message } : {}),
    ...(requestId ? { requestId } : {}),
    ...(at ? { at } : {}),
  };
};

export const withInstanceLastError = (
  metadata: InstanceMetadata,
  error: InstanceLastError | null
): Prisma.JsonObject => {
  const base: Record<string, unknown> =
    metadata && typeof metadata === 'object' ? { ...(metadata as Record<string, unknown>) } : {};

  if (error && (error.code || error.message || error.requestId)) {
    const normalized = compactRecord({
      code: error.code ?? undefined,
      message: error.message ?? undefined,
      requestId: error.requestId ?? undefined,
      at: error.at ?? new Date().toISOString(),
    });
    base.lastError = normalized;
  } else {
    delete base.lastError;
  }

  return base as Prisma.JsonObject;
};

export const appendInstanceHistory = (
  metadata: InstanceMetadata,
  entry: ReturnType<typeof buildHistoryEntry>
): Prisma.JsonObject => {
  const base: Record<string, unknown> = metadata && typeof metadata === 'object' ? { ...(metadata as Record<string, unknown>) } : {};
  const history = Array.isArray(base.history) ? [...(base.history as unknown[])] : [];
  history.push(entry);
  base.history = history.slice(-50);
  return base as Prisma.JsonObject;
};

const normalizePhoneCandidate = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const digits = trimmed.replace(/\D+/g, '');
  if (digits.length >= 8) {
    return trimmed;
  }

  return null;
};

export const findPhoneNumberInObject = (value: unknown): string | null => {
  const visited = new Set<unknown>();
  const queue: Array<Record<string, unknown>> = [];

  const enqueue = (entry: unknown) => {
    if (entry === null || entry === undefined || visited.has(entry)) {
      return;
    }

    if (Array.isArray(entry)) {
      visited.add(entry);
      entry.forEach(enqueue);
      return;
    }

    if (isRecord(entry)) {
      visited.add(entry);
      queue.push(entry);
    }
  };

  enqueue(value);

  const preferredKeys = ['phoneNumber', 'phone_number', 'msisdn'];
  const fallbackKeys = ['whatsappNumber', 'whatsapp_number', 'jid', 'number', 'address'];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const key of preferredKeys) {
      const candidate = normalizePhoneCandidate(current[key]);
      if (candidate) {
        return candidate;
      }
    }

    for (const key of fallbackKeys) {
      const candidate = normalizePhoneCandidate(current[key]);
      if (candidate) {
        return candidate;
      }
    }

    for (const entry of Object.values(current)) {
      enqueue(entry);
    }
  }

  return null;
};
