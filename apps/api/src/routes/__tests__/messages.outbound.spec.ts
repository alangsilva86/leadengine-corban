import express, { type Request } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ticket } from '../../types/tickets';

const {
  queueFindFirstMock,
  queueUpsertMock,
  contactFindUniqueMock,
  contactUpdateMock,
  contactCreateMock,
  whatsAppInstanceFindUniqueMock,
  ticketFindUniqueMock,
  userDeleteManyMock,
  userUpsertMock,
  restoreMvpBypassEnv,
} = vi.hoisted(() => {
  const originalMvpBypass = process.env.MVP_AUTH_BYPASS;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.MVP_AUTH_BYPASS = 'true';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://example.com/mock-db';

  return {
    queueFindFirstMock: vi.fn(),
    queueUpsertMock: vi.fn(),
    contactFindUniqueMock: vi.fn(),
    contactUpdateMock: vi.fn(),
    contactCreateMock: vi.fn(),
    whatsAppInstanceFindUniqueMock: vi.fn(),
    ticketFindUniqueMock: vi.fn(),
    userDeleteManyMock: vi.fn(),
    userUpsertMock: vi.fn(),
    restoreMvpBypassEnv: () => {
      if (originalMvpBypass === undefined) {
        delete process.env.MVP_AUTH_BYPASS;
      } else {
        process.env.MVP_AUTH_BYPASS = originalMvpBypass;
      }
      if (originalDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = originalDatabaseUrl;
      }
    },
  };
});

vi.mock('@ticketz/storage', () => import('../../test-utils/storage-mock'));

vi.mock('../../middleware/auth', async () => {
  const actual = await vi.importActual<typeof import('../../middleware/auth')>(
    '../../middleware/auth'
  );
  return {
    ...actual,
    requireTenant: (_req: unknown, _res: unknown, next: () => void) => next(),
  };
});

vi.mock('../../lib/prisma', () => ({
  prisma: {
    queue: {
      findFirst: (...args: unknown[]) => queueFindFirstMock(...args),
      upsert: (...args: unknown[]) => queueUpsertMock(...args),
    },
    contact: {
      findUnique: (...args: unknown[]) => contactFindUniqueMock(...args),
      update: (...args: unknown[]) => contactUpdateMock(...args),
      create: (...args: unknown[]) => contactCreateMock(...args),
    },
    whatsAppInstance: {
      findUnique: (...args: unknown[]) => whatsAppInstanceFindUniqueMock(...args),
    },
    ticket: {
      findUnique: (...args: unknown[]) => ticketFindUniqueMock(...args),
    },
    user: {
      deleteMany: (...args: unknown[]) => userDeleteManyMock(...args),
      upsert: (...args: unknown[]) => userUpsertMock(...args),
    },
  },
  isDatabaseEnabled: true,
}));

import { ticketMessagesRouter } from '../messages.ticket';
import { contactMessagesRouter } from '../messages.contact';
import { whatsappMessagesRouter } from '../integrations/whatsapp.messages';
import { errorHandler } from '../../middleware/error-handler';
import { registerSocketServer, type SocketServerAdapter } from '../../lib/socket-registry';
import { resetMetrics, renderMetrics } from '../../lib/metrics';
import { resetTicketStore, createTicket } from '@ticketz/storage';
import { resetRateLimit } from '../../utils/rate-limit';
import { WhatsAppBrokerError } from '../../services/whatsapp-broker-client';
import type { WhatsAppTransport } from '../../features/whatsapp-transport';
import * as transportModule from '../../features/whatsapp-transport';
import { resetCircuitBreaker } from '../../utils/circuit-breaker';
import { whatsappBrokerClient, WhatsAppBrokerError } from '../../services/whatsapp-broker-client';

class MockSocketServer {
  public events: Array<{ room: string; event: string; payload: unknown }> = [];

  to(room: string) {
    return {
      emit: (event: string, payload: unknown) => {
        this.events.push({ room, event, payload });
      },
    };
  }
}

type MockUser = {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  permissions: string[];
};

