import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('whatsapp-send helpers', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.OUTBOUND_TPS_DEFAULT;
    delete process.env.OUTBOUND_TPS_BY_INSTANCE;
  });

  it('computes rate keys per instance', async () => {
    const module = await import('../whatsapp-send');
    expect(module.rateKeyForInstance('tenant-1', 'inst-1')).toBe('whatsapp:tenant-1:inst-1');
  });

  it('falls back to default rate limit when no overrides are set', async () => {
    const module = await import('../whatsapp-send');
    expect(module.resolveInstanceRateLimit(null)).toBe(5);
  });

  it('uses overrides from environment variables', async () => {
    process.env.OUTBOUND_TPS_DEFAULT = '7';
    process.env.OUTBOUND_TPS_BY_INSTANCE = 'foo:11,bar:3';

    const module = await import('../whatsapp-send');
    expect(module.resolveInstanceRateLimit('foo')).toBe(11);
    expect(module.resolveInstanceRateLimit('bar')).toBe(3);
    expect(module.resolveInstanceRateLimit('baz')).toBe(7);
  });
});
