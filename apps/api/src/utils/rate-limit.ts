export class RateLimitError extends Error {
  readonly retryAfterMs: number;

  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

interface RateBucket {
  windowStart: number;
  count: number;
}

const WINDOW_MS = 1000;
const buckets = new Map<string, RateBucket>();

export const assertWithinRateLimit = (
  key: string,
  limit: number,
  windowMs: number = WINDOW_MS
): void => {
  if (limit <= 0) {
    return;
  }

  const now = Date.now();
  const bucket = buckets.get(key) ?? { windowStart: now, count: 0 };

  if (now - bucket.windowStart >= windowMs) {
    bucket.windowStart = now;
    bucket.count = 0;
  }

  if (bucket.count >= limit) {
    const retryAfter = windowMs - (now - bucket.windowStart);
    throw new RateLimitError('Limite de envio atingido para esta instância.', Math.max(retryAfter, 0));
  }

  bucket.count += 1;
  buckets.set(key, bucket);
};

export const resetRateLimit = (key: string): void => {
  buckets.delete(key);
};
