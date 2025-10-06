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
import { whatsappBrokerClient } from '../../services/whatsapp-broker-client';

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
