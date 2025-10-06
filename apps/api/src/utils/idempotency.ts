export interface IdempotencyEntry<T> {
  value: T;
  payloadHash: string;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const registry = new Map<string, IdempotencyEntry<unknown>>();

const cleanupExpired = () => {
  const now = Date.now();
  for (const [key, entry] of registry.entries()) {
    if (entry.expiresAt <= now) {
      registry.delete(key);
    }
  }
};

const compoundKey = (tenantId: string, idempotencyKey: string): string => `${tenantId}:${idempotencyKey}`;

export const getIdempotentValue = <T>(tenantId: string, idempotencyKey: string): IdempotencyEntry<T> | null => {
  cleanupExpired();
  const entry = registry.get(compoundKey(tenantId, idempotencyKey));
  return (entry as IdempotencyEntry<T> | undefined) ?? null;
};

export const rememberIdempotency = <T>(
  tenantId: string,
  idempotencyKey: string,
  payloadHash: string,
  value: T,
  ttlMs: number = DEFAULT_TTL_MS
): IdempotencyEntry<T> => {
  const entry: IdempotencyEntry<T> = {
    value,
    payloadHash,
    expiresAt: Date.now() + ttlMs,
  };

  registry.set(compoundKey(tenantId, idempotencyKey), entry as IdempotencyEntry<unknown>);
  return entry;
};

export const purgeIdempotency = (tenantId: string, idempotencyKey: string): void => {
  registry.delete(compoundKey(tenantId, idempotencyKey));
};

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
};

export const hashIdempotentPayload = (raw: unknown): string => stableStringify(raw);
