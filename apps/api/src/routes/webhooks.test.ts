import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message, Ticket } from '../types/tickets';
import { refreshFeatureFlags } from '../config/feature-flags.js';
import { refreshWhatsAppEnv } from '../config/whatsapp.js';
import { prisma } from '../lib/prisma.js';
import { addAllocations } from '../data/lead-allocation-store.js';
import { resetInboundLeadServiceTestState } from '../features/whatsapp-inbound/services/inbound-lead-service.js';
import * as ticketsModule from '../services/ticket-service.js';
import * as socketModule from '../lib/socket-registry.js';

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

vi.mock('../lib/prisma.js', () => {
  const instanceMock = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  };
  const tenantMock = {
    findFirst: vi.fn(),
  };
  const inboundWebhookJobMock = {
    createMany: vi.fn(),
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
      tenant: tenantMock,
      inboundWebhookJob: inboundWebhookJobMock,
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

vi.mock('../data/lead-allocation-store.js', () => ({
  addAllocations: vi.fn(async () => buildDefaultAllocationResult()),
  listAllocations: vi.fn(),
  updateAllocation: vi.fn(),
}));

const createTicketSpy = vi.spyOn(ticketsModule, 'createTicket');
const sendMessageSpy = vi.spyOn(ticketsModule, 'sendMessage');
const emitMessageUpdatedEventsSpy = vi
  .spyOn(ticketsModule, 'emitMessageUpdatedEvents')
  .mockResolvedValue(undefined);
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
    const buffer: Buffer = Buffer.isBuffer(req.body) ? (req.body as Buffer) : Buffer.alloc(0);
    const enrichedReq = req as express.Request & {
      rawBody: Buffer | undefined;
      rawBodyParseError: SyntaxError | null | undefined;
    };

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

const mockFn = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

// Piloto Corban (adae3c03): o webhook resolve instância/tenant no banco (match único por id/brokerId,
// tenant ativo e coerente com x-tenant-id) e apenas persiste um job; a ingestão roda no worker.
const stubWebhookScope = (instance = { id: 'inst-1', tenantId: 'tenant-1', brokerId: 'inst-1' }) => {
  mockFn(prisma.whatsAppInstance.findMany).mockResolvedValue([instance]);
  mockFn(prisma.tenant.findFirst).mockResolvedValue({ id: instance.tenantId });
  mockFn(prisma.inboundWebhookJob.createMany).mockResolvedValue({ count: 1 });
};

const stubInboundSuccessMocks = () => {
  stubWebhookScope();
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
    mockFn(prisma.whatsAppInstance.findMany).mockReset();
    mockFn(prisma.whatsAppInstance.findMany).mockResolvedValue([]);
    mockFn(prisma.tenant.findFirst).mockReset();
    mockFn(prisma.inboundWebhookJob.createMany).mockReset();
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
    delete process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE;
    refreshWhatsAppEnv();
    refreshFeatureFlags();

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
    delete process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE;
    refreshWhatsAppEnv();
    refreshFeatureFlags();
  });

    it('rejects webhook without authorization token', async () => {
      const app = createApp();

      const response = await request(app)
        .post('/api/integrations/whatsapp/webhook')
        .send({});

      expect(response.status).toBe(401);
      expect(response.text).toBe('');
    });

    it('rejects webhook with invalid API key value', async () => {
      process.env.WHATSAPP_WEBHOOK_API_KEY = 'test-key';
      refreshWhatsAppEnv();
      const app = createApp();

      const response = await request(app)
        .post('/api/integrations/whatsapp/webhook')
        .set('authorization', 'Bearer test-key')
        .set('x-tenant-id', 'tenant-1')
        .set('x-api-key', 'wrong-key')
        .send({});

      expect(response.status).toBe(401);
      expect(response.text).toBe('');
    });

    it('rejects events whose instance cannot be resolved to a tenant', async () => {
      const app = createApp();

      const response = await request(app)
        .post('/api/integrations/whatsapp/webhook')
        .set('authorization', 'Bearer test-key')
        .send(buildCanonicalWebhookPayload({ instanceId: 'inst-unknown' }));

      expect(response.status).toBe(403);
      expect(prisma.inboundWebhookJob.createMany).not.toHaveBeenCalled();
    });

    it('rejects events whose x-tenant-id conflicts with the stored instance tenant', async () => {
      stubWebhookScope();
      const app = createApp();

      const response = await request(app)
        .post('/api/integrations/whatsapp/webhook')
        .set('authorization', 'Bearer test-key')
        .set('x-tenant-id', 'tenant-other')
        .send(buildCanonicalWebhookPayload());

      expect(response.status).toBe(403);
      expect(prisma.inboundWebhookJob.createMany).not.toHaveBeenCalled();
    });

    it('resolves tenant from instance lookup when tenant headers are missing', async () => {
      stubInboundSuccessMocks();

      const app = createApp();

      const response = await request(app)
        .post('/api/integrations/whatsapp/webhook')
        .set('authorization', 'Bearer test-key')
        .send({
          event: 'WHATSAPP_MESSAGES_UPSERT',
          instanceId: 'inst-1',
          payload: {
            instanceId: 'inst-1',
            messages: [
              {
                key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'wamid.instance', fromMe: false },
                messageTimestamp: 1_700_000_000,
                message: { conversation: 'Olá' },
              },
            ],
          },
        });

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
      expect(prisma.inboundWebhookJob.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [expect.objectContaining({ tenantId: 'tenant-1', instanceId: 'inst-1' })],
        })
      );
    });

    it('acknowledges an authenticated webhook without events', async () => {
      const app = createApp();

      const response = await request(app)
        .post('/api/integrations/whatsapp/webhook')
        .set('authorization', 'Bearer test-key')
        .set('x-tenant-id', 'tenant-1')
        .send([]);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true, received: 0, persisted: 0 });
    });

    it('returns 400 when webhook payload is not valid JSON', async () => {
      process.env.WHATSAPP_WEBHOOK_API_KEY = 'test-key';
      const app = createApp();

      const response = await request(app)
        .post('/api/integrations/whatsapp/webhook')
        .set('authorization', 'Bearer test-key')
        .set('x-tenant-id', 'tenant-1')
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
      .set('authorization', 'Bearer test-key')
      .set('x-tenant-id', 'tenant-1')
      .set('x-api-key', 'test-key')
      .set('x-signature-sha256', 'deadbeef')
      .send({ ping: 'pong' });

    expect(response.status).toBe(401);
  });

  it('persists the inbound message as a job before acknowledging', async () => {
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
      .set('authorization', 'Bearer test-key')
      .set('x-tenant-id', 'tenant-1')
      .set('x-api-key', 'test-key')
      .send(payload);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(prisma.inboundWebhookJob.createMany).toHaveBeenCalledTimes(1);
    const [jobArgs] = mockFn(prisma.inboundWebhookJob.createMany).mock.calls[0] ?? [];
    expect(jobArgs).toMatchObject({
      skipDuplicates: true,
      data: [
        {
          tenantId: 'tenant-1',
          instanceId: 'inst-1',
          conversationId: '5511999998888@s.whatsapp.net',
          eventKey: expect.any(String),
        },
      ],
    });
    // A ingestão (ticket, mensagem, alocação) acontece no worker, não na requisição do webhook.
    expect(sendMessageSpy).not.toHaveBeenCalled();
    expect(addAllocations).not.toHaveBeenCalled();
  });

  it('answers 503 so the broker retries when the job cannot be persisted', async () => {
    stubInboundSuccessMocks();
    mockFn(prisma.inboundWebhookJob.createMany).mockRejectedValueOnce(new Error('database unavailable'));

    const response = await request(createApp())
      .post('/api/integrations/whatsapp/webhook')
      .set('authorization', 'Bearer test-key')
      .set('x-tenant-id', 'tenant-1')
      .send(buildCanonicalWebhookPayload({ messageId: 'wamid.retry' }));

    expect(response.status).toBe(503);
    expect(response.headers['retry-after']).toBe('5');
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
      .set('x-tenant-id', 'tenant-1')
      .send(payload);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});

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
      .set('x-tenant-id', 'tenant-1')
      .send(payload);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
  });

  it('fails closed with 503 when the webhook API key is not configured', async () => {
    delete process.env.WHATSAPP_WEBHOOK_API_KEY;
    refreshWhatsAppEnv();
    stubInboundSuccessMocks();

    const response = await request(createApp())
      .post('/api/integrations/whatsapp/webhook')
      .set('authorization', 'Bearer tenant-1:test-key')
      .set('x-tenant-id', 'tenant-1')
      .send(buildCanonicalWebhookPayload());

    expect(response.status).toBe(503);
    expect(prisma.inboundWebhookJob.createMany).not.toHaveBeenCalled();
  });

  it('applies WhatsApp message status updates via broker ACK', async () => {
    stubWebhookScope({ id: 'inst-status', tenantId: 'tenant-status', brokerId: 'inst-status' });
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
      .set('authorization', 'Bearer test-key')
      .set('x-tenant-id', 'tenant-status')
      .set('x-api-key', 'test-key')
      .send(payload);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
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
