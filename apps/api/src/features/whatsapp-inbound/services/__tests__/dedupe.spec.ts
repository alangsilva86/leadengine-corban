import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_DEDUPE_TTL_MS,
  MAX_DEDUPE_CACHE_SIZE,
  configureInboundDedupeBackend,
  dedupeCache,
  pruneDedupeCache,
  registerDedupeKey,
  reset,
  shouldSkipByDedupe,
} from '../dedupe';

vi.mock('../../../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

describe('dedupe cache', () => {
  beforeEach(() => {
    reset();
    vi.clearAllMocks();
  });

  it('registers keys and respects the TTL window', async () => {
    const key = 'tenant:lead';
    const now = Date.now();

    await expect(shouldSkipByDedupe(key, now)).resolves.toBe(false);

    await registerDedupeKey(key, now, DEFAULT_DEDUPE_TTL_MS);

    await expect(shouldSkipByDedupe(key, now + 1)).resolves.toBe(true);

    const outsideWindow = now + DEFAULT_DEDUPE_TTL_MS + 1;
    await expect(shouldSkipByDedupe(key, outsideWindow)).resolves.toBe(false);
  });

  it('falls back to local cache when the backend fails', async () => {
    const key = 'tenant:fallback';
    const now = Date.now();
    const hasMock = vi.fn().mockRejectedValue(new Error('Redis unavailable'));
    const setMock = vi.fn().mockRejectedValue(new Error('Redis unavailable'));

    configureInboundDedupeBackend({
      has: hasMock,
      set: setMock,
    });

    await registerDedupeKey(key, now, DEFAULT_DEDUPE_TTL_MS);

    await expect(shouldSkipByDedupe(key, now + 1)).resolves.toBe(true);
    expect(hasMock).toHaveBeenCalledWith(key);
    expect(setMock).toHaveBeenCalledWith(key, DEFAULT_DEDUPE_TTL_MS);
  });

  it('prunes expired entries and performs a massive purge when necessary', () => {
    const base = Date.now();

    for (let index = 0; index < MAX_DEDUPE_CACHE_SIZE + 5; index += 1) {
      dedupeCache.set(`key-${index}`, { expiresAt: base - index });
    }

    pruneDedupeCache(base - 1);

    expect(dedupeCache.size).toBeLessThanOrEqual(MAX_DEDUPE_CACHE_SIZE);
  });
});
