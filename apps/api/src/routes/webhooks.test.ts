import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message, Ticket } from '@ticketz/core';

import { integrationWebhooksRouter } from './webhooks';

vi.mock('../lib/prisma', () => {
  const instanceMock = {
    findUnique: vi.fn(),
  };
  const campaignMock = {
    findMany: vi.fn(),
  };
  const queueMock = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  };
  const contactMock = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  };

  return {
    prisma: {
      whatsAppInstance: instanceMock,
      campaign: campaignMock,
      queue: queueMock,
      contact: contactMock,
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

const { whatsappEventQueueEmitter } = await import('../features/whatsapp-inbound/queue/event-queue');

const { prisma } = await import('../lib/prisma');
const { addAllocations } = await import('../data/lead-allocation-store');
const { resetInboundLeadServiceTestState } = await import(
  '../features/whatsapp-inbound/services/inbound-lead-service'
);
const ticketsModule = await import('../services/ticket-service');
const createTicketSpy = vi.spyOn(ticketsModule, 'createTicket');
const sendMessageSpy = vi.spyOn(ticketsModule, 'sendMessage');
const socketModule = await import('../lib/socket-registry');
const emitToTenantSpy = vi.spyOn(socketModule, 'emitToTenant').mockImplementation(() => {});

const createApp = () => {
  const app = express();
  const rawParser = express.raw({ type: '*/*' });

  app.use('/api/integrations/whatsapp/webhook', rawParser, (req, _res, next) => {
    const buffer = Buffer.isBuffer(req.body) ? (req.body as Buffer) : Buffer.alloc(0);
    const enrichedReq = req as express.Request & { rawBody?: Buffer; rawBodyParseError?: SyntaxError | null };

    enrichedReq.rawBody = buffer.length > 0 ? buffer : undefined;
    enrichedReq.rawBodyParseError = null;

    if (buffer.length === 0) {
      req.body = {};
      next();
      return;
    }

    const text = buffer.toString('utf8').trim();
    if (!text) {
      req.body = {};
      next();
      return;
    }

    try {
      req.body = JSON.parse(text);
    } catch (error) {
      enrichedReq.rawBodyParseError = error instanceof SyntaxError ? error : new SyntaxError('Invalid JSON');
      req.body = {};
    }

    next();
  });

  app.use(express.json());
  app.use('/api/integrations', integrationWebhooksRouter);
  return app;
};

describe('WhatsApp webhook (integration)', () => {
  beforeEach(() => {
    resetInboundLeadServiceTestState();
    (prisma.whatsAppInstance.findUnique as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.campaign.findMany as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.queue.findFirst as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.queue.findUnique as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.contact.findUnique as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.contact.findFirst as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.contact.update as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.contact.create as unknown as ReturnType<typeof vi.fn>).mockReset();
    (addAllocations as unknown as ReturnType<typeof vi.fn>).mockReset();
    createTicketSpy.mockReset();
    sendMessageSpy.mockReset();
    emitToTenantSpy.mockClear();
    process.env.WHATSAPP_WEBHOOK_API_KEY = 'test-key';

    (prisma.queue.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'queue-1',
      tenantId: 'tenant-1',
    });
    (prisma.queue.findUnique as unknown as ReturnType<typeof vi.fn>).mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      tenantId: 'tenant-1',
    }));
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

  it('returns 400 when webhook payload is not valid JSON', async () => {
    process.env.WHATSAPP_WEBHOOK_API_KEY = 'test-key';
    const app = createApp();

    const response = await request(app)
      .post('/api/integrations/whatsapp/webhook')
      .set('x-api-key', 'test-key')
      .set('content-type', 'application/json')
      .send('{"invalid"');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      ok: false,
      error: { code: 'INVALID_WEBHOOK_JSON' },
    });
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

    (prisma.contact.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.contact.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.contact.create as unknown as ReturnType<typeof vi.fn>).mockImplementation(async ({ data }) => ({
      id: 'contact-1',
      ...data,
    }));

    createTicketSpy.mockResolvedValue({ id: 'ticket-1' } as unknown as Ticket);
    sendMessageSpy.mockResolvedValue({ id: 'message-1' } as unknown as Message);

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

    const waitForProcessed = new Promise<void>((resolve, reject) => {
      const onProcessed = () => {
        clearTimeout(timeoutId);
        whatsappEventQueueEmitter.off('processed', onProcessed);
        resolve();
      };

      const timeoutId = setTimeout(() => {
        whatsappEventQueueEmitter.off('processed', onProcessed);
        reject(new Error('Timed out waiting for WhatsApp event processing'));
      }, 200);

      whatsappEventQueueEmitter.on('processed', onProcessed);
    });

    const response = await request(app)
      .post('/api/integrations/whatsapp/webhook')
      .set('x-api-key', 'test-key')
      .send(payload);

    expect(response.status).toBe(202);

    await waitForProcessed;

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
