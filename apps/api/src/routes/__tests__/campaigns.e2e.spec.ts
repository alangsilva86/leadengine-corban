import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser } from '../../middleware/auth';

const campaignFindMany = vi.fn();
const getCampaignMetricsMock = vi.fn();
const fetchLeadEngineCampaignsMock = vi.fn();

const featureFlagsState = {
  useRealData: false,
  mvpAuthBypass: false,
};

const originalMvpTenantId = process.env.AUTH_MVP_TENANT_ID;

let requireTenantBehavior: RequestHandler = (_req, _res, next) => next();

vi.mock('../../lib/prisma', () => ({
  prisma: {
    campaign: {
      findMany: campaignFindMany,
    },
  },
}));

vi.mock('../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../config/feature-flags', () => ({
  getFeatureFlags: () => ({ ...featureFlagsState }),
  getUseRealDataFlag: () => featureFlagsState.useRealData,
  isMvpAuthBypassEnabled: () => featureFlagsState.mvpAuthBypass,
  refreshFeatureFlags: vi.fn(),
  getMvpBypassTenantId: () => process.env.AUTH_MVP_TENANT_ID ?? undefined,
}));

vi.mock('../../middleware/auth', async () => {
  const actual = await vi.importActual<typeof import('../../middleware/auth')>(
    '../../middleware/auth'
  );
  return {
    ...actual,
    requireTenant: (req: express.Request, res: express.Response, next: express.NextFunction) =>
      requireTenantBehavior(req, res, next),
  };
});

vi.mock('@ticketz/storage', () => ({
  getCampaignMetrics: (...args: unknown[]) => getCampaignMetricsMock(...args),
}));

vi.mock('../../services/campaigns-upstream', () => ({
  fetchLeadEngineCampaigns: (...args: unknown[]) => fetchLeadEngineCampaignsMock(...args),
}));

let campaignsRouter: express.Router;
let errorHandler: RequestHandler;

const buildAuthenticatedUser = (tenantId: string): AuthenticatedUser => ({
  id: 'test-user',
  tenantId,
  email: 'test.user@example.com',
  name: 'Test User',
  role: 'ADMIN',
  isActive: true,
  permissions: [],
});

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/campaigns', campaignsRouter);
  app.use(errorHandler as unknown as RequestHandler);
  return app;
};

beforeAll(async () => {
  ({ campaignsRouter } = await import('../campaigns'));
  ({ errorHandler } = await import('../../middleware/error-handler'));
});

afterEach(() => {
  process.env.AUTH_MVP_TENANT_ID = originalMvpTenantId;
});

