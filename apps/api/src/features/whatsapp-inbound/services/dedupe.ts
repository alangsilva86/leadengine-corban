import { logger } from '../../../config/logger';
import {
  DEFAULT_DEDUPE_TTL_MS,
  MAX_DEDUPE_CACHE_SIZE,
} from './constants';
import { mapErrorForLog } from './logging';

type DedupeCacheEntry = {
  expiresAt: number;
};

export interface InboundDedupeBackend {
  has(key: string): Promise<boolean>;
  set(key: string, ttlMs: number): Promise<void>;
}

export const dedupeCache = new Map<string, DedupeCacheEntry>();

let dedupeBackend: InboundDedupeBackend | null = null;

export const configureInboundDedupeBackend = (
  backend: InboundDedupeBackend | null
): void => {
  dedupeBackend = backend;
};

export const resetDedupeState = (): void => {
  dedupeCache.clear();
  dedupeBackend = null;
};

const pruneDedupeCache = (now: number): void => {
  if (dedupeCache.size === 0) {
    return;
  }

  let removedExpiredEntries = 0;

  for (const [key, storedAt] of dedupeCache.entries()) {
    if (storedAt.expiresAt <= now) {
      dedupeCache.delete(key);
      removedExpiredEntries += 1;
    }
  }

  if (dedupeCache.size > MAX_DEDUPE_CACHE_SIZE) {
    const sizeBefore = dedupeCache.size;
    dedupeCache.clear();
    logger.warn('whatsappInbound.dedupeCache.massivePurge', {
      maxSize: MAX_DEDUPE_CACHE_SIZE,
      removedExpiredEntries,
      sizeBefore,
    });
  }
};

const shouldSkipByLocalDedupe = (key: string, now: number): boolean => {
  pruneDedupeCache(now);

  const entry = dedupeCache.get(key);
  return !!entry && entry.expiresAt > now;
};

const registerLocalDedupe = (key: string, now: number, ttlMs: number): void => {
  if (ttlMs <= 0) {
    return;
  }

  pruneDedupeCache(now);

  const expiresAt = now + ttlMs;
  dedupeCache.set(key, { expiresAt });
};

export const shouldSkipByDedupe = async (
  key: string,
  now: number,
  ttlMs = DEFAULT_DEDUPE_TTL_MS
): Promise<boolean> => {
  if (ttlMs <= 0) {
    return false;
  }

  if (dedupeBackend) {
    try {
      if (await dedupeBackend.has(key)) {
        return true;
      }
    } catch (error) {
      logger.warn('whatsappInbound.dedupeCache.redisHasFallback', {
        key,
        ttlMs,
        error: mapErrorForLog(error),
      });
      return shouldSkipByLocalDedupe(key, now);
    }
  }

  return shouldSkipByLocalDedupe(key, now);
};

export const registerDedupeKey = async (
  key: string,
  now: number,
  ttlMs = DEFAULT_DEDUPE_TTL_MS
): Promise<void> => {
  if (ttlMs <= 0) {
    return;
  }

  if (dedupeBackend) {
    try {
      await dedupeBackend.set(key, ttlMs);
      return;
    } catch (error) {
      logger.warn('whatsappInbound.dedupeCache.redisSetFallback', {
        key,
        ttlMs,
        error: mapErrorForLog(error),
      });
    }
  }

  registerLocalDedupe(key, now, ttlMs);
};

export const __testing = {
  pruneDedupeCache,
  registerLocalDedupe,
  shouldSkipByLocalDedupe,
};