const buildApp = (overrides: Partial<MockUser> = {}) => {
  const app = express();
  app.use(express.json());
  app.use(((req, _res, next) => {
    const baseUser: MockUser = {
      id: 'operator-1',
      tenantId: 'tenant-123',
      email: 'agent@example.com',
      name: 'Agent Smith',
      role: 'AGENT',
      isActive: true,
      permissions: ['tickets:write'],
    };

    (req as Request).user = { ...baseUser, ...overrides };
    next();
  }) as express.RequestHandler);

  app.use('/api', ticketMessagesRouter);
  app.use('/api', contactMessagesRouter);
  app.use('/api', whatsappMessagesRouter);
  app.use(errorHandler);
  return app;
};

const RATE_KEY = 'whatsapp:tenant-123:instance-001';

type MockContact = {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  avatar: string | null;
  tags: string[];
  customFields: Record<string, unknown>;
  lastInteractionAt: Date;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const contacts = new Map<string, MockContact>();
const tickets = new Map<string, Ticket>();

afterAll(() => {
  restoreMvpBypassEnv();
});

describe('Outbound message routes', () => {
  let socket: MockSocketServer;
  let sendMessageMock: ReturnType<typeof vi.fn>;
  let transportMock: WhatsAppTransport;
  let getTransportSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    queueFindFirstMock.mockResolvedValue({
      id: 'queue-1',
      tenantId: 'tenant-123',
      name: 'Default',
      orderIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    queueUpsertMock.mockResolvedValue({
      id: 'queue-1',
      tenantId: 'tenant-123',
      name: 'Default',
      orderIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    userDeleteManyMock.mockResolvedValue({ count: 0 });
    userUpsertMock.mockResolvedValue({
      id: 'operator-1',
      tenantId: 'tenant-123',
      email: 'agent@example.com',
      name: 'Agent Smith',
      role: 'AGENT',
      isActive: true,
      passwordHash: 'hash',
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    contacts.clear();
    tickets.clear();

    ticketFindUniqueMock.mockImplementation(async (args: { where: Record<string, unknown> }) => {
      const { where } = args;
      if (where && 'id' in where && typeof where.id === 'string') {
        return tickets.get(where.id) ?? null;
      }
      return null;
    });

    const baseContact: MockContact = {
      id: 'contact-123',
      tenantId: 'tenant-123',
      name: 'John Doe',
      phone: '+554499999999',
      email: null,
      document: null,
      avatar: null,
      tags: [],
      customFields: {},
      lastInteractionAt: new Date(),
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    contacts.set(baseContact.id, baseContact);

    contactFindUniqueMock.mockImplementation(async (args: { where: Record<string, unknown> }) => {
      const { where } = args;

      if (where && 'id' in where && typeof where.id === 'string') {
        return contacts.get(where.id) ?? null;
      }

      if (where && 'tenantId_phone' in where) {
        const { tenantId, phone } = where.tenantId_phone as { tenantId: string; phone: string };
        for (const contact of contacts.values()) {
          if (contact.tenantId === tenantId && contact.phone === phone) {
            return contact;
          }
        }
        return null;
      }

      return null;
    });

    contactUpdateMock.mockImplementation(async (args: { where: { id: string }; data: Partial<MockContact> }) => {
      const existing = contacts.get(args.where.id);
      if (!existing) {
        throw new Error(`Contact ${args.where.id} not found`);
      }

      const updated: MockContact = {
        ...existing,
        ...args.data,
        updatedAt: new Date(),
      };
      contacts.set(updated.id, updated);
      return updated;
    });

    contactCreateMock.mockImplementation(async (args: { data: Record<string, unknown> }) => {
      const data = args.data;
      const id = (data.id as string) ?? `contact-${contacts.size + 1}`;
      const created: MockContact = {
        id,
        tenantId: data.tenantId as string,
        name: (data.name as string) ?? 'Novo Contato',
        phone: (data.phone as string) ?? null,
        email: (data.email as string) ?? null,
        document: (data.document as string) ?? null,
        avatar: (data.avatar as string) ?? null,
        tags: (data.tags as string[]) ?? [],
        customFields: (data.customFields as Record<string, unknown>) ?? {},
        lastInteractionAt: (data.lastInteractionAt as Date) ?? new Date(),
        notes: (data.notes as string) ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      contacts.set(created.id, created);
      return created;
    });

    whatsAppInstanceFindUniqueMock.mockResolvedValue({
      id: 'instance-001',
      tenantId: 'tenant-123',
      name: 'Test instance',
      brokerId: 'broker-1',
      status: 'connected',
      connected: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    socket = new MockSocketServer();
    registerSocketServer(socket as unknown as SocketServerAdapter);

    await resetTicketStore();
    resetMetrics();
    resetRateLimit(RATE_KEY);
    resetCircuitBreaker();

    let counter = 0;
    sendMessageMock = vi
      .fn(async (_instanceId: string, payload: unknown) => {
        counter += 1;
        return {
          externalId: `wamid-${counter.toString().padStart(3, '0')}`,
          status: 'SENT',
          timestamp: new Date().toISOString(),
          raw: { payload },
        };
      })
      .mockName('sendMessage');

    transportMock = {
      mode: 'http',
      sendMessage: sendMessageMock as unknown as WhatsAppTransport['sendMessage'],
      checkRecipient: vi
        .fn(async () => ({}))
        .mockName('checkRecipient') as unknown as WhatsAppTransport['checkRecipient'],
      getGroups: vi
        .fn(async () => ({}))
        .mockName('getGroups') as unknown as WhatsAppTransport['getGroups'],
      createPoll: vi
        .fn(async () => ({
          id: 'poll-mock',
          status: 'sent',
          ack: null,
          rate: null,
          raw: null,
        }))
        .mockName('createPoll') as unknown as WhatsAppTransport['createPoll'],
    };

    getTransportSpy = vi
      .spyOn(transportModule, 'getWhatsAppTransport')
      .mockReturnValue(transportMock);
  });

  afterEach(() => {
    registerSocketServer(null);
    getTransportSpy.mockRestore();
    sendMessageMock.mockReset();
    transportMock.checkRecipient.mockReset();
    transportMock.getGroups.mockReset();
    transportMock.createPoll.mockReset();
    queueFindFirstMock.mockReset();
    queueUpsertMock.mockReset();
    contactFindUniqueMock.mockReset();
    contactUpdateMock.mockReset();
    contactCreateMock.mockReset();
    whatsAppInstanceFindUniqueMock.mockReset();
    ticketFindUniqueMock.mockReset();
    userDeleteManyMock.mockReset();
    userUpsertMock.mockReset();
  });

  it('sends outbound message on ticket and emits realtime events', async () => {
    const ticket = await createTicket({
      tenantId: 'tenant-123',
      contactId: 'contact-123',
      queueId: 'queue-1',
      channel: 'WHATSAPP',
      metadata: { whatsappInstanceId: 'instance-001' },
      priority: 'NORMAL',
      tags: [],
    });
    tickets.set(ticket.id, ticket);

    const app = buildApp();
    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/messages`)
      .set('Idempotency-Key', 'test-ticket-send')
      .send({
        instanceId: 'instance-001',
        payload: {
          type: 'text',
          text: 'Olá! Teste via ticket',
        },
        idempotencyKey: 'test-ticket-send',
      });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      queued: true,
      ticketId: ticket.id,
      status: 'SENT',
      error: null,
    });

    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock).toHaveBeenCalledWith(
      'broker-1',
      expect.objectContaining({
        to: '+554499999999',
        type: 'TEXT',
      }),
      expect.objectContaining({ idempotencyKey: expect.any(String) })
    );
    const [, payloadArg] = sendMessageMock.mock.calls[0] ?? [];
    expect(payloadArg).toMatchObject({
      content: 'Olá! Teste via ticket',
      previewUrl: false,
    });
    expect(payloadArg.metadata).toEqual({ idempotencyKey: 'test-ticket-send' });
    expect(payloadArg.metadata).not.toHaveProperty('transport');
    expect(payloadArg.metadata).not.toHaveProperty('transportMode');

    const createdEvent = socket.events.find(
      (event) => event.event === 'message:created' && event.room.startsWith('tenant:')
    );
    expect(createdEvent).toBeDefined();
    expect((createdEvent?.payload as { status?: string })?.status).toBe('PENDING');

    const updatedEvent = socket.events.find(
      (event) => event.event === 'message:updated' && event.room.startsWith('tenant:')
    );
    expect(updatedEvent).toBeDefined();
    expect((updatedEvent?.payload as { status?: string })?.status).toBe('SENT');

    const metricsSnapshot = renderMetrics();
    expect(metricsSnapshot).toContain(
      'whatsapp_outbound_total{instanceId="instance-001",origin="ticket-service",status="SENT",tenantId="tenant-123"} 1'
    );
    expect(metricsSnapshot).not.toContain('transport=');
  });

  it('rejects ticket sends without Idempotency-Key header', async () => {
    const ticket = await createTicket({
      tenantId: 'tenant-123',
      contactId: 'contact-123',
      queueId: 'queue-1',
      channel: 'WHATSAPP',
      metadata: { whatsappInstanceId: 'instance-001' },
      priority: 'NORMAL',
      tags: [],
    });
    tickets.set(ticket.id, ticket);

    const app = buildApp();
    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/messages`)
      .send({
        instanceId: 'instance-001',
        payload: {
          type: 'text',
          text: 'Mensagem sem cabeçalho',
        },
        idempotencyKey: 'no-header',
      });

    expect(response.status).toBe(409);
    expect(response.body.error?.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('rejects ticket sends when idempotency key header mismatches body', async () => {
    const ticket = await createTicket({
      tenantId: 'tenant-123',
      contactId: 'contact-123',
      queueId: 'queue-1',
      channel: 'WHATSAPP',
      metadata: { whatsappInstanceId: 'instance-001' },
      priority: 'NORMAL',
      tags: [],
    });
    tickets.set(ticket.id, ticket);

    const app = buildApp();
    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/messages`)
      .set('Idempotency-Key', 'header-key')
      .send({
        instanceId: 'instance-001',
        payload: {
          type: 'text',
          text: 'Mensagem com chave divergente',
        },
        idempotencyKey: 'body-key',
      });

    expect(response.status).toBe(409);
    expect(response.body.error?.code).toBe('IDEMPOTENCY_KEY_MISMATCH');
  });

  it('surfaces detailed broker error information when dispatch fails', async () => {
    const ticket = await createTicket({
      tenantId: 'tenant-123',
      contactId: 'contact-123',
      queueId: 'queue-1',
      channel: 'WHATSAPP',
      metadata: { whatsappInstanceId: 'instance-001' },
      priority: 'NORMAL',
      tags: [],
    });
    tickets.set(ticket.id, ticket);

    sendMessageMock.mockRejectedValueOnce(
      new WhatsAppBrokerError('Request timed out', 'REQUEST_TIMEOUT', 408, 'req-123')
    );

    const app = buildApp();
    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/messages`)
      .set('Idempotency-Key', 'broker-fail-1')
      .send({
        instanceId: 'instance-001',
        payload: {
          type: 'text',
          text: 'Mensagem que falhará',
        },
        idempotencyKey: 'broker-fail-1',
      });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      queued: true,
      status: 'FAILED',
      error: {
        message: expect.stringContaining('Tempo limite'),
        code: 'BROKER_TIMEOUT',
        status: 408,
        requestId: 'req-123',
      },
    });
  });

  it('normalizes broker disconnection errors into INSTANCE_NOT_CONNECTED', async () => {
    const ticket = await createTicket({
      tenantId: 'tenant-123',
      contactId: 'contact-123',
      queueId: 'queue-1',
      channel: 'WHATSAPP',
      metadata: { whatsappInstanceId: 'instance-001' },
      priority: 'NORMAL',
      tags: [],
    });
    tickets.set(ticket.id, ticket);

    sendMessageMock.mockRejectedValueOnce(
      new WhatsAppBrokerError('Session disconnected', 'SESSION_NOT_CONNECTED', 409, 'req-409')
    );

    const app = buildApp();
    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/messages`)
      .set('Idempotency-Key', 'instance-down')
      .send({
        instanceId: 'instance-001',
        payload: {
          type: 'text',
          text: 'Mensagem que falhará',
        },
        idempotencyKey: 'instance-down',
      });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      status: 'FAILED',
      error: {
        code: 'INSTANCE_NOT_CONNECTED',
        message: expect.stringContaining('Instância de WhatsApp desconectada'),
        status: 409,
        requestId: 'req-409',
      },
    });
  });

  it('normalizes invalid recipient responses into INVALID_TO', async () => {
    const ticket = await createTicket({
      tenantId: 'tenant-123',
      contactId: 'contact-123',
      queueId: 'queue-1',
      channel: 'WHATSAPP',
      metadata: { whatsappInstanceId: 'instance-001' },
      priority: 'NORMAL',
      tags: [],
    });
    tickets.set(ticket.id, ticket);

    sendMessageMock.mockRejectedValueOnce(
      new WhatsAppBrokerError('Invalid recipient number', 'INVALID_RECIPIENT', 400, 'req-400')
    );

    const app = buildApp();
    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/messages`)
      .set('Idempotency-Key', 'invalid-dest')
      .send({
        instanceId: 'instance-001',
        payload: {
          type: 'text',
          text: 'Mensagem inválida',
        },
        idempotencyKey: 'invalid-dest',
      });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      status: 'FAILED',
      error: {
        code: 'INVALID_TO',
        message: expect.stringContaining('Número de destino inválido'),
        status: 400,
        requestId: 'req-400',
      },
    });
  });

  it('normalizes rate limit responses into RATE_LIMITED', async () => {
    const ticket = await createTicket({
      tenantId: 'tenant-123',
      contactId: 'contact-123',
      queueId: 'queue-1',
      channel: 'WHATSAPP',
      metadata: { whatsappInstanceId: 'instance-001' },
      priority: 'NORMAL',
      tags: [],
    });
    tickets.set(ticket.id, ticket);

    sendMessageMock.mockRejectedValueOnce(
      new WhatsAppBrokerError('Rate limit reached', 'RATE_LIMIT_EXCEEDED', 429, 'req-429')
    );

    const app = buildApp();
    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/messages`)
      .set('Idempotency-Key', 'timeout-429')
      .send({
        instanceId: 'instance-001',
        payload: {
          type: 'text',
          text: 'Mensagem bloqueada por rate limit',
        },
        idempotencyKey: 'timeout-429',
      });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      status: 'FAILED',
      error: {
        code: 'RATE_LIMITED',
        message: expect.stringContaining('Limite de envio'),
        status: 429,
        requestId: 'req-429',
      },
    });
  });

  it('returns cached response when idempotency key is reused', async () => {
    const ticket = await createTicket({
      tenantId: 'tenant-123',
      contactId: 'contact-123',
      queueId: 'queue-1',
      channel: 'WHATSAPP',
      metadata: { whatsappInstanceId: 'instance-001' },
      priority: 'NORMAL',
      tags: [],
    });
    tickets.set(ticket.id, ticket);

    const app = buildApp();

    const first = await request(app)
      .post(`/api/tickets/${ticket.id}/messages`)
      .set('Idempotency-Key', 'idem-123')
      .send({
        instanceId: 'instance-001',
        payload: {
          type: 'text',
          text: 'Mensagem idempotente',
        },
        idempotencyKey: 'idem-123',
      });

    expect(first.status).toBe(202);
    const messageId = first.body.messageId;

    sendMessageMock.mockClear();

    const second = await request(app)
      .post(`/api/tickets/${ticket.id}/messages`)
      .set('Idempotency-Key', 'idem-123')
      .send({
        instanceId: 'instance-001',
        payload: {
          type: 'text',
          text: 'Mensagem idempotente',
        },
        idempotencyKey: 'idem-123',
      });

    expect(second.status).toBe(202);
    expect(second.body.messageId).toBe(messageId);
    expect(second.body.status).toBe(first.body.status);
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('creates a fallback queue automatically when tenant has none', async () => {
    const tenantId = 'tenant-fallback';
    const contact: MockContact = {
      id: 'contact-fallback',
      tenantId,
      name: 'Fallback Contact',
      phone: '+551197778888',
      email: null,
      document: null,
      avatar: null,
      tags: [],
      customFields: {},
      lastInteractionAt: new Date(),
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    contacts.set(contact.id, contact);

    queueFindFirstMock.mockResolvedValueOnce(null);
    queueUpsertMock.mockResolvedValueOnce({
      id: 'queue-fallback',
      tenantId,
      name: 'Atendimento Geral',
      orderIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    whatsAppInstanceFindUniqueMock.mockImplementation(async () => ({
      id: 'instance-001',
      tenantId,
      name: 'Fallback Instance',
      brokerId: 'broker-fallback',
      status: 'connected',
      connected: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const app = buildApp({ tenantId, id: 'operator-fallback' });
    const response = await request(app)
      .post(`/api/contacts/${contact.id}/messages`)
      .set('Idempotency-Key', 'test-fallback-queue')
      .send({
        to: contact.phone,
        instanceId: 'instance-001',
        payload: {
          type: 'text',
          text: 'Mensagem via fila automática',
        },
        idempotencyKey: 'test-fallback-queue',
      });

    expect(response.status).toBe(202);
    expect(queueFindFirstMock).toHaveBeenCalled();
    expect(queueUpsertMock).toHaveBeenCalledWith({
      where: {
        tenantId_name: {
          tenantId,
          name: 'Atendimento Geral',
        },
      },
      update: {},
      create: expect.objectContaining({
        tenantId,
        name: 'Atendimento Geral',
      }),
    });
    expect(response.body.queued).toBe(true);
    expect(response.body.ticketId).toBeTruthy();
    expect(sendMessageMock).toHaveBeenCalledWith(
      'broker-fallback',
      expect.objectContaining({
        to: contact.phone,
      }),
      expect.objectContaining({ idempotencyKey: expect.any(String) })
    );
  });

  it('surfaces normalized broker errors for ad-hoc sends', async () => {
    sendMessageMock.mockRejectedValueOnce(
      new WhatsAppBrokerError('Invalid destination number', 'INVALID_DESTINATION', 400, 'adhoc-400')
    );

    const app = buildApp();
    const response = await request(app)
      .post('/api/integrations/whatsapp/instances/instance-001/messages')
      .set('Idempotency-Key', 'adhoc-fail')
      .send({
        to: '+55 44 9999-9999',
        payload: {
          type: 'text',
          text: 'Falha controlada',
        },
        idempotencyKey: 'adhoc-fail',
      });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      queued: true,
      status: 'FAILED',
      error: {
        code: 'INVALID_TO',
        message: expect.stringContaining('Número de destino inválido'),
        status: 400,
        requestId: 'adhoc-400',
      },
    });
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
  });

  it('rejects ad-hoc sends when the WhatsApp instance is disconnected', async () => {
    whatsAppInstanceFindUniqueMock.mockResolvedValueOnce({
      id: 'instance-001',
      tenantId: 'tenant-123',
      name: 'Test instance',
      brokerId: 'broker-1',
      status: 'disconnected',
      connected: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const app = buildApp();

    const response = await request(app)
      .post('/api/integrations/whatsapp/instances/instance-001/messages')
      .set('Idempotency-Key', 'adhoc-offline')
      .send({
        to: '+55 44 9999-9999',
        payload: {
          type: 'text',
          text: 'Mensagem com instância offline',
        },
        idempotencyKey: 'adhoc-offline',
      });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INSTANCE_DISCONNECTED',
      },
    });
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('enforces basic rate limiting per instance', async () => {
    const ticket = await createTicket({
      tenantId: 'tenant-123',
      contactId: 'contact-123',
      queueId: 'queue-1',
      channel: 'WHATSAPP',
      metadata: { whatsappInstanceId: 'instance-001' },
      priority: 'NORMAL',
      tags: [],
    });
    tickets.set(ticket.id, ticket);

    const app = buildApp();

    for (let i = 0; i < 5; i += 1) {
      const result = await request(app)
        .post(`/api/tickets/${ticket.id}/messages`)
        .set('Idempotency-Key', `rate-key-${i}`)
        .send({
          instanceId: 'instance-001',
          payload: {
            type: 'text',
            text: `Mensagem ${i}`,
          },
          idempotencyKey: `rate-key-${i}`,
        });

      expect(result.status).toBe(202);
    }

    const limited = await request(app)
      .post(`/api/tickets/${ticket.id}/messages`)
      .set('Idempotency-Key', 'rate-key-overflow')
      .send({
        instanceId: 'instance-001',
        payload: {
          type: 'text',
          text: 'Mensagem adicional',
        },
        idempotencyKey: 'rate-key-overflow',
      });

    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({
      error: {
        code: 'RATE_LIMITED',
      },
    });
  });

  it('opens circuit breaker after repeated broker failures', async () => {
    const ticket = await createTicket({
      tenantId: 'tenant-123',
      contactId: 'contact-123',
      queueId: 'queue-1',
      channel: 'WHATSAPP',
      metadata: { whatsappInstanceId: 'instance-001' },
      priority: 'NORMAL',
      tags: [],
    });
    tickets.set(ticket.id, ticket);

    sendMessageMock.mockImplementation(async () => {
      throw new WhatsAppBrokerError('Broker unavailable', 'BROKER_DOWN', 502, 'req-circuit');
    });

    const app = buildApp();

    for (let i = 0; i < 5; i += 1) {
      const attempt = await request(app)
        .post(`/api/tickets/${ticket.id}/messages`)
        .set('Idempotency-Key', `circuit-${i}`)
        .send({
          instanceId: 'instance-001',
          payload: {
            type: 'text',
            text: `Mensagem falha ${i}`,
          },
          idempotencyKey: `circuit-${i}`,
        });

      expect(attempt.status).toBe(202);
      expect(attempt.body.status).toBe('FAILED');
    }

    const blocked = await request(app)
      .post(`/api/tickets/${ticket.id}/messages`)
      .set('Idempotency-Key', 'circuit-blocked')
      .send({
        instanceId: 'instance-001',
        payload: {
          type: 'text',
          text: 'Mensagem bloqueada pelo circuito',
        },
        idempotencyKey: 'circuit-blocked',
      });

    expect(blocked.status).toBe(423);
    expect(blocked.body.error).toMatchObject({ code: 'WHATSAPP_CIRCUIT_OPEN' });
    expect(sendMessageMock).toHaveBeenCalledTimes(5);
  });

  it('returns 202 for outbound sends when MVP bypass seeds demo user', async () => {
    const { refreshFeatureFlags } = await import('../../config/feature-flags');
    refreshFeatureFlags({ mvpAuthBypass: true });

    userDeleteManyMock.mockResolvedValue({ count: 0 });
    userUpsertMock.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      tenantId: 'demo-tenant',
      email: 'mvp-anonymous@leadengine.local',
      name: 'MVP Anonymous',
      role: 'ADMIN',
      isActive: true,
      passwordHash: 'hash',
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { prisma } = await import('../../lib/prisma');
    await prisma.user.deleteMany({});

    const authModule = await import('../../middleware/auth');

    const app = express();
    app.use(express.json());
    app.use(authModule.authMiddleware);
    app.use('/api', whatsappMessagesRouter);
    app.use(errorHandler);

    const response = await request(app)
      .post('/api/integrations/whatsapp/instances/instance-001/messages')
      .set('Idempotency-Key', 'demo-seed-1')
      .send({
        to: '+554499999999',
        payload: {
          type: 'text',
          text: 'Olá MVP bypass',
        },
        idempotencyKey: 'demo-seed-1',
      });

    expect(response.status).toBe(202);
    expect(userDeleteManyMock).toHaveBeenCalledTimes(1);
    expect(userUpsertMock).toHaveBeenCalledTimes(1);

    const [upsertArgs] = userUpsertMock.mock.calls;
    expect(upsertArgs?.[0]).toMatchObject({
      where: { id: authModule.AUTH_MVP_BYPASS_USER_ID },
      create: expect.objectContaining({ tenantId: authModule.AUTH_MVP_BYPASS_TENANT_ID }),
    });
  });
});
