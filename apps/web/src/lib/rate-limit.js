const DEFAULT_BASE_DELAY_MS = 2000;
const DEFAULT_MAX_DELAY_MS = 30000;

export const parseRetryAfterMs = (retryAfter) => {
  if (retryAfter === null || retryAfter === undefined) {
    return null;
  }

  if (typeof retryAfter === 'number' && Number.isFinite(retryAfter)) {
    const asMilliseconds = retryAfter > 1000 ? retryAfter : retryAfter * 1000;
    return Math.max(0, Math.round(asMilliseconds));
  }

  if (typeof retryAfter === 'string') {
    const trimmed = retryAfter.trim();
    if (!trimmed) {
      return null;
    }

    const numericCandidate = Number(trimmed);
    if (Number.isFinite(numericCandidate)) {
      const asMilliseconds = numericCandidate > 1000 ? numericCandidate : numericCandidate * 1000;
      return Math.max(0, Math.round(asMilliseconds));
    }

    const parsedDate = Date.parse(trimmed);
    if (!Number.isNaN(parsedDate)) {
      const diff = parsedDate - Date.now();
      return diff > 0 ? diff : 0;
    }
  }

  return null;
};

export const computeBackoffDelay = (attempt = 1, { baseMs = DEFAULT_BASE_DELAY_MS, maxMs = DEFAULT_MAX_DELAY_MS } = {}) => {
  const normalizedAttempt = Math.max(1, Number.isFinite(attempt) ? attempt : 1);
  const base = Math.max(1, baseMs);
  const max = Math.max(base, maxMs);
  const exponent = normalizedAttempt - 1;
  const delay = base * Math.pow(2, exponent);
  return Math.min(max, delay);
};

export const RATE_LIMIT_DEFAULTS = {
  baseDelayMs: DEFAULT_BASE_DELAY_MS,
  maxDelayMs: DEFAULT_MAX_DELAY_MS,
};
