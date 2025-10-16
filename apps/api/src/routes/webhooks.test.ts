import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message, Ticket } from '@ticketz/core';

import { integrationWebhooksRouter } from './webhooks';

const {
  findOrCreateOpenTicketByChatMock,
  upsertMessageByExternalIdMock,
  findMessageByExternalIdMock,
  applyBrokerAckMock,
} = vi.hoisted(() => ({
  findOrCreateOpenTicketByChatMock: vi.fn(),
  upsertMessageByExternalIdMock: vi.fn(),
  findMessageByExternalIdMock: vi.fn(),
  applyBrokerAckMock: vi.fn(),
}));

vi.mock('@ticketz/storage', () => ({
  findOrCreateOpenTicketByChat: findOrCreateOpenTicketByChatMock,
  upsertMessageByExternalId: upsertMessageByExternalIdMock,
  findMessageByExternalId: findMessageByExternalIdMock,
  applyBrokerAck: applyBrokerAckMock,
}));

vi.mock('../lib/prisma', () => {
  const instanceMock = {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  };
  const campaignMock = {
    findMany: vi.fn(),
    upsert: vi.fn(),
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
  const leadMock = {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  };
  const leadActivityMock = {
    findFirst: vi.fn(),
    create: vi.fn(),
  };
  const ticketMock = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
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
      lead: leadMock,
      leadActivity: leadActivityMock,
      ticket: ticketMock,
      processedIntegrationEvent: processedIntegrationEventMock,
    },
  };
});

const buildDefaultAllocationResult = () => ({
  newlyAllocated: [
    {
      allocationId: 'alloc-1',
      leadId: 'lead-1',
      tenantId: 'tenant-1',
      campaignId: 'camp-1',
      campaignName: 'Campanha Primária',
      agreementId: 'agreement-1',
      instanceId: 'inst-1',
      status: 'allocated',
      receivedAt: new Date('2024-01-01T12:00:00.000Z').toISOString(),
      updatedAt: new Date('2024-01-01T12:00:00.000Z').toISOString(),
      fullName: 'Maria',
      document: '12345678901',
      registrations: [],
      tags: [],
    },
  ],
  summary: { total: 1, contacted: 0, won: 0, lost: 0 },
});

vi.mock('../data/lead-allocation-store', () => ({
  addAllocations: vi.fn(async () => buildDefaultAllocationResult()),
  listAllocations: vi.fn(),
  updateAllocation: vi.fn(),
}));

// Ensure inbound processor is registered
await import('../features/whatsapp-inbound/workers/inbound-processor');
const { refreshFeatureFlags } = await import('../config/feature-flags');
const { refreshWhatsAppEnv } = await import('../config/whatsapp');

const { prisma } = await import('../lib/prisma');
const { addAllocations } = await import('../data/lead-allocation-store');
const { resetInboundLeadServiceTestState } = await import(
  '../features/whatsapp-inbound/services/inbound-lead-service'
);
const ticketsModule = await import('../services/ticket-service');
const createTicketSpy = vi.spyOn(ticketsModule, 'createTicket');
const sendMessageSpy = vi.spyOn(ticketsModule, 'sendMessage');
const emitMessageUpdatedEventsSpy = vi
  .spyOn(ticketsModule, 'emitMessageUpdatedEvents')
  .mockImplementation(() => {});
const socketModule = await import('../lib/socket-registry');
const emitToTenantSpy = vi.spyOn(socketModule, 'emitToTenant').mockImplementation(() => {});

const buildCanonicalWebhookPayload = ({
  instanceId = 'inst-1',
  tenantId = 'tenant-1',
  messageId = 'wamid.123',
  conversation = 'Olá',
  phone = '+5511999998888',
  pushName = 'Maria',
  fromMe = false,
  payloadOverrides = {},
}: {
  instanceId?: string;
  tenantId?: string;
  messageId?: string;
  conversation?: string;
  phone?: string;
  pushName?: string;
  fromMe?: boolean;
  payloadOverrides?: Record<string, unknown>;
} = {}) => {
  const digits = phone.replace(/\D+/g, '');
  const remoteJid = digits ? `${digits}@s.whatsapp.net` : 'unknown@s.whatsapp.net';
  const timestampSeconds = Math.floor(Date.now() / 1000);

  return {
    event: 'WHATSAPP_MESSAGES_UPSERT',
    instanceId,
    tenantId,
    iid: instanceId,
    payload: {
      type: 'notify',
      instanceId,
      tenantId,
      messages: [
        {
          key: {
            remoteJid,
            fromMe,
            id: messageId,
          },
          pushName,
          messageTimestamp: timestampSeconds,
          message: {
            conversation,
          },
        },
      ],
      ...payloadOverrides,
    },
  };
};

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

