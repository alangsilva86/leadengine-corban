import express, { type Request, type RequestHandler } from 'express';
import request from 'supertest';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '../../lib/prisma';
import { reportsRouter } from '../reports';
import { errorHandler } from '../../middleware/error-handler';

type AllocationRecord = Awaited<ReturnType<typeof prisma.leadAllocation.findMany>>[number];

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
      permissions: ['reports:read'],
    };
    next();
  }) as RequestHandler);
  app.use('/', reportsRouter);
  app.use(errorHandler as unknown as RequestHandler);
  return app;
};

describe('GET /reports/metrics', () => {
  const findManySpy = vi.spyOn(prisma.leadAllocation, 'findMany');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-04-10T12:00:00.000Z'));
    findManySpy.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('aggregates metrics by agreement by default', async () => {
    const allocationA: AllocationRecord = {
      status: 'allocated',
      receivedAt: new Date('2024-04-08T09:00:00.000Z'),
      updatedAt: new Date('2024-04-08T09:00:00.000Z'),
      campaignId: 'campaign-1',
      campaign: {
        id: 'campaign-1',
        name: 'Campanha WhatsApp',
        agreementId: 'agreement-1',
        agreementName: 'SAEC Goiânia',
        whatsappInstanceId: 'instance-1',
        productType: 'consignado',
        marginType: 'gold',
        strategy: 'push',
        metadata: { margin: 1.5 },
        whatsappInstance: {
          id: 'instance-1',
          name: 'Instância Norte',
        },
      },
    } as AllocationRecord;

    const allocationB: AllocationRecord = {
      status: 'contacted',
      receivedAt: new Date('2024-04-08T10:00:00.000Z'),
      updatedAt: new Date('2024-04-08T10:30:00.000Z'),
      campaignId: 'campaign-1',
      campaign: allocationA.campaign,
    } as AllocationRecord;

    const allocationC: AllocationRecord = {
      status: 'won',
      receivedAt: new Date('2024-04-09T14:00:00.000Z'),
      updatedAt: new Date('2024-04-09T15:00:00.000Z'),
      campaignId: 'campaign-1',
      campaign: allocationA.campaign,
    } as AllocationRecord;

    const allocationD: AllocationRecord = {
      status: 'lost',
      receivedAt: new Date('2024-04-09T16:00:00.000Z'),
      updatedAt: new Date('2024-04-09T16:45:00.000Z'),
      campaignId: 'campaign-2',
      campaign: {
        id: 'campaign-2',
        name: 'Campanha EConsig',
        agreementId: 'agreement-2',
        agreementName: 'EConsig Londrina',
        whatsappInstanceId: 'instance-2',
        productType: 'credito',
        marginType: 'silver',
        strategy: 'pull',
        metadata: { margin: 1.1 },
        whatsappInstance: {
          id: 'instance-2',
          name: 'Instância Sul',
        },
      },
    } as AllocationRecord;

    findManySpy.mockResolvedValue([allocationA, allocationB, allocationC, allocationD]);

    const app = buildApp();
    const response = await request(app).get('/metrics').set('x-tenant-id', 'tenant-1');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      groupBy: 'agreement',
      summary: {
        total: 4,
        allocated: 1,
        contacted: 1,
        won: 1,
        lost: 1,
        averageResponseSeconds: 2700,
        conversionRate: 0.25,
      },
      totalGroups: 2,
    });

    expect(response.body.data.groups).toHaveLength(2);
    const [firstGroup] = response.body.data.groups;
    expect(firstGroup).toMatchObject({
      label: 'SAEC Goiânia',
      metrics: {
        total: 3,
        won: 1,
        contacted: 1,
        allocated: 1,
        lost: 0,
        conversionRate: 0.3333,
      },
      breakdown: [
        {
          date: '2024-04-08',
          metrics: expect.objectContaining({ total: 2, contacted: 1, allocated: 1 }),
        },
        {
          date: '2024-04-09',
          metrics: expect.objectContaining({ total: 1, won: 1 }),
        },
      ],
    });
    expect(firstGroup.metadata.marginValue).toBe(1.5);

    expect(findManySpy).toHaveBeenCalledTimes(1);
    const [{ where }] = findManySpy.mock.calls;
    expect(where).toMatchObject({
      tenantId: 'tenant-1',
      receivedAt: {
        gte: expect.any(Date),
        lte: expect.any(Date),
      },
    });
    expect((where.receivedAt as { gte: Date; lte: Date }).lte.toISOString()).toBe('2024-04-10T12:00:00.000Z');
  });

  it('supports grouping by instance with filters and limits', async () => {
    const baseCampaign = {
      id: 'campaign-3',
      name: 'Campanha Base',
      agreementId: 'agreement-3',
      agreementName: 'Convênio Base',
      whatsappInstanceId: 'instance-3',
      productType: 'consignado',
      marginType: 'gold',
      strategy: 'push',
      metadata: { margin: 1.4 },
      whatsappInstance: { id: 'instance-3', name: 'Instância Centro' },
    } as AllocationRecord['campaign'];

    const otherCampaign = {
      id: 'campaign-4',
      name: 'Campanha Secundária',
      agreementId: 'agreement-4',
      agreementName: 'Convênio Norte',
      whatsappInstanceId: 'instance-4',
      productType: 'credito',
      marginType: 'silver',
      strategy: 'pull',
      metadata: { margin: 1.2 },
      whatsappInstance: { id: 'instance-4', name: 'Instância Leste' },
    } as AllocationRecord['campaign'];

    findManySpy.mockResolvedValue([
      {
        status: 'contacted',
        receivedAt: new Date('2024-04-05T09:00:00.000Z'),
        updatedAt: new Date('2024-04-05T09:10:00.000Z'),
        campaignId: 'campaign-3',
        campaign: baseCampaign,
      } as AllocationRecord,
      {
        status: 'won',
        receivedAt: new Date('2024-04-06T11:00:00.000Z'),
        updatedAt: new Date('2024-04-06T11:45:00.000Z'),
        campaignId: 'campaign-3',
        campaign: baseCampaign,
      } as AllocationRecord,
      {
        status: 'lost',
        receivedAt: new Date('2024-04-07T14:00:00.000Z'),
        updatedAt: new Date('2024-04-07T15:30:00.000Z'),
        campaignId: 'campaign-4',
        campaign: otherCampaign,
      } as AllocationRecord,
    ]);

    const app = buildApp();
    const response = await request(app)
      .get('/metrics?groupBy=instance&limit=1&agreementId=agreement-3')
      .set('x-tenant-id', 'tenant-1');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.groups).toHaveLength(1);
    expect(response.body.data.groups[0]).toMatchObject({
      label: 'Instância Centro',
      metrics: {
        total: 2,
        won: 1,
        contacted: 1,
        lost: 0,
        conversionRate: 0.5,
      },
    });

    expect(findManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          campaign: { agreementId: 'agreement-3' },
        }),
        orderBy: { receivedAt: 'asc' },
      })
    );
  });
});
