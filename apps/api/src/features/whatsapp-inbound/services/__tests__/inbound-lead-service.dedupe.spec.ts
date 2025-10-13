import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('../utils/normalize', () => ({
  normalizeInboundMessage: vi.fn(),
}));

let shouldSkipByDedupe: (key: string, now: number) => Promise<boolean>;
let testing: typeof import('../inbound-lead-service')['__testing'];

beforeAll(async () => {
  const module = await import('../inbound-lead-service');
  shouldSkipByDedupe = module.shouldSkipByDedupe;
  testing = module.__testing;
});

describe('shouldSkipByDedupe', () => {
  beforeEach(() => {
    testing.dedupeCache.clear();
    testing.configureInboundDedupeBackend(null);
  });

  it('removes expired entries from the cache', async () => {
    const key = 'tenant:lead';
    const now = Date.now();

    await expect(shouldSkipByDedupe(key, now)).resolves.toBe(false);

    const outsideWindow = now + testing.DEFAULT_DEDUPE_TTL_MS;
    await expect(shouldSkipByDedupe(key, outsideWindow)).resolves.toBe(false);
    expect(testing.dedupeCache.get(key)?.expiresAt).toBe(outsideWindow + testing.DEFAULT_DEDUPE_TTL_MS);
  });

  it('keeps entries inside the dedupe window', async () => {
    const key = 'tenant:lead';
    const now = Date.now();

    await expect(shouldSkipByDedupe(key, now)).resolves.toBe(false);

    const insideWindow = now + testing.DEFAULT_DEDUPE_TTL_MS - 1;
    await expect(shouldSkipByDedupe(key, insideWindow)).resolves.toBe(true);
    expect(testing.dedupeCache.get(key)?.expiresAt).toBe(now + testing.DEFAULT_DEDUPE_TTL_MS);
  });

  it('delegates to external backend when configured', async () => {
    const key = 'tenant:lead';
    const now = Date.now();
    const hasMock = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const setMock = vi.fn().mockResolvedValue(undefined);

    testing.configureInboundDedupeBackend({
      has: hasMock,
      set: setMock,
    });

    await expect(shouldSkipByDedupe(key, now)).resolves.toBe(false);
    expect(hasMock).toHaveBeenCalledWith(key);
    expect(setMock).toHaveBeenCalledWith(key, testing.DEFAULT_DEDUPE_TTL_MS);

    await expect(shouldSkipByDedupe(key, now + 1)).resolves.toBe(true);
  });
});
