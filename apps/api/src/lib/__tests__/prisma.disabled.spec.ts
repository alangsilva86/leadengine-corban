import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

describe('prisma disabled fallback', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (typeof originalDatabaseUrl === 'undefined') {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    vi.resetModules();
  });

  it('exposes a disabled client when DATABASE_URL is not provided', async () => {
    const prismaModule = await import('../prisma');
    const { prisma, isDatabaseEnabled } = prismaModule;

    expect(isDatabaseEnabled).toBe(false);

    const campaigns = await prisma.campaign.findMany();
    expect(campaigns).toEqual([]);

    const first = await prisma.campaign.findFirst();
    expect(first).toBeNull();

    const count = await prisma.campaign.count();
    expect(count).toBe(0);
  });

  it('throws DatabaseDisabledError when performing write operations', async () => {
    const prismaModule = await import('../prisma');
    const { prisma, DatabaseDisabledError } = prismaModule;

    await expect(
      prisma.campaign.create({
        data: {
          id: 'campaign-disabled',
          tenantId: 'demo-tenant',
          name: 'Demo campaign',
          agreementId: 'agreement',
          status: 'active',
        },
      } as any)
    ).rejects.toBeInstanceOf(DatabaseDisabledError);
  });
});
