import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCampaignMetricsMock = vi.fn();
const fetchLeadEngineCampaignsMock = vi.fn();
const getUseRealDataFlagMock = vi.fn();

const prismaCampaignMock = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

const prismaTenantMock = {
  findFirst: vi.fn(),
  create: vi.fn(),
};

const prismaInstanceMock = {
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

vi.mock('../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    campaign: prismaCampaignMock,
    tenant: prismaTenantMock,
    whatsAppInstance: prismaInstanceMock,
  },
}));

vi.mock('@ticketz/storage', () => ({
  getCampaignMetrics: getCampaignMetricsMock,
}));

vi.mock('../campaigns-upstream', () => ({
  fetchLeadEngineCampaigns: fetchLeadEngineCampaignsMock,
}));

vi.mock('../../config/feature-flags', () => ({
  getUseRealDataFlag: getUseRealDataFlagMock,
}));

import { createCampaign, listCampaigns } from '../campaigns-service';
import type { CampaignDTO } from '../../routes/campaigns.types';

describe('campaigns service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.values(prismaCampaignMock).forEach((fn) => fn.mockReset());
    Object.values(prismaTenantMock).forEach((fn) => fn.mockReset());
    Object.values(prismaInstanceMock).forEach((fn) => fn.mockReset());
    getCampaignMetricsMock.mockReset();
    fetchLeadEngineCampaignsMock.mockReset();
    getUseRealDataFlagMock.mockReturnValue(false);
  });

  it('returns store campaigns with computed metrics when upstream is disabled', async () => {
    const now = new Date('2024-01-01T00:00:00.000Z');
    prismaCampaignMock.findMany.mockResolvedValueOnce([
      {
        id: 'campaign-1',
        tenantId: 'tenant-1',
        agreementId: 'agr-1',
        agreementName: 'Agreement 1',
        name: 'Campaign 1',
        status: 'active',
        metadata: { budget: 100 } as Record<string, unknown>,
        tags: [],
        productType: null,
        marginType: null,
        strategy: null,
        whatsappInstanceId: 'inst-1',
        whatsappInstance: { id: 'inst-1', name: 'Instance 1' },
        createdAt: now,
        updatedAt: now,
      },
    ]);
    getCampaignMetricsMock.mockResolvedValueOnce({
      total: 10,
      allocated: 8,
      contacted: 4,
      won: 2,
      lost: 1,
      averageResponseSeconds: 120,
    });

    const result = await listCampaigns({
      tenantId: 'tenant-1',
      filters: { tags: [], statuses: ['active'] },
      requestId: 'req-1',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'campaign-1',
      metrics: expect.objectContaining({
        budget: 100,
        total: 10,
        cpl: 10,
      }),
    });
    expect(result.meta).toEqual({ source: 'store', upstreamFallback: false });
  });

  it('returns synthetic campaign when safe mode is enabled', async () => {
    const previousEnv = process.env.SAFE_MODE;
    process.env.SAFE_MODE = 'true';

    const result = await createCampaign({
      requestedTenantId: 'tenant-1',
      agreementId: 'agr-1',
      agreementName: 'Agreement 1',
      instanceId: 'inst-1',
      brokerId: null,
      name: 'Campaign',
      channel: 'whatsapp',
      schedule: { type: 'immediate' },
      audienceCount: 0,
      productType: 'generic',
      marginType: 'percentage',
      marginValue: null,
      strategy: null,
      tags: ['generic'],
      metadata: {},
      actorId: 'user-1',
    });

    expect(result.meta).toEqual({ safeMode: true });
    expect((result.data as CampaignDTO).status).toBe('scheduled');

    process.env.SAFE_MODE = previousEnv;
  });
});
