import express, { type Request, type RequestHandler } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const { getCampaignMetricsMock } = vi.hoisted(() => ({
  getCampaignMetricsMock: vi.fn(async () => ({
    total: 5,
    allocated: 5,
    contacted: 3,
    won: 2,
    lost: 1,
    averageResponseSeconds: 120,
  })),
}));

vi.mock('../../middleware/auth', () => ({
  requireTenant: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('@ticketz/storage', () => ({
  getCampaignMetrics: getCampaignMetricsMock,
  setPrismaClient: vi.fn(),
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
    getCampaignMetricsMock.mockResolvedValue({
      total: 5,
      allocated: 5,
      contacted: 3,
      won: 2,
      lost: 1,
      averageResponseSeconds: 120,
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
      take: 100,
    });
    expect(response.body).toMatchObject({
      success: true,
      requestId: expect.any(String),
      items: [
        expect.objectContaining({
          id: 'campaign-1',
          instanceId: 'instance-1',
          instanceName: 'Instance One',
          metadata: { budget: 100, cplTarget: 25 },
          metrics: expect.objectContaining({
            total: 5,
            allocated: 5,
            contacted: 3,
            won: 2,
            lost: 1,
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
      requestId: expect.any(String),
      error: {
        code: 'CAMPAIGNS_STORE_UNAVAILABLE',
      },
    });
    expect(findManySpy).toHaveBeenCalledTimes(1);
    expect(loggerSpy).toHaveBeenCalledWith('[/api/campaigns] prisma error', {
      agreementId: null,
      error: expect.objectContaining({ message: 'database unavailable' }),
      instanceId: null,
      mappedError: expect.objectContaining({
        code: 'CAMPAIGNS_STORE_UNAVAILABLE',
        status: 503,
        type: 'connectivity',
      }),
      requestId: expect.any(String),
      status: ['active'],
      tenantId: 'tenant-1',
    });
  });
});

describe('POST /campaigns', () => {
  const defaultMetrics = {
    total: 5,
    allocated: 5,
    contacted: 3,
    won: 2,
    lost: 1,
    averageResponseSeconds: 120,
  };

  const defaultTenant = {
    id: 'tenant-1',
    name: 'Tenant 1',
    slug: 'tenant-1',
    settings: {} as Record<string, unknown>,
  };

  const defaultInstance = {
    id: 'instance-1',
    tenantId: 'tenant-1',
    name: 'Instance One',
    brokerId: 'broker-1',
    status: 'connected',
    connected: true,
    metadata: {} as Record<string, unknown>,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    getCampaignMetricsMock.mockReset();
    getCampaignMetricsMock.mockResolvedValue({ ...defaultMetrics });
  });

  const mockTenantAndInstance = () => {
    vi.spyOn(prisma.tenant, 'findFirst').mockImplementation(async (args) => {
      const orConditions = Array.isArray(args?.where?.OR) ? args?.where?.OR : [];
      const matchesId = orConditions.some((condition) => condition?.id === defaultTenant.id);
      const matchesSlug = orConditions.some((condition) => condition?.slug === defaultTenant.slug);
      const slugCondition = (args?.where as { slug?: string } | undefined)?.slug;

      if (matchesId || matchesSlug || slugCondition === defaultTenant.slug) {
        return defaultTenant as never;
      }

      return null;
    });
    vi.spyOn(prisma.tenant, 'create').mockImplementation(async (args) => ({
      ...defaultTenant,
      ...(args?.data ?? {}),
    }));
    vi.spyOn(prisma.whatsAppInstance, 'findUnique').mockResolvedValue(defaultInstance as never);
    vi.spyOn(prisma.whatsAppInstance, 'create').mockImplementation(async () => {
      throw new Error('unexpected instance creation');
    });
    vi.spyOn(prisma.whatsAppInstance, 'update').mockImplementation(async (args) => ({
      ...defaultInstance,
      ...(args?.data ?? {}),
    }));
  };

  it('reactivates a paused campaign when allowed', async () => {
    mockTenantAndInstance();

    const existingCampaign = {
      id: 'campaign-1',
      tenantId: 'tenant-1',
      agreementId: 'agreement-1',
      agreementName: 'Agreement 1',
      name: 'Agreement 1 • instance-1',
      status: 'paused',
      metadata: { history: [] } as Prisma.JsonValue,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      whatsappInstanceId: 'instance-1',
      whatsappInstance: {
        id: 'instance-1',
        name: 'Instance One',
      },
    } satisfies Record<string, unknown>;

    vi.spyOn(prisma.campaign, 'findFirst').mockResolvedValue(
      existingCampaign as unknown as Prisma.CampaignGetPayload<{ include: { whatsappInstance: true } }>
    );

    const updateSpy = vi.spyOn(prisma.campaign, 'update').mockImplementation(async (args) => ({
      ...existingCampaign,
      status: args.data.status as string,
      metadata: args.data.metadata as Prisma.JsonValue,
      updatedAt: new Date('2024-02-01T00:00:00.000Z'),
    }));

    const createSpy = vi.spyOn(prisma.campaign, 'create').mockRejectedValue(
      new Error('should not create campaign when updating existing')
    );

    const app = buildApp();
    const response = await request(app).post('/').send({
      agreementId: 'agreement-1',
      agreementName: 'Agreement 1',
      instanceId: 'instance-1',
      status: 'active',
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: expect.objectContaining({ status: 'active' }),
    });

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const updateArgs = updateSpy.mock.calls[0]?.[0];
    expect(updateArgs?.data?.status).toBe('active');
    const metadata = updateArgs?.data?.metadata as Prisma.JsonObject;
    const history = Array.isArray(metadata?.history)
      ? (metadata?.history as Array<Record<string, unknown>>)
      : [];
    expect(history.map((entry) => entry?.action)).toEqual(
      expect.arrayContaining(['status-changed', 'reactivated'])
    );
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('creates a new campaign when the latest one has ended', async () => {
    mockTenantAndInstance();

    const endedCampaign = {
      id: 'campaign-1',
      tenantId: 'tenant-1',
      agreementId: 'agreement-1',
      agreementName: 'Agreement 1',
      name: 'Agreement 1 • instance-1',
      status: 'ended',
      metadata: { history: [] } as Prisma.JsonValue,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      whatsappInstanceId: 'instance-1',
      whatsappInstance: {
        id: 'instance-1',
        name: 'Instance One',
      },
    } satisfies Record<string, unknown>;

    vi.spyOn(prisma.campaign, 'findFirst').mockResolvedValue(
      endedCampaign as unknown as Prisma.CampaignGetPayload<{ include: { whatsappInstance: true } }>
    );

    const updateSpy = vi.spyOn(prisma.campaign, 'update').mockImplementation(async (args) => ({
      ...endedCampaign,
      whatsappInstanceId: args?.data?.whatsappInstanceId ?? null,
      metadata: args?.data?.metadata as Prisma.JsonValue,
      updatedAt: new Date('2024-02-01T00:00:00.000Z'),
    }));

    const createSpy = vi.spyOn(prisma.campaign, 'create').mockImplementation(async (args) => ({
      id: 'campaign-2',
      tenantId: 'tenant-1',
      agreementId: args.data.agreementId as string,
      agreementName: args.data.agreementName as string,
      name: args.data.name as string,
      status: args.data.status as string,
      metadata: args.data.metadata as Prisma.JsonValue,
      createdAt: new Date('2024-03-01T00:00:00.000Z'),
      updatedAt: new Date('2024-03-01T00:00:00.000Z'),
      whatsappInstanceId: args.data.whatsappInstanceId as string,
      whatsappInstance: {
        id: 'instance-1',
        name: 'Instance One',
      },
    }));

    const app = buildApp();
    const response = await request(app).post('/').send({
      agreementId: 'agreement-1',
      agreementName: 'Agreement 1',
      instanceId: 'instance-1',
      status: 'active',
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      data: expect.objectContaining({ status: 'active' }),
    });
    expect(response.body.data.id).toBe('campaign-2');
    expect(response.body.data.id).not.toBe(endedCampaign.id);

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy.mock.invocationCallOrder?.[0]).toBeLessThan(createSpy.mock.invocationCallOrder?.[0] ?? Infinity);

    const releaseArgs = updateSpy.mock.calls[0]?.[0];
    expect(releaseArgs?.data?.whatsappInstanceId).toBeNull();
    const releaseMetadata = releaseArgs?.data?.metadata as Prisma.JsonObject;
    const releaseHistory = Array.isArray(releaseMetadata?.history)
      ? (releaseMetadata?.history as Array<Record<string, unknown>>)
      : [];
    expect(releaseHistory.map((entry) => entry?.action)).toContain('instance-released');

    const createArgs = createSpy.mock.calls[0]?.[0];
    expect(createArgs?.data?.status).toBe('active');
    const metadata = createArgs?.data?.metadata as Prisma.JsonObject;
    const history = Array.isArray(metadata?.history)
      ? (metadata?.history as Array<Record<string, unknown>>)
      : [];
    expect(history.map((entry) => entry?.action)).toEqual(
      expect.arrayContaining(['created', 'reactivated'])
    );
  });

  it('returns the requested status when creating a new campaign', async () => {
    mockTenantAndInstance();

    vi.spyOn(prisma.campaign, 'findFirst').mockResolvedValue(null);

    const createSpy = vi.spyOn(prisma.campaign, 'create').mockImplementation(async (args) => ({
      id: 'campaign-3',
      tenantId: 'tenant-1',
      agreementId: args.data.agreementId as string,
      agreementName: args.data.agreementName as string,
      name: args.data.name as string,
      status: args.data.status as string,
      metadata: args.data.metadata as Prisma.JsonValue,
      createdAt: new Date('2024-03-05T00:00:00.000Z'),
      updatedAt: new Date('2024-03-05T00:00:00.000Z'),
      whatsappInstanceId: args.data.whatsappInstanceId as string,
      whatsappInstance: {
        id: 'instance-1',
        name: 'Instance One',
      },
    }));

    vi.spyOn(prisma.campaign, 'update').mockRejectedValue(new Error('should not update when creating new'));

    const app = buildApp();
    const response = await request(app).post('/').send({
      agreementId: 'agreement-2',
      agreementName: 'Agreement 2',
      instanceId: 'instance-1',
      status: 'paused',
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      data: expect.objectContaining({ status: 'paused' }),
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'paused' }),
      })
    );
  });

  it('reuses existing WhatsApp instance when payload references broker id', async () => {
    const tenantRecord = {
      id: 'tenant-broker',
      name: 'Tenant Broker',
      slug: 'tenant-broker',
      settings: {} as Record<string, unknown>,
    };

    const canonicalInstance = {
      id: '551199998888@s.whatsapp.net',
      tenantId: tenantRecord.id,
      name: 'WhatsApp Principal',
      brokerId: 'broker-alias',
      status: 'connected',
      connected: true,
      metadata: {} as Record<string, unknown>,
    };

    vi.spyOn(prisma.tenant, 'findFirst').mockResolvedValue(tenantRecord as never);
    vi.spyOn(prisma.tenant, 'create').mockResolvedValue(tenantRecord as never);

    const findUniqueSpy = vi
      .spyOn(prisma.whatsAppInstance, 'findUnique')
      .mockImplementation(async (args) => {
        if (args?.where && 'id' in args.where && args.where.id === 'broker-alias') {
          return null;
        }
        if (args?.where && 'brokerId' in args.where && args.where.brokerId === 'broker-alias') {
          return canonicalInstance as never;
        }
        return null;
      });

    const findFirstSpy = vi
      .spyOn(prisma.whatsAppInstance, 'findFirst')
      .mockResolvedValue(null as never);

    const createInstanceSpy = vi
      .spyOn(prisma.whatsAppInstance, 'create')
      .mockRejectedValue(new Error('should not create placeholder instance'));

    vi.spyOn(prisma.whatsAppInstance, 'update').mockResolvedValue(canonicalInstance as never);

    vi.spyOn(prisma.campaign, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.campaign, 'update').mockRejectedValue(
      new Error('should not update when creating via broker id')
    );

    const createdCampaign = {
      id: 'campaign-broker-1',
      tenantId: tenantRecord.id,
      agreementId: 'agreement-broker',
      agreementName: 'Agreement Broker',
      name: 'Agreement Broker • WhatsApp Principal',
      status: 'active',
      metadata: { history: [] } as Prisma.JsonValue,
      createdAt: new Date('2024-06-01T00:00:00.000Z'),
      updatedAt: new Date('2024-06-01T00:00:00.000Z'),
      whatsappInstanceId: canonicalInstance.id,
      whatsappInstance: {
        id: canonicalInstance.id,
        name: canonicalInstance.name,
      },
    };

    const createCampaignSpy = vi
      .spyOn(prisma.campaign, 'create')
      .mockResolvedValue(createdCampaign as never);

    const app = buildApp();
    const response = await request(app).post('/').send({
      agreementId: 'agreement-broker',
      agreementName: 'Agreement Broker',
      instanceId: 'broker-alias',
      name: 'Agreement Broker • WhatsApp Principal',
      status: 'active',
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      data: expect.objectContaining({
        id: createdCampaign.id,
        instanceId: canonicalInstance.id,
        instanceName: canonicalInstance.name,
        status: 'active',
      }),
    });

    expect(findUniqueSpy).toHaveBeenCalledWith({ where: { id: 'broker-alias' } });
    expect(findUniqueSpy).toHaveBeenCalledWith({ where: { brokerId: 'broker-alias' } });
    expect(findFirstSpy).not.toHaveBeenCalled();
    expect(createInstanceSpy).not.toHaveBeenCalled();

    const createArgs = createCampaignSpy.mock.calls[0]?.[0];
    expect(createArgs?.data?.whatsappInstanceId).toBe(canonicalInstance.id);
  });

  it('returns the existing campaign when creation hits a unique constraint', async () => {
    mockTenantAndInstance();

    const existingCampaign = {
      id: 'campaign-existing',
      tenantId: 'tenant-1',
      agreementId: 'agreement-3',
      agreementName: 'Agreement 3',
      name: 'Campaign 3',
      status: 'active',
      metadata: { history: [] } as Prisma.JsonValue,
      createdAt: new Date('2024-03-10T00:00:00.000Z'),
      updatedAt: new Date('2024-03-10T00:00:00.000Z'),
      whatsappInstanceId: 'instance-1',
      whatsappInstance: {
        id: 'instance-1',
        name: 'Instance One',
      },
    } satisfies Record<string, unknown>;

    const findFirstSpy = vi
      .spyOn(prisma.campaign, 'findFirst')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingCampaign as never);

    const createError = new Prisma.PrismaClientKnownRequestError('unique violation', {
      code: 'P2002',
      clientVersion: '5.7.1',
    });

    const createSpy = vi.spyOn(prisma.campaign, 'create').mockRejectedValue(createError);

    const app = buildApp();
    const response = await request(app).post('/').send({
      agreementId: 'agreement-3',
      agreementName: 'Agreement 3',
      instanceId: 'instance-1',
      status: 'active',
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: expect.objectContaining({
        id: 'campaign-existing',
        status: 'active',
      }),
    });
    expect(findFirstSpy).toHaveBeenCalledTimes(2);
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it('returns a friendly error when storage is temporarily unavailable during creation', async () => {
    mockTenantAndInstance();

    vi.spyOn(prisma.campaign, 'findFirst').mockResolvedValue(null);

    const connectivityError = new Prisma.PrismaClientKnownRequestError('storage unavailable', {
      code: 'P1001',
      clientVersion: '5.7.1',
    });

    const createSpy = vi.spyOn(prisma.campaign, 'create').mockRejectedValue(connectivityError);
    const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => logger);

    const app = buildApp();
    const response = await request(app).post('/').send({
      agreementId: 'agreement-4',
      agreementName: 'Agreement 4',
      instanceId: 'instance-1',
      status: 'active',
    });

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'CAMPAIGN_STORAGE_UNAVAILABLE',
      },
    });
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(loggerSpy).toHaveBeenCalledWith('Failed to create campaign due to Prisma error', {
      agreementId: 'agreement-4',
      error: expect.objectContaining({ message: 'storage unavailable' }),
      instanceId: 'instance-1',
      mappedError: expect.objectContaining({
        code: 'CAMPAIGN_STORAGE_UNAVAILABLE',
        status: 503,
        type: 'connectivity',
      }),
      tenantId: 'tenant-1',
    });
  });

  it('returns a warning payload when metrics enrichment fails during creation', async () => {
    mockTenantAndInstance();

    vi.spyOn(prisma.campaign, 'findFirst').mockResolvedValue(null);

    const createdCampaignMetadata = {
      history: [],
    } as Prisma.JsonValue;

    const createSpy = vi.spyOn(prisma.campaign, 'create').mockImplementation(async (args) => ({
      id: 'campaign-4',
      tenantId: 'tenant-1',
      agreementId: args.data.agreementId as string,
      agreementName: args.data.agreementName as string,
      name: args.data.name as string,
      status: args.data.status as string,
      metadata: createdCampaignMetadata,
      createdAt: new Date('2024-03-10T00:00:00.000Z'),
      updatedAt: new Date('2024-03-10T00:00:00.000Z'),
      whatsappInstanceId: args.data.whatsappInstanceId as string,
      whatsappInstance: {
        id: 'instance-1',
        name: 'Instance One',
      },
    }));

    getCampaignMetricsMock.mockImplementation(async () => {
      throw new Error('storage unavailable');
    });

    const app = buildApp();
    const response = await request(app).post('/').send({
      agreementId: 'agreement-3',
      agreementName: 'Agreement 3',
      instanceId: 'instance-1',
      status: 'active',
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      warnings: [{ code: 'CAMPAIGN_METRICS_UNAVAILABLE' }],
      data: expect.objectContaining({
        id: 'campaign-4',
        metrics: expect.objectContaining({
          total: 0,
          allocated: 0,
          contacted: 0,
          won: 0,
          lost: 0,
          averageResponseSeconds: 0,
        }),
      }),
    });

    expect(getCampaignMetricsMock).toHaveBeenCalled();
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it('normalizes WhatsApp instance tenant when the referenced tenant is missing', async () => {
    const ghostTenantId = 'ghost-tenant';
    const tenantFindFirstSpy = vi.spyOn(prisma.tenant, 'findFirst').mockImplementation(async (args) => {
      const orConditions = Array.isArray(args?.where?.OR) ? args.where.OR : [];
      const slugCondition = (args?.where as { slug?: string } | undefined)?.slug;
      const slugMatchesAgreement = orConditions.some((condition) => condition?.slug === 'agreement-ghost');

      if (orConditions.some((condition) => condition?.id === defaultTenant.id)) {
        return defaultTenant as never;
      }

      if (orConditions.some((condition) => condition?.id === ghostTenantId)) {
        return null;
      }

      if (slugMatchesAgreement || slugCondition === ghostTenantId || slugCondition === 'agreement-ghost') {
        return defaultTenant as never;
      }

      return null;
    });

    const tenantCreateError = new Prisma.PrismaClientKnownRequestError('slug conflict', {
      code: 'P2002',
      clientVersion: '5.7.1',
    });

    const tenantCreateSpy = vi.spyOn(prisma.tenant, 'create').mockRejectedValue(tenantCreateError);

    const ghostInstance = {
      ...defaultInstance,
      tenantId: ghostTenantId,
    } satisfies typeof defaultInstance;

    const instanceFindSpy = vi.spyOn(prisma.whatsAppInstance, 'findUnique').mockResolvedValue(ghostInstance as never);
    const instanceUpdateSpy = vi.spyOn(prisma.whatsAppInstance, 'update').mockImplementation(async (args) => ({
      ...ghostInstance,
      ...(args?.data ?? {}),
    }));

    vi.spyOn(prisma.campaign, 'findFirst').mockResolvedValue(null);

    const createSpy = vi.spyOn(prisma.campaign, 'create').mockImplementation(async (args) => ({
      id: 'campaign-ghost',
      tenantId: args.data.tenantId as string,
      agreementId: args.data.agreementId as string,
      agreementName: args.data.agreementName as string,
      name: args.data.name as string,
      status: args.data.status as string,
      metadata: args.data.metadata as Prisma.JsonValue,
      createdAt: new Date('2024-03-20T00:00:00.000Z'),
      updatedAt: new Date('2024-03-20T00:00:00.000Z'),
      whatsappInstanceId: args.data.whatsappInstanceId as string,
      whatsappInstance: {
        id: ghostInstance.id,
        name: ghostInstance.name,
      },
    }));

    const app = buildApp();
    const response = await request(app).post('/').send({
      agreementId: 'agreement-ghost',
      agreementName: 'Agreement Ghost',
      instanceId: ghostInstance.id,
      status: 'active',
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      data: expect.objectContaining({
        id: 'campaign-ghost',
        instanceId: ghostInstance.id,
        status: 'active',
      }),
    });

    expect(tenantFindFirstSpy).toHaveBeenCalled();
    expect(tenantCreateSpy).toHaveBeenCalledTimes(1);
    expect(instanceFindSpy).toHaveBeenCalledWith({ where: { id: ghostInstance.id } });
    expect(instanceUpdateSpy).toHaveBeenCalledWith({
      where: { id: ghostInstance.id },
      data: { tenantId: defaultTenant.id },
    });
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: defaultTenant.id }),
      })
    );
  });
});

