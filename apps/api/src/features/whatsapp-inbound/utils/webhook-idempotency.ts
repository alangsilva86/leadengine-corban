import { createHash } from 'node:crypto';

const IDEMPOTENCY_TTL_MS = 60_000;
const recentIdempotencyKeys = new Map<string, number>();

const sweepIdempotency = () => {
  const now = Date.now();
  for (const [key, expiresAt] of recentIdempotencyKeys.entries()) {
    if (expiresAt <= now) {
      recentIdempotencyKeys.delete(key);
    }
  }
};

export const registerIdempotency = (key: string): boolean => {
  sweepIdempotency();
  if (recentIdempotencyKeys.has(key)) {
    return false;
  }
  recentIdempotencyKeys.set(key, Date.now() + IDEMPOTENCY_TTL_MS);
  return true;
};

export const buildIdempotencyKey = (
  tenantId: string | null | undefined,
  instanceId: string | null | undefined,
  messageId: string | null | undefined,
  index: number | null | undefined
) => {
  const raw = `${tenantId ?? 'unknown'}|${instanceId ?? 'unknown'}|${messageId ?? 'unknown'}|${index ?? 0}`;

  try {
    return createHash('sha256').update(raw).digest('hex');
  } catch {
    return raw;
  }
};

export const resetWebhookIdempotencyCache = () => {
  recentIdempotencyKeys.clear();
};

export const __testing = {
  resetWebhookIdempotencyCache,
  sweepIdempotency,
  getCacheSnapshot: () => new Map(recentIdempotencyKeys),
};

