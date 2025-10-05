import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser } from '../../middleware/auth';

const campaignFindMany = vi.fn();
const getCampaignMetricsMock = vi.fn();

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

describe('GET /api/campaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getCampaignMetricsMock.mockReturnValue({
      total: 10,
      allocated: 6,
      contacted: 4,
      won: 2,
      lost: 1,
      averageResponseSeconds: 120,
    });

    requireTenantBehavior = (req, res, next) => {
      const existingUser = (req as express.Request & { user?: AuthenticatedUser }).user;
      if (existingUser) {
        next();
        return;
      }

      const tenantId = req.header('x-tenant-id');
      const authHeader = req.header('authorization');

      if (!tenantId || !authHeader) {
        res.status(401).json({
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Usuário não autenticado',
          },
        });
        return;
      }
      (req as express.Request & { user?: AuthenticatedUser }).user = buildAuthenticatedUser(tenantId);
      next();
    };
  });

  it('returns active campaigns filtered by agreement when authentication is provided', async () => {
    const now = new Date();

    campaignFindMany.mockResolvedValueOnce([
      {
        id: 'campaign-1',
        tenantId: 'tenant-42',
        agreementId: 'agreement-xyz',
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
      .query({ agreementId: 'agreement-xyz', status: 'active' })
      .set('authorization', 'Bearer valid-token')
      .set('x-tenant-id', 'tenant-42');

    expect(response.status).toBe(200);
    expect(campaignFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-42',
          agreementId: 'agreement-xyz',
          status: { in: ['active'] },
        }),
      })
    );
    expect(response.body).toMatchObject({
      success: true,
      data: [
        {
          id: 'campaign-1',
          tenantId: 'tenant-42',
          agreementId: 'agreement-xyz',
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
  });

  it('returns 401 when authentication headers are missing', async () => {
    const app = buildApp();
    const response = await request(app)
      .get('/api/campaigns')
      .query({ agreementId: 'agreement-xyz', status: 'active' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'NOT_AUTHENTICATED',
        message: 'Usuário não autenticado',
      },
    });
    expect(campaignFindMany).not.toHaveBeenCalled();
  });
});
