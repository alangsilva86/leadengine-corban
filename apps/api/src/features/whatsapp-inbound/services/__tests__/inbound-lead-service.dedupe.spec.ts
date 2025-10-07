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
}));

vi.mock('../utils/normalize', () => ({
  normalizeInboundMessage: vi.fn(),
}));

let shouldSkipByDedupe: (key: string, now: number) => boolean;
let testing: typeof import('../inbound-lead-service')['__testing'];

beforeAll(async () => {
  const module = await import('../inbound-lead-service');
  shouldSkipByDedupe = module.shouldSkipByDedupe;
  testing = module.__testing;
});

describe('shouldSkipByDedupe', () => {
  beforeEach(() => {
    testing.dedupeCache.clear();
  });

  it('removes expired entries from the cache', () => {
    const key = 'tenant:lead';
    const now = Date.now();

    expect(shouldSkipByDedupe(key, now)).toBe(false);

    const outsideWindow = now + testing.DEDUPE_WINDOW_MS;
    expect(shouldSkipByDedupe(key, outsideWindow)).toBe(false);
    expect(testing.dedupeCache.get(key)).toBe(outsideWindow);
  });

  it('keeps entries inside the dedupe window', () => {
    const key = 'tenant:lead';
    const now = Date.now();

    expect(shouldSkipByDedupe(key, now)).toBe(false);

    const insideWindow = now + testing.DEDUPE_WINDOW_MS - 1;
    expect(shouldSkipByDedupe(key, insideWindow)).toBe(true);
    expect(testing.dedupeCache.get(key)).toBe(now);
  });
});
