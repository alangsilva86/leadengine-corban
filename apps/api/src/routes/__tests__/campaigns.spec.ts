import express, { type Request, type RequestHandler } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listCampaignsMock = vi.fn();
const createCampaignMock = vi.fn();
const updateCampaignMock = vi.fn();
const deleteCampaignMock = vi.fn();

vi.mock('../../middleware/auth', () => ({
  requireTenant: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../services/campaigns-service', async () => {
  const actual = await vi.importActual<typeof import('../../services/campaigns-service')>(
    '../../services/campaigns-service'
  );
  return {
    ...actual,
    listCampaigns: listCampaignsMock,
    createCampaign: createCampaignMock,
    updateCampaign: updateCampaignMock,
    deleteCampaign: deleteCampaignMock,
  };
});

import { CampaignServiceError } from '../../services/campaigns-service';
import { campaignsRouter } from '../campaigns';
import type { CampaignDTO } from '../campaigns.types';
import { errorHandler } from '../../middleware/error-handler';

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

describe('campaigns router integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    listCampaignsMock.mockReset();
    createCampaignMock.mockReset();
    updateCampaignMock.mockReset();
    deleteCampaignMock.mockReset();
  });

  describe('GET /campaigns', () => {
    it('responds with items from the service and forwards filters', async () => {
      const now = new Date();
      listCampaignsMock.mockResolvedValueOnce({
        items: [
          {
            id: 'campaign-1',
            tenantId: 'tenant-1',
            agreementId: 'agr-1',
            agreementName: 'Agreement 1',
            name: 'Campaign 1',
            status: 'active',
            metadata: {},
            instanceId: 'inst-1',
            instanceName: 'Instance 1',
            whatsappInstanceId: 'inst-1',
            createdAt: now,
            updatedAt: now,
            metrics: {
              total: 0,
              allocated: 0,
              contacted: 0,
              won: 0,
              lost: 0,
              averageResponseSeconds: 0,
              budget: null,
              cplTarget: null,
              cpl: null,
            },
            productType: null,
            marginType: null,
            strategy: null,
            tags: [],
          },
        ],
        meta: { source: 'store' },
      });

      const app = buildApp();
      const response = await request(app).get('/?status=active&agreementId=agr-1');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        requestId: expect.any(String),
        items: [expect.objectContaining({ id: 'campaign-1' })],
        meta: { source: 'store' },
      });
      expect(listCampaignsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          filters: expect.objectContaining({ agreementId: 'agr-1', statuses: ['active'] }),
          requestId: expect.any(String),
        })
      );
    });

    it('maps service errors to HTTP responses', async () => {
      listCampaignsMock.mockRejectedValueOnce(new CampaignServiceError('TEST', 'Falha', 418));

      const app = buildApp();
      const response = await request(app).get('/');

      expect(response.status).toBe(418);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'TEST', message: 'Falha' },
      });
    });
  });

  describe('POST /campaigns', () => {
    it('normalises body payload before delegating to the service', async () => {
      const now = new Date();
      createCampaignMock.mockResolvedValueOnce({
        data: {
          id: 'campaign-2',
          tenantId: 'tenant-1',
          agreementId: 'agr-1',
          agreementName: 'Agreement 1',
          name: 'Campaign 2',
          status: 'draft',
          metadata: {},
          instanceId: 'inst-1',
          instanceName: 'Instance 1',
          whatsappInstanceId: 'inst-1',
          createdAt: now,
          updatedAt: now,
          metrics: {
            total: 0,
            allocated: 0,
            contacted: 0,
            won: 0,
            lost: 0,
            averageResponseSeconds: 0,
            budget: null,
            cplTarget: null,
            cpl: null,
          },
          productType: 'generic',
          marginType: 'percentage',
          strategy: null,
          tags: ['generic', 'percentage'],
        },
      });

      const app = buildApp();
      const response = await request(app)
        .post('/')
        .send({
          agreementId: 'agr-1',
          instanceId: 'inst-1',
          productType: 'Generic ',
          marginType: 'percentage',
          tags: ['foo'],
        });

      expect(response.status).toBe(201);
      expect(createCampaignMock).toHaveBeenCalledWith(
        expect.objectContaining({
          agreementId: 'agr-1',
          instanceId: 'inst-1',
          productType: 'Generic',
          tags: expect.arrayContaining(['foo', 'Generic', 'percentage']),
          metadata: expect.objectContaining({ requestId: expect.any(String) }),
        })
      );
      expect(response.body).toMatchObject({ success: true, data: { id: 'campaign-2' } });
    });

    it('returns service error payloads when creation fails', async () => {
      createCampaignMock.mockRejectedValueOnce(
        new CampaignServiceError('INVALID_CAMPAIGN_DATA', 'Dados inválidos', 400)
      );

      const app = buildApp();
      const response = await request(app)
        .post('/')
        .send({ agreementId: 'agr-1', instanceId: 'inst-1', productType: 'generic' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'INVALID_CAMPAIGN_DATA' },
      });
    });
  });

  describe('PATCH /campaigns/:id', () => {
    it('propagates update result', async () => {
      updateCampaignMock.mockResolvedValueOnce({
        data: { id: 'campaign-1', status: 'active' } as CampaignDTO,
      });

      const app = buildApp();
      const response = await request(app)
        .patch('/campaign-1')
        .send({ status: 'paused' });

      expect(response.status).toBe(200);
      expect(updateCampaignMock).toHaveBeenCalledWith(
        expect.objectContaining({ campaignId: 'campaign-1', status: 'paused' })
      );
      expect(response.body).toMatchObject({ success: true });
    });
  });

  describe('DELETE /campaigns/:id', () => {
    it('delegates deletion to the service', async () => {
      deleteCampaignMock.mockResolvedValueOnce({ id: 'campaign-1' } as CampaignDTO);

      const app = buildApp();
      const response = await request(app).delete('/campaign-1');

      expect(response.status).toBe(200);
      expect(deleteCampaignMock).toHaveBeenCalledWith(
        expect.objectContaining({ campaignId: 'campaign-1', tenantId: 'tenant-1' })
      );
      expect(response.body).toMatchObject({ success: true });
    });
  });
});
