import express, { type Request, type RequestHandler } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const getCampaignMetricsMock = vi.fn(() => ({
  total: 5,
  success: 4,
  failed: 1,
  lastActivityAt: null,
}));

vi.mock('../../middleware/auth', () => ({
  requireTenant: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('@ticketz/storage', () => ({
  getCampaignMetrics: getCampaignMetricsMock,
}));

import { campaignsRouter } from '../campaigns';
import { errorHandler } from '../../middleware/error-handler';
import { prisma } from '../../lib/prisma';
import { logger } from '../../config/logger';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(((req, _res, next) => {
    (req as Request).user = {
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'user@example.com',
      name: 'User',
      role: 'ADMIN',
      isActive: true,
      permissions: [],
    };
    next();
  }) as RequestHandler);
  app.use('/', campaignsRouter);
  app.use(errorHandler as unknown as RequestHandler);
  return app;
};

describe('GET /campaigns', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getCampaignMetricsMock.mockReset();
    getCampaignMetricsMock.mockReturnValue({
      total: 5,
      success: 4,
      failed: 1,
      lastActivityAt: null,
    });
  });

  it('returns campaigns list with computed metrics when storage succeeds', async () => {
    const findManySpy = vi.spyOn(prisma.campaign, 'findMany').mockResolvedValueOnce([
      {
        id: 'campaign-1',
        tenantId: 'tenant-1',
        agreementId: 'agreement-1',
        agreementName: 'Agreement 1',
        name: 'Campaign 1',
        status: 'active',
        metadata: { budget: 100, cplTarget: 25 } as Prisma.JsonValue,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        whatsappInstanceId: 'instance-1',
        whatsappInstance: {
          id: 'instance-1',
          name: 'Instance One',
        },
      },
    ]);

    const app = buildApp();
    const response = await request(app).get('/?status=active,paused&agreementId=agreement-1&instanceId=instance-1');

    expect(response.status).toBe(200);
    expect(findManySpy).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        agreementId: 'agreement-1',
        whatsappInstanceId: 'instance-1',
        status: { in: ['active', 'paused'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        whatsappInstance: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    expect(response.body).toMatchObject({
      success: true,
      data: [
        expect.objectContaining({
          id: 'campaign-1',
          instanceId: 'instance-1',
          instanceName: 'Instance One',
          metrics: expect.objectContaining({
            total: 5,
            budget: 100,
            cplTarget: 25,
            cpl: 20,
          }),
        }),
      ],
    });
  });

  it('responds with 503 and logs when Prisma storage is unavailable', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('database unavailable', {
      code: 'P1001',
      clientVersion: '5.7.1',
    });

    const findManySpy = vi.spyOn(prisma.campaign, 'findMany').mockRejectedValueOnce(prismaError);
    const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => logger);

    const app = buildApp();
    const response = await request(app).get('/');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'CAMPAIGNS_STORE_UNAVAILABLE',
      },
    });
    expect(findManySpy).toHaveBeenCalledTimes(1);
    expect(loggerSpy).toHaveBeenCalledWith('Failed to list campaigns', {
      tenantId: 'tenant-1',
      agreementId: undefined,
      instanceId: undefined,
      status: [],
      error: 'database unavailable',
    });
  });
});