const stubInboundSuccessMocks = () => {
  const instance = {
    id: 'inst-1',
    tenantId: 'tenant-1',
    brokerId: 'inst-1',
  };

  (prisma.whatsAppInstance.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(instance);
  (prisma.whatsAppInstance.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(instance);
  (prisma.whatsAppInstance.update as unknown as ReturnType<typeof vi.fn>).mockImplementation(async ({ data }) => ({
    ...instance,
    ...data,
  }));

  (prisma.queue.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 'queue-1',
    tenantId: 'tenant-1',
    name: 'Default Queue',
  });
  (prisma.queue.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
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
  (prisma.lead.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (prisma.lead.create as unknown as ReturnType<typeof vi.fn>).mockImplementation(async ({ data }) => ({
    id: 'lead-1',
    ...data,
  }));
  (prisma.lead.update as unknown as ReturnType<typeof vi.fn>).mockImplementation(async ({ data }) => ({
    id: 'lead-1',
    ...data,
  }));
  (prisma.leadActivity.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (prisma.leadActivity.create as unknown as ReturnType<typeof vi.fn>).mockImplementation(async ({ data }) => ({
    id: 'lead-activity-1',
    ...data,
  }));
  (prisma.ticket.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (prisma.ticket.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

  findOrCreateOpenTicketByChatMock.mockResolvedValue({
    ticket: { id: 'passthrough-ticket' },
    wasCreated: true,
  });

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
  findMessageByExternalIdMock.mockResolvedValue(null);
  applyBrokerAckMock.mockResolvedValue(null);
};

describe('WhatsApp webhook (integration)', () => {
  beforeEach(() => {
    resetInboundLeadServiceTestState();
    (prisma.whatsAppInstance.findUnique as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.whatsAppInstance.findFirst as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.whatsAppInstance.upsert as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.whatsAppInstance.update as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.campaign.findMany as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.campaign.upsert as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.queue.findFirst as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.queue.findUnique as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.contact.findUnique as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.contact.findFirst as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.contact.update as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.contact.create as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.lead.findFirst as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.lead.update as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.lead.create as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.leadActivity.findFirst as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.leadActivity.create as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.ticket.findUnique as unknown as ReturnType<typeof vi.fn>).mockReset();
    (prisma.ticket.findFirst as unknown as ReturnType<typeof vi.fn>).mockReset();
    (addAllocations as unknown as ReturnType<typeof vi.fn>).mockReset();
    (addAllocations as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () =>
      buildDefaultAllocationResult()
    );
    createTicketSpy.mockReset();
    sendMessageSpy.mockReset();
    emitMessageUpdatedEventsSpy.mockClear();
    emitToTenantSpy.mockClear();
    findOrCreateOpenTicketByChatMock.mockReset();
    upsertMessageByExternalIdMock.mockReset();
    findMessageByExternalIdMock.mockReset();
    applyBrokerAckMock.mockReset();
    process.env.WHATSAPP_WEBHOOK_API_KEY = 'test-key';
    delete process.env.WHATSAPP_PASSTHROUGH_MODE;
    delete process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE;
    refreshWhatsAppEnv();
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
    delete process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE;
    refreshWhatsAppEnv();
    refreshFeatureFlags({ whatsappPassthroughMode: false });
  });

  it('rejects webhook without API key when it is required', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/integrations/whatsapp/webhook')
      .send({});

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ ok: false, code: 'INVALID_API_KEY' });
  });

  it('rejects webhook with invalid API key value', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/integrations/whatsapp/webhook')
      .set('x-api-key', 'wrong-key')
      .send({});

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ ok: false, code: 'INVALID_API_KEY' });
  });

  it('accepts webhook when API key is provided via bearer authorization header', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/integrations/whatsapp/webhook')
      .set('authorization', 'Bearer test-key')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, received: expect.any(Number) });
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
    process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE = 'true';
    refreshWhatsAppEnv();
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

    const payload = buildCanonicalWebhookPayload({
      instanceId: 'inst-1',
      tenantId: 'tenant-1',
      messageId: 'wamid.123',
      conversation: 'Olá',
      phone: '+5511999998888',
      pushName: 'Maria',
    });

    const response = await request(app)
      .post('/api/integrations/whatsapp/webhook')
      .set('x-api-key', 'test-key')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, received: 1, failures: 0 });
    expect(typeof response.body.persisted).toBe('number');
    expect(response.body.persisted).toBeGreaterThanOrEqual(0);

    expect(prisma.whatsAppInstance.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ id: 'inst-1' }, { brokerId: 'inst-1' }],
        },
      })
    );
    expect(createTicketSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', queueId: 'queue-1', contactId: 'contact-1' })
    );
    expect(sendMessageSpy).toHaveBeenCalled();
    const [, , sendMessageInput] = sendMessageSpy.mock.calls[0] ?? [];
    expect(sendMessageInput).toMatchObject({
      ticketId: 'ticket-1',
      direction: 'INBOUND',
    });
    const emittedEvents = emitToTenantSpy.mock.calls.map(([, event]) => event);
    expect(emittedEvents).toContain('leads.updated');
    const updatedCall = emitToTenantSpy.mock.calls.find(([, event]) => event === 'leads.updated');
    expect(updatedCall?.[0]).toBe('tenant-1');
  });

  it('provisions fallback campaign when no active campaign exists', async () => {
    stubInboundSuccessMocks();

    (prisma.campaign.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    (prisma.campaign.upsert as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'fallback-camp',
      tenantId: 'tenant-1',
      agreementId: 'whatsapp-instance-fallback:inst-1',
      agreementName: 'WhatsApp • Inbound',
      name: 'WhatsApp • Inbound',
      whatsappInstanceId: 'inst-1',
      status: 'active',
    });

    (addAllocations as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      newlyAllocated: [
        {
          allocationId: 'alloc-fallback',
          leadId: 'lead-fallback',
          tenantId: 'tenant-1',
          campaignId: 'fallback-camp',
          campaignName: 'WhatsApp • Inbound',
          agreementId: 'whatsapp-instance-fallback:inst-1',
          instanceId: 'inst-1',
          status: 'allocated',
          receivedAt: new Date('2024-02-02T12:00:00.000Z').toISOString(),
          updatedAt: new Date('2024-02-02T12:00:00.000Z').toISOString(),
          fullName: 'Fallback Contact',
          document: '98765432100',
          registrations: [],
          tags: [],
        },
      ],
      summary: { total: 1, contacted: 0, won: 0, lost: 0 },
    });

    const app = createApp();

    const payload = buildCanonicalWebhookPayload({
      instanceId: 'inst-1',
      tenantId: 'tenant-1',
      messageId: 'wamid.fallback',
      conversation: 'Olá',
      phone: '+5511999997777',
      pushName: 'Fallback User',
    });

    const response = await request(app)
      .post('/api/integrations/whatsapp/webhook')
      .set('x-api-key', 'test-key')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, received: 1, failures: 0 });
    expect(typeof response.body.persisted).toBe('number');
    expect(response.body.persisted).toBeGreaterThanOrEqual(0);

    expect(prisma.campaign.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_agreementId_whatsappInstanceId: {
            tenantId: 'tenant-1',
            agreementId: expect.stringContaining('whatsapp-instance-fallback:inst-1'),
            whatsappInstanceId: 'inst-1',
          },
        },
      })
    );

    expect(addAllocations).toHaveBeenCalledWith(
      'tenant-1',
      { campaignId: 'fallback-camp', instanceId: 'inst-1' },
      expect.any(Array)
    );

    const allocationEvent = emitToTenantSpy.mock.calls.find(([, event]) => event === 'leadAllocations.new');
    expect(allocationEvent?.[2]).toMatchObject({
      instanceId: 'inst-1',
      campaignId: 'fallback-camp',
      allocation: expect.objectContaining({ campaignId: 'fallback-camp' }),
    });
  });

  it('queues inbound message when Authorization bearer header is used', async () => {
    stubInboundSuccessMocks();

    const app = createApp();

    const payload = buildCanonicalWebhookPayload({
      instanceId: 'inst-1',
      tenantId: 'tenant-1',
      messageId: 'wamid.321',
      conversation: 'Olá via bearer',
      phone: '+5511987654321',
      pushName: 'Carlos',
    });

    const response = await request(app)
      .post('/api/integrations/whatsapp/webhook')
      .set('Authorization', 'Bearer test-key')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, received: 1, failures: 0 });
    expect(typeof response.body.persisted).toBe('number');
    expect(response.body.persisted).toBeGreaterThanOrEqual(0);

  });

  it('queues inbound message when X-Authorization header provides the token directly', async () => {
    stubInboundSuccessMocks();

    const app = createApp();

    const payload = buildCanonicalWebhookPayload({
      instanceId: 'inst-1',
      tenantId: 'tenant-1',
      messageId: 'wamid.654',
      conversation: 'Olá via legacy header',
      phone: '+5511912345678',
      pushName: 'Ana',
    });

    const response = await request(app)
      .post('/api/integrations/whatsapp/webhook')
      .set('X-Authorization', 'test-key')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, received: 1, failures: 0 });
    expect(typeof response.body.persisted).toBe('number');
    expect(response.body.persisted).toBeGreaterThanOrEqual(0);

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
    delete process.env.WHATSAPP_WEBHOOK_API_KEY;
    refreshWhatsAppEnv();

    const app = createApp();

    const payload = buildCanonicalWebhookPayload({
      instanceId: 'inst-1',
      tenantId: 'tenant-1',
      messageId: 'wamid.123',
      conversation: 'Olá',
      phone: '+5511999998888',
      pushName: 'Maria',
    });

    const response = await request(app)
      .post('/api/integrations/whatsapp/webhook')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, received: 1, failures: 0 });
    expect(typeof response.body.persisted).toBe('number');
    expect(response.body.persisted).toBeGreaterThanOrEqual(0);

    expect(findOrCreateOpenTicketByChatMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', instanceId: 'inst-1' })
    );
  });

  it('applies WhatsApp message status updates via broker ACK', async () => {
    const app = createApp();

    findMessageByExternalIdMock.mockResolvedValue({
      id: 'message-db-1',
      tenantId: 'tenant-status',
      ticketId: 'ticket-status',
      instanceId: 'inst-status',
      externalId: 'wamid-status-1',
      metadata: {
        broker: {
          messageId: 'wamid-status-1',
        },
      },
    } as unknown as Message);

    applyBrokerAckMock.mockResolvedValue({
      id: 'message-db-1',
      tenantId: 'tenant-status',
      ticketId: 'ticket-status',
      status: 'READ',
      metadata: {},
    } as unknown as Message);

    const payload = {
      event: 'WHATSAPP_MESSAGES_UPDATE',
      instanceId: 'inst-status',
      tenantId: 'tenant-status',
      body: {
        event: 'WHATSAPP_MESSAGES_UPDATE',
        instanceId: 'inst-status',
        payload: {
          iid: 'inst-status',
          tenantId: 'tenant-status',
          raw: {
            updates: [
              {
                key: {
                  remoteJid: '554499110140@s.whatsapp.net',
                  id: 'wamid-status-1',
                  fromMe: true,
                },
                update: {
                  status: 4,
                },
              },
            ],
          },
        },
      },
    };

    const response = await request(app)
      .post('/api/integrations/whatsapp/webhook')
      .set('x-api-key', 'test-key')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({ ok: true, received: 1, persisted: 1, failures: 0 })
    );
    expect(findOrCreateOpenTicketByChatMock).not.toHaveBeenCalled();
    expect(upsertMessageByExternalIdMock).not.toHaveBeenCalled();
    expect(findMessageByExternalIdMock).toHaveBeenCalledWith('tenant-status', 'wamid-status-1');
    expect(applyBrokerAckMock).toHaveBeenCalledWith(
      'tenant-status',
      'message-db-1',
      expect.objectContaining({
        status: 'READ',
        metadata: expect.objectContaining({
          broker: expect.objectContaining({
            lastAck: expect.objectContaining({ raw: expect.any(Object) }),
          }),
        }),
        deliveredAt: expect.any(Date),
        readAt: expect.any(Date),
      })
    );
    expect(emitMessageUpdatedEventsSpy).toHaveBeenCalledWith(
      'tenant-status',
      'ticket-status',
      expect.objectContaining({ id: 'message-db-1', status: 'READ' }),
      null
    );
  });
});
