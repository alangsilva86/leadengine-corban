import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { integrationWebhooksRouter } from './webhooks';

vi.mock('../lib/prisma', () => {
  const instanceMock = {
    findUnique: vi.fn(),
  };
  const campaignMock = {
    findMany: vi.fn(),
  };

  return {
    prisma: {
      whatsAppInstance: instanceMock,
      campaign: campaignMock,
    },
  };
});

vi.mock('../data/lead-allocation-store', () => ({
  addAllocations: vi.fn(async () => ({ newlyAllocated: [{ allocationId: 'alloc-1' }], summary: { total: 1, contacted: 0, won: 0, lost: 0 } })),
  listAllocations: vi.fn(),
  updateAllocation: vi.fn(),
}));

// Ensure inbound processor is registered
await import('../features/whatsapp-inbound/workers/inbound-processor');

const { prisma } = await import('../lib/prisma');
const { addAllocations } = await import('../data/lead-allocation-store');

const createApp = () => {
  const app = express();
  app.use(express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }));
  app.use('/api/integrations', integrationWebhooksRouter);
  return app;
};

describe('WhatsApp webhook (integration)', () => {
  beforeEach(() => {
    (prisma.whatsAppInstance.findUnique as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.campaign.findMany as unknown as ReturnType<typeof vi.fn>).mockReset();
    (addAllocations as unknown as ReturnType<typeof vi.fn>).mockReset();
    process.env.WHATSAPP_WEBHOOK_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.WHATSAPP_WEBHOOK_API_KEY;
  });

  it('rejects webhook with invalid API key', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/integrations/whatsapp/webhook')
      .send({});

    expect(response.status).toBe(401);
  });

  it('queues inbound message and creates allocation', async () => {
    (prisma.whatsAppInstance.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'inst-1',
      tenantId: 'tenant-1',
    });

    (prisma.campaign.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'camp-1',
        tenantId: 'tenant-1',
        agreementId: 'agreement-1',
        whatsappInstanceId: 'inst-1',
        status: 'active',
      },
    ]);

    const app = createApp();

    const payload = {
      instanceId: 'inst-1',
      event: 'message',
      direction: 'inbound',
      timestamp: Date.now(),
      from: {
        phone: '+5511999998888',
        name: 'Maria',
      },
      message: {
        id: 'wamid.123',
        type: 'text',
        text: 'Olá',
      },
    };

    const response = await request(app)
      .post('/api/integrations/whatsapp/webhook')
      .set('x-api-key', 'test-key')
      .send(payload);

    expect(response.status).toBe(202);

    // allow event loop to flush async handlers
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(prisma.whatsAppInstance.findUnique).toHaveBeenCalledWith({ where: { id: 'inst-1' } });
    expect(prisma.campaign.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        whatsappInstanceId: 'inst-1',
        status: 'active',
      },
    });
    expect(addAllocations).toHaveBeenCalled();
  });
});
