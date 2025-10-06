import express, { type Request } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  queueFindFirstMock,
  contactFindUniqueMock,
  contactUpdateMock,
  contactCreateMock,
  whatsAppInstanceFindUniqueMock,
} = vi.hoisted(() => ({
  queueFindFirstMock: vi.fn(),
  contactFindUniqueMock: vi.fn(),
  contactUpdateMock: vi.fn(),
  contactCreateMock: vi.fn(),
  whatsAppInstanceFindUniqueMock: vi.fn(),
}));

vi.mock('../../middleware/auth', () => ({
  requireTenant: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    queue: {
      findFirst: (...args: unknown[]) => queueFindFirstMock(...args),
    },
    contact: {
      findUnique: (...args: unknown[]) => contactFindUniqueMock(...args),
      update: (...args: unknown[]) => contactUpdateMock(...args),
      create: (...args: unknown[]) => contactCreateMock(...args),
    },
    whatsAppInstance: {
      findUnique: (...args: unknown[]) => whatsAppInstanceFindUniqueMock(...args),
    },
  },
}));

import { ticketMessagesRouter } from '../messages.ticket';
import { contactMessagesRouter } from '../messages.contact';
import { whatsappMessagesRouter } from '../integrations/whatsapp.messages';
import { errorHandler } from '../../middleware/error-handler';
import { registerSocketServer, type SocketServerAdapter } from '../../lib/socket-registry';
import { resetMetrics, renderMetrics } from '../../lib/metrics';
import { resetTicketStore, createTicket } from '@ticketz/storage';
import { resetRateLimit } from '../../utils/rate-limit';
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

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(((req, _res, next) => {
    (req as Request).user = {
      id: 'operator-1',
      tenantId: 'tenant-123',
      email: 'agent@example.com',
      name: 'Agent Smith',
      role: 'AGENT',
      isActive: true,
      permissions: ['tickets:write'],
    };
    next();
  }) as express.RequestHandler);

  app.use('/api', ticketMessagesRouter);
  app.use('/api', contactMessagesRouter);
  app.use('/api', whatsappMessagesRouter);
  app.use(errorHandler);
  return app;
};

const RATE_KEY = 'outbound:tenant-123:instance-001';

describe('Outbound message routes', () => {
  let socket: MockSocketServer;
  let sendMessageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queueFindFirstMock.mockResolvedValue({
      id: 'queue-1',
      tenantId: 'tenant-123',
      name: 'Default',
      orderIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const baseContact = {
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

    contactFindUniqueMock.mockImplementation(async (args: { where: Record<string, unknown> }) => {
      if ('id' in args.where!) {
        return baseContact;
      }

      if ('tenantId_phone' in args.where!) {
        return null;
      }

      return null;
    });

    contactUpdateMock.mockResolvedValue(baseContact);
    contactCreateMock.mockResolvedValue({
      ...baseContact,
      id: 'contact-new',
      phone: '+554488887777',
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

    resetTicketStore();
    resetMetrics();
    resetRateLimit(RATE_KEY);

    let counter = 0;
    sendMessageSpy = vi.spyOn(whatsappBrokerClient, 'sendMessage').mockImplementation(
      async (_instanceId, payload) => {
        counter += 1;
        return {
          externalId: `wamid-${counter.toString().padStart(3, '0')}`,
          status: 'SENT',
          timestamp: new Date().toISOString(),
          raw: { payload },
        };
      }
    );
  });

  afterEach(() => {
    registerSocketServer(null);
    sendMessageSpy.mockRestore();
    queueFindFirstMock.mockReset();
    contactFindUniqueMock.mockReset();
    contactUpdateMock.mockReset();
    contactCreateMock.mockReset();
    whatsAppInstanceFindUniqueMock.mockReset();
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
      });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      queued: true,
      ticketId: ticket.id,
      status: 'SENT',
      error: null,
    });

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy).toHaveBeenCalledWith('instance-001', expect.objectContaining({
      to: '+554499999999',
      type: 'TEXT',
    }));

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
    expect(metricsSnapshot).toContain('whatsapp_outbound_total{instanceId="instance-001",status="SENT"} 1');
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

    sendMessageSpy.mockRejectedValueOnce(
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

    sendMessageSpy.mockRejectedValueOnce(
      new WhatsAppBrokerError('Session disconnected', 'SESSION_NOT_CONNECTED', 409, 'req-409')
    );

    const app = buildApp();
    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/messages`)
      .send({
        instanceId: 'instance-001',
        payload: {
          type: 'text',
          text: 'Mensagem que falhará',
        },
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

    sendMessageSpy.mockRejectedValueOnce(
      new WhatsAppBrokerError('Invalid recipient number', 'INVALID_RECIPIENT', 400, 'req-400')
    );

    const app = buildApp();
    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/messages`)
      .send({
        instanceId: 'instance-001',
        payload: {
          type: 'text',
          text: 'Mensagem inválida',
        },
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

    sendMessageSpy.mockRejectedValueOnce(
      new WhatsAppBrokerError('Rate limit reached', 'RATE_LIMIT_EXCEEDED', 429, 'req-429')
    );

    const app = buildApp();
    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/messages`)
      .send({
        instanceId: 'instance-001',
        payload: {
          type: 'text',
          text: 'Mensagem bloqueada por rate limit',
        },
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
      });

    expect(first.status).toBe(202);
    const messageId = first.body.messageId;

    sendMessageSpy.mockClear();

    const second = await request(app)
      .post(`/api/tickets/${ticket.id}/messages`)
      .set('Idempotency-Key', 'idem-123')
      .send({
        instanceId: 'instance-001',
        payload: {
          type: 'text',
          text: 'Mensagem idempotente',
        },
      });

    expect(second.status).toBe(202);
    expect(second.body.messageId).toBe(messageId);
    expect(second.body.status).toBe(first.body.status);
    expect(sendMessageSpy).not.toHaveBeenCalled();
  });

  it('supports legacy payload shape when sending ad-hoc WhatsApp messages', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/integrations/whatsapp/instances/instance-001/messages')
      .set('Idempotency-Key', 'legacy-shape-1')
      .send({
        to: '+55 44 9999-9999',
        type: 'text',
        text: 'Mensagem com formato legado',
      });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      queued: true,
      status: 'SENT',
      error: null,
    });

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy).toHaveBeenCalledWith(
      'instance-001',
      expect.objectContaining({
        type: 'TEXT',
        content: 'Mensagem com formato legado',
      })
    );
  });

  it('surfaces normalized broker errors for ad-hoc sends', async () => {
    sendMessageSpy.mockRejectedValueOnce(
      new WhatsAppBrokerError('Invalid destination number', 'INVALID_DESTINATION', 400, 'adhoc-400')
    );

    const app = buildApp();
    const response = await request(app)
      .post('/api/integrations/whatsapp/instances/instance-001/messages')
      .send({
        to: '+55 44 9999-9999',
        payload: {
          type: 'text',
          text: 'Falha controlada',
        },
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
      .send({
        to: '+55 44 9999-9999',
        payload: {
          type: 'text',
          text: 'Mensagem com instância offline',
        },
      });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INSTANCE_DISCONNECTED',
      },
    });
    expect(sendMessageSpy).not.toHaveBeenCalled();
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
      });

    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({
      error: {
        code: 'RATE_LIMITED',
      },
    });
  });
});
