import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message, Ticket } from '@ticketz/core';

import { integrationWebhooksRouter } from './webhooks';

const findOrCreateOpenTicketByChatMock = vi.fn();
const upsertMessageByExternalIdMock = vi.fn();

vi.mock('@ticketz/storage', () => ({
  findOrCreateOpenTicketByChat: findOrCreateOpenTicketByChatMock,
  upsertMessageByExternalId: upsertMessageByExternalIdMock,
}));

vi.mock('../lib/prisma', () => {
  const instanceMock = {
    findUnique: vi.fn(),
    upsert: vi.fn(),
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
  const ticketMock = {
    findUnique: vi.fn(),
  };
  const processedIntegrationEventMock = {
    create: vi.fn(),
  };

  return {
    prisma: {
      whatsAppInstance: instanceMock,
      campaign: campaignMock,
      queue: queueMock,
      contact: contactMock,
      ticket: ticketMock,
      processedIntegrationEvent: processedIntegrationEventMock,
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

const { refreshFeatureFlags } = await import('../config/feature-flags');

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

const waitForNextProcessedEvent = () =>
  new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      whatsappEventQueueEmitter.off('processed', onProcessed);
      reject(new Error('Timed out waiting for WhatsApp event processing'));
    }, 250);

    const onProcessed = () => {
      clearTimeout(timeoutId);
      whatsappEventQueueEmitter.off('processed', onProcessed);
      resolve();
    };

    whatsappEventQueueEmitter.on('processed', onProcessed);
  });

const stubInboundSuccessMocks = () => {
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
  sendMessageSpy.mockResolvedValue({
    id: 'message-1',
    ticketId: 'ticket-1',
    tenantId: 'tenant-1',
    direction: 'INBOUND',
    status: 'SENT',
    content: 'Olá',
    metadata: {},
    createdAt: new Date('2024-01-01T12:00:00.000Z'),
    updatedAt: new Date('2024-01-01T12:00:00.000Z'),
  } as unknown as Message);
};

describe('WhatsApp webhook (integration)', () => {
  beforeEach(() => {
    resetInboundLeadServiceTestState();
    (prisma.whatsAppInstance.findUnique as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.whatsAppInstance.upsert as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.campaign.findMany as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.queue.findFirst as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.queue.findUnique as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.contact.findUnique as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.contact.findFirst as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.contact.update as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.contact.create as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.ticket.findUnique as unknown as ReturnType<typeof vi.fn>).mockReset();
    (addAllocations as unknown as ReturnType<typeof vi.fn>).mockReset();
    createTicketSpy.mockReset();
    sendMessageSpy.mockReset();
    emitToTenantSpy.mockClear();
    findOrCreateOpenTicketByChatMock.mockReset();
    upsertMessageByExternalIdMock.mockReset();
    process.env.WHATSAPP_WEBHOOK_API_KEY = 'test-key';
    delete process.env.WHATSAPP_PASSTHROUGH_MODE;
    refreshFeatureFlags({ whatsappPassthroughMode: false });

    (prisma.queue.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'queue-1',
      tenantId: 'tenant-1',
    });
    (prisma.queue.findUnique as unknown as ReturnType<typeof vi.fn>).mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      tenantId: 'tenant-1',
    }));
    (prisma.ticket.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'ticket-1',
      tenantId: 'tenant-database',
      agreementId: 'agreement-1',
      status: 'OPEN',
      updatedAt: new Date('2024-01-01T12:00:00.000Z'),
      queueId: 'queue-1',
      subject: 'Contato WhatsApp',
      metadata: {},
    });
    findOrCreateOpenTicketByChatMock.mockResolvedValue({
      ticket: {
        id: 'ticket-1',
        tenantId: 'tenant-database',
        agreementId: 'agreement-1',
        status: 'OPEN',
        updatedAt: new Date('2024-01-01T12:00:00.000Z'),
      },
      wasCreated: false,
    });
    upsertMessageByExternalIdMock.mockResolvedValue({
      message: {
        id: 'message-1',
        tenantId: 'tenant-1',
        ticketId: 'ticket-1',
        chatId: 'chat-1',
        direction: 'inbound',
        type: 'text',
        text: 'Olá',
        media: null,
        metadata: {},
        createdAt: new Date('2024-01-01T12:00:01.000Z'),
        externalId: 'wamid.123',
      },
      wasCreated: true,
    });
  });

  afterEach(() => {
    delete process.env.WHATSAPP_WEBHOOK_API_KEY;
    delete process.env.WHATSAPP_WEBHOOK_SIGNATURE_SECRET;
    delete process.env.WHATSAPP_PASSTHROUGH_MODE;
    refreshFeatureFlags({ whatsappPassthroughMode: false });
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

  it('rejects webhook with invalid signature in strict mode', async () => {
    process.env.WHATSAPP_WEBHOOK_SIGNATURE_SECRET = 'signature-secret';
    const app = createApp();

    const response = await request(app)
      .post('/api/integrations/whatsapp/webhook')
      .set('x-api-key', 'test-key')
      .set('x-signature-sha256', 'deadbeef')
      .send({ ping: 'pong' });

    expect(response.status).toBe(401);
  });

  it('queues inbound message and creates allocation', async () => {
    stubInboundSuccessMocks();

    const app = createApp();

    const payload = {
      instanceId: 'inst-1',
      event: 'message',
      direction: 'inbound',
      timestamp: Date.now(),
      tenantId: 'tenant-1',
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

    const waitForProcessed = waitForNextProcessedEvent();

    const response = await request(app)
      .post('/api/integrations/whatsapp/webhook')
      .set('x-api-key', 'test-key')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({ ok: true, queued: expect.any(Number), received: expect.any(Number) })
    );

    await waitForProcessed;

    expect(findOrCreateOpenTicketByChatMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', chatId: expect.any(String) })
    );
    expect(upsertMessageByExternalIdMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', ticketId: 'ticket-1' })
    );
    const emittedEvents = emitToTenantSpy.mock.calls.map(([, event]) => event);
    expect(emittedEvents).toContain('tickets.updated');
    const updatedCall = emitToTenantSpy.mock.calls.find(([, event]) => event === 'tickets.updated');
    expect(updatedCall?.[0]).toBe('tenant-1');
  });

  it('queues inbound message when Authorization bearer header is used', async () => {
    stubInboundSuccessMocks();

    const app = createApp();

    const payload = {
      instanceId: 'inst-1',
      event: 'message',
      direction: 'inbound',
      timestamp: Date.now(),
      from: {
        phone: '+5511987654321',
        name: 'Carlos',
      },
      tenantId: 'tenant-1',
      message: {
        id: 'wamid.321',
        type: 'text',
        text: 'Olá via bearer',
      },
    };

    const waitForProcessed = waitForNextProcessedEvent();

    const response = await request(app)
      .post('/api/integrations/whatsapp/webhook')
      .set('Authorization', 'Bearer test-key')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({ ok: true, queued: expect.any(Number), received: expect.any(Number) })
    );

    await waitForProcessed;

  });

  it('queues inbound message when X-Authorization header provides the token directly', async () => {
    stubInboundSuccessMocks();

    const app = createApp();

    const payload = {
      instanceId: 'inst-1',
      event: 'message',
      direction: 'inbound',
      timestamp: Date.now(),
      from: {
        phone: '+5511912345678',
        name: 'Ana',
      },
      tenantId: 'tenant-1',
      message: {
        id: 'wamid.654',
        type: 'text',
        text: 'Olá via legacy header',
      },
    };

    const waitForProcessed = waitForNextProcessedEvent();

    const response = await request(app)
      .post('/api/integrations/whatsapp/webhook')
      .set('X-Authorization', 'test-key')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({ ok: true, queued: expect.any(Number), received: expect.any(Number) })
    );

    await waitForProcessed;

  });

  it('queues inbound message when payload uses MESSAGE_INBOUND type alias', async () => {
    stubInboundSuccessMocks();

    const app = createApp();

    const payload = {
      type: 'MESSAGE_INBOUND',
      instanceId: 'inst-1',
      timestamp: Date.now(),
      tenantId: 'tenant-1',
      from: {
        phone: '+5511999998888',
        name: 'Maria Alias',
      },
      message: {
        id: 'wamid.456',
        type: 'text',
        text: 'Mensagem via alias',
      },
    };

    const waitForProcessed = waitForNextProcessedEvent();

    const response = await request(app)
      .post('/api/integrations/whatsapp/webhook')
      .set('x-api-key', 'test-key')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({ ok: true, queued: expect.any(Number), received: expect.any(Number) })
    );

    await waitForProcessed;

    expect(findOrCreateOpenTicketByChatMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', chatId: expect.any(String) })
    );
    expect(upsertMessageByExternalIdMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', ticketId: 'ticket-1' })
    );
    const emittedEvents = emitToTenantSpy.mock.calls.map(([, event]) => event);
    expect(emittedEvents).toContain('tickets.updated');
    const updatedCall = emitToTenantSpy.mock.calls.find(([, event]) => event === 'tickets.updated');
    expect(updatedCall?.[0]).toBe('tenant-1');
  });

  it('queues inbound message when direction uses uppercase alias', async () => {
    stubInboundSuccessMocks();

    const app = createApp();

    const payload = {
      instanceId: 'inst-1',
      event: 'message',
      direction: 'INBOUND',
      timestamp: Date.now(),
      tenantId: 'tenant-1',
      from: {
        phone: '+5511999998888',
        name: 'Maria Upper',
      },
      message: {
        id: 'wamid.789',
        type: 'text',
        text: 'Mensagem com direção maiúscula',
      },
    };

    const waitForProcessed = waitForNextProcessedEvent();

    const response = await request(app)
      .post('/api/integrations/whatsapp/webhook')
      .set('x-api-key', 'test-key')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({ ok: true, queued: expect.any(Number), received: expect.any(Number) })
    );

    await waitForProcessed;

    expect(findOrCreateOpenTicketByChatMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', chatId: expect.any(String) })
    );
    expect(upsertMessageByExternalIdMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', ticketId: 'ticket-1' })
    );
    const updatedCall = emitToTenantSpy.mock.calls.find(([, event]) => event === 'tickets.updated');
    if (updatedCall) {
      expect(updatedCall[0]).toBe('tenant-1');
    }
  });

  it('accepts webhook without credentials when passthrough mode is enabled', async () => {
    stubInboundSuccessMocks();
    (prisma.whatsAppInstance.upsert as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'inst-1',
      tenantId: 'tenant-1',
      brokerId: 'inst-1',
      name: 'Baileys inst-1',
      connected: true,
      status: 'connected',
      metadata: {},
    });

    refreshFeatureFlags({ whatsappPassthroughMode: true });

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

    const waitForProcessed = waitForNextProcessedEvent();

    const response = await request(app)
      .post('/api/integrations/whatsapp/webhook')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({ ok: true, queued: expect.any(Number), received: expect.any(Number) })
    );

    await waitForProcessed;

    expect(prisma.whatsAppInstance.upsert).toHaveBeenCalled();
  });
});