describe('DELETE /campaigns/:id', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('marks the campaign as ended and detaches the WhatsApp instance', async () => {
    const existingCampaign = {
      id: 'campaign-1',
      tenantId: 'tenant-1',
      agreementId: 'agreement-1',
      agreementName: 'Agreement 1',
      name: 'Campaign 1',
      status: 'active',
      metadata: { history: [] } as Prisma.JsonValue,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      whatsappInstanceId: 'instance-1',
      whatsappInstance: {
        id: 'instance-1',
        name: 'Instance One',
      },
    } satisfies Record<string, unknown>;

    const findSpy = vi
      .spyOn(prisma.campaign, 'findFirst')
      .mockResolvedValue(existingCampaign as unknown as Prisma.CampaignGetPayload<{ include: { whatsappInstance: true } }>);

    const updateSpy = vi.spyOn(prisma.campaign, 'update').mockImplementation(async (args) => ({
      ...existingCampaign,
      status: args.data.status as string,
      metadata: args.data.metadata as Prisma.JsonValue,
      whatsappInstanceId: null,
      updatedAt: new Date('2024-03-01T00:00:00.000Z'),
      whatsappInstance: null,
    }));

    const app = buildApp();
    const response = await request(app).delete('/campaign-1');

    expect(response.status).toBe(200);
    expect(findSpy).toHaveBeenCalledWith({
      where: { id: 'campaign-1', tenantId: 'tenant-1' },
      include: {
        whatsappInstance: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'campaign-1' },
        data: expect.objectContaining({
          status: 'ended',
          whatsappInstanceId: null,
          metadata: expect.objectContaining({ deletedAt: expect.any(String), deletedBy: 'user-1' }),
        }),
      })
    );

    expect(response.body).toMatchObject({
      success: true,
      data: expect.objectContaining({
        id: 'campaign-1',
        status: 'ended',
        instanceId: null,
        instanceName: null,
      }),
    });
  });
});