describe('GET /api/campaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    featureFlagsState.useRealData = false;
    featureFlagsState.mvpAuthBypass = false;
    fetchLeadEngineCampaignsMock.mockReset();

    getCampaignMetricsMock.mockReturnValue({
      total: 10,
      allocated: 6,
      contacted: 4,
      won: 2,
      lost: 1,
      averageResponseSeconds: 120,
    });

    requireTenantBehavior = (req, _res, next) => {
      (req as express.Request & { user?: AuthenticatedUser }).user = buildAuthenticatedUser('tenant-42');
      next();
    };
  });

  it('returns campaigns from Prisma when filters are provided', async () => {
    const now = new Date();

    campaignFindMany.mockResolvedValueOnce([
      {
        id: 'campaign-1',
        tenantId: 'tenant-42',
        agreementId: 'agreement-xyz',
        agreementName: 'Agreement XYZ',
        name: 'Campaign X',
        status: 'active',
        metadata: { budget: 1000, cplTarget: 150 },
        whatsappInstanceId: 'instance-123',
        createdAt: now,
        updatedAt: now,
        whatsappInstance: {
          id: 'instance-123',
          name: 'Primary Instance',
        },
      },
    ]);

    const app = buildApp();
    const response = await request(app)
      .get('/api/campaigns')
      .set('x-request-id', 'test-request')
      .query({ agreementId: 'agreement-xyz', status: 'active' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      requestId: 'test-request',
      items: [
        {
          id: 'campaign-1',
          tenantId: 'tenant-42',
          agreementId: 'agreement-xyz',
          agreementName: 'Agreement XYZ',
          status: 'active',
          instanceId: 'instance-123',
          instanceName: 'Primary Instance',
          metadata: { budget: 1000, cplTarget: 150 },
          metrics: {
            total: 10,
            allocated: 6,
            contacted: 4,
            won: 2,
            lost: 1,
            averageResponseSeconds: 120,
            budget: 1000,
            cplTarget: 150,
            cpl: 100,
          },
        },
      ],
    });
    expect(campaignFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-42',
          agreementId: 'agreement-xyz',
          status: { in: ['active'] },
        },
        take: 100,
      })
    );
  });

  it('returns 400 when no tenant can be resolved', async () => {
    featureFlagsState.useRealData = false;
    requireTenantBehavior = (_req, _res, next) => {
      const requestWithUser = _req as express.Request & { user?: AuthenticatedUser };
      requestWithUser.user = buildAuthenticatedUser('');
      requestWithUser.user.tenantId = '';
      next();
    };
    delete process.env.AUTH_MVP_TENANT_ID;

    const app = buildApp();
    const response = await request(app).get('/api/campaigns');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'TENANT_REQUIRED',
      },
      requestId: expect.any(String),
    });
    expect(campaignFindMany).not.toHaveBeenCalled();
  });

  it('maps Prisma connectivity errors to 503', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('store down', {
      code: 'P1001',
      clientVersion: 'test',
    });
    campaignFindMany.mockRejectedValueOnce(prismaError);

    const app = buildApp();
    const response = await request(app)
      .get('/api/campaigns')
      .query({ status: 'active' });

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'CAMPAIGNS_STORE_UNAVAILABLE',
      },
      requestId: expect.any(String),
    });
  });

  it('keeps listing campaigns even when metrics enrichment fails', async () => {
    const now = new Date();
    campaignFindMany.mockResolvedValueOnce([
      {
        id: 'campaign-2',
        tenantId: 'tenant-42',
        agreementId: 'agreement-xyz',
        agreementName: 'Agreement XYZ',
        name: 'Campaign Fallback',
        status: 'active',
        metadata: { budget: 500 },
        whatsappInstanceId: null,
        createdAt: now,
        updatedAt: now,
        whatsappInstance: null,
      },
    ]);
    getCampaignMetricsMock.mockImplementationOnce(() => {
      throw new Error('metrics store unreachable');
    });

    const app = buildApp();
    const response = await request(app).get('/api/campaigns');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      warnings: [{ code: 'CAMPAIGN_METRICS_UNAVAILABLE' }],
      items: [
        {
          id: 'campaign-2',
          metrics: {
            total: 0,
            budget: 500,
            cpl: null,
          },
        },
      ],
    });
  });

  it('returns empty items when the upstream responds 404 with USE_REAL_DATA enabled', async () => {
    featureFlagsState.useRealData = true;
    fetchLeadEngineCampaignsMock.mockRejectedValueOnce({ status: 404 });

    const app = buildApp();
    const response = await request(app)
      .get('/api/campaigns')
      .query({ agreementId: 'missing' });

    expect(fetchLeadEngineCampaignsMock).toHaveBeenCalled();
    expect(campaignFindMany).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      items: [],
      requestId: expect.any(String),
    });
  });

  it('returns 502 when the upstream fails with 5xx and USE_REAL_DATA enabled', async () => {
    featureFlagsState.useRealData = true;
    fetchLeadEngineCampaignsMock.mockRejectedValueOnce({ status: 503, message: 'upstream down' });

    const app = buildApp();
    const response = await request(app).get('/api/campaigns');

    expect(fetchLeadEngineCampaignsMock).toHaveBeenCalled();
    expect(campaignFindMany).not.toHaveBeenCalled();
    expect(response.status).toBe(502);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'UPSTREAM_FAILURE',
      },
      requestId: expect.any(String),
    });
  });
});
