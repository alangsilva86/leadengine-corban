import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureInboundDedupeBackend,
  dedupeCache,
  registerDedupeKey,
  shouldSkipByDedupe,
} from '../dedupe';
import { DEFAULT_DEDUPE_TTL_MS } from '../constants';

vi.mock('../../../../lib/prisma', () => ({
  prisma: {},
}));

vi.mock('../../../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

vi.mock('../../../data/lead-allocation-store', () => ({
  addAllocations: vi.fn(),
}));

vi.mock('../../../services/ticket-service', () => ({
  createTicket: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock('../../../lib/socket-registry', () => ({
  emitToTenant: vi.fn(),
  emitToTicket: vi.fn(),
  emitToAgreement: vi.fn(),
}));

vi.mock('../../../lib/metrics', () => ({
  inboundMessagesProcessedCounter: { inc: vi.fn() },
  leadLastContactGauge: { set: vi.fn() },
}));

vi.mock('../../utils/normalize', () => ({
  normalizeInboundMessage: vi.fn(),
}));

// Desde 3ab075ed a checagem (shouldSkipByDedupe) e o registro (registerDedupeKey) são separados:
// a chave só é registrada depois que a mensagem é persistida, para permitir retry em caso de falha.
describe('shouldSkipByDedupe', () => {
  beforeEach(() => {
    dedupeCache.clear();
    configureInboundDedupeBackend(null);
  });

  it('does not register the key on its own (only registerDedupeKey does)', async () => {
    const key = 'tenant:lead';
    const now = Date.now();

    await expect(shouldSkipByDedupe(key, now)).resolves.toBe(false);
    await expect(shouldSkipByDedupe(key, now + 1)).resolves.toBe(false);
    expect(dedupeCache.has(key)).toBe(false);
  });

  it('removes expired entries from the cache', async () => {
    const key = 'tenant:lead';
    const now = Date.now();

    await registerDedupeKey(key, now);
    expect(dedupeCache.get(key)?.expiresAt).toBe(now + DEFAULT_DEDUPE_TTL_MS);

    const outsideWindow = now + DEFAULT_DEDUPE_TTL_MS;
    await expect(shouldSkipByDedupe(key, outsideWindow)).resolves.toBe(false);
    expect(dedupeCache.has(key)).toBe(false);

    await registerDedupeKey(key, outsideWindow);
    expect(dedupeCache.get(key)?.expiresAt).toBe(outsideWindow + DEFAULT_DEDUPE_TTL_MS);
  });

  it('keeps entries inside the dedupe window', async () => {
    const key = 'tenant:lead';
    const now = Date.now();

    await expect(shouldSkipByDedupe(key, now)).resolves.toBe(false);
    await registerDedupeKey(key, now);

    const insideWindow = now + DEFAULT_DEDUPE_TTL_MS - 1;
    await expect(shouldSkipByDedupe(key, insideWindow)).resolves.toBe(true);
    expect(dedupeCache.get(key)?.expiresAt).toBe(now + DEFAULT_DEDUPE_TTL_MS);
  });

  it('delegates to external backend when configured', async () => {
    const key = 'tenant:lead';
    const now = Date.now();
    const hasMock = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const setMock = vi.fn().mockResolvedValue(undefined);

    configureInboundDedupeBackend({
      has: hasMock,
      set: setMock,
    });

    await expect(shouldSkipByDedupe(key, now)).resolves.toBe(false);
    expect(hasMock).toHaveBeenCalledWith(key);
    expect(setMock).not.toHaveBeenCalled();

    await registerDedupeKey(key, now);
    expect(setMock).toHaveBeenCalledWith(key, DEFAULT_DEDUPE_TTL_MS);
    expect(dedupeCache.has(key)).toBe(false);

    await expect(shouldSkipByDedupe(key, now + 1)).resolves.toBe(true);
  });

  it('falls back to the local cache when the external backend fails', async () => {
    const key = 'tenant:lead';
    const now = Date.now();
    configureInboundDedupeBackend({
      has: vi.fn().mockRejectedValue(new Error('redis down')),
      set: vi.fn().mockRejectedValue(new Error('redis down')),
    });

    await registerDedupeKey(key, now);
    expect(dedupeCache.get(key)?.expiresAt).toBe(now + DEFAULT_DEDUPE_TTL_MS);
    await expect(shouldSkipByDedupe(key, now + 1)).resolves.toBe(true);
  });
});
