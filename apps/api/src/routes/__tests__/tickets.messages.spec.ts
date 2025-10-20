import express, { type Request } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '../../types/tickets';
import {
  WhatsAppBrokerError,
  WhatsAppBrokerNotConfiguredError,
} from '../../services/whatsapp-broker-client';

const {
  findOrCreateOpenTicketByChatMock,
  upsertMessageByExternalIdMock,
  transportSendMessageMock,
} = vi.hoisted(() => ({
  findOrCreateOpenTicketByChatMock: vi.fn(),
  upsertMessageByExternalIdMock: vi.fn(),
  transportSendMessageMock: vi.fn(),
}));

const sendMessageMock = vi.fn();

vi.mock('@ticketz/storage', async () => {
  const actual = await import('../../test-utils/storage-mock');
  return {
    ...actual,
    findOrCreateOpenTicketByChat: findOrCreateOpenTicketByChatMock,
    upsertMessageByExternalId: upsertMessageByExternalIdMock,
  };
});

vi.mock('../../services/ticket-service', async () => {
  const actual = await vi.importActual<typeof import('../../services/ticket-service')>(
    '../../services/ticket-service'
  );
  return {
    ...actual,
    sendMessage: (...args: Parameters<typeof actual.sendMessage>) => sendMessageMock(...args),
  };
});

vi.mock('../../middleware/auth', async () => {
  const actual = await vi.importActual<typeof import('../../middleware/auth')>('../../middleware/auth');
  return {
    ...actual,
    requireTenant: (_req: unknown, _res: unknown, next: () => void) => next(),
  };
});

vi.mock('../../features/whatsapp-transport', () => ({
  getWhatsAppTransport: () => ({
    sendMessage: transportSendMessageMock,
  }),
}));

import { ticketsRouter } from '../tickets';
import { errorHandler } from '../../middleware/error-handler';

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
  app.use('/api/tickets', ticketsRouter);
  app.use(errorHandler);
  return app;
};

describe('POST /api/tickets/messages validations', () => {
  beforeEach(() => {
    sendMessageMock.mockReset();
    findOrCreateOpenTicketByChatMock.mockReset();
    upsertMessageByExternalIdMock.mockReset();
    transportSendMessageMock.mockReset();

    findOrCreateOpenTicketByChatMock.mockResolvedValue({
      ticket: { id: 'ticket-mock' },
      wasCreated: false,
    });

    upsertMessageByExternalIdMock.mockResolvedValue({
      message: { id: 'message-mock', externalId: 'wamid-mock' },
      wasCreated: true,
    });

    transportSendMessageMock.mockResolvedValue({
      externalId: 'wamid-mock',
      status: 'SENT',
      timestamp: new Date().toISOString(),
    });
  });

  it('accepts location messages with latitude/longitude metadata', async () => {
    const app = buildApp();
    const ticketId = '00000000-0000-4000-8000-000000000001';
    const responsePayload = {
      id: 'message-location',
      ticketId,
      content: null,
      metadata: { location: { latitude: -23.55, longitude: -46.63, name: 'Base' } },
    } as unknown as Message;

    sendMessageMock.mockResolvedValueOnce(responsePayload);

    const response = await request(app).post('/api/tickets/messages').send({
      ticketId,
      type: 'LOCATION',
      location: { latitude: -23.55, longitude: '-46.63', name: ' Base ' },
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    const [, , payload] = sendMessageMock.mock.calls[0];
    expect(payload.metadata).toMatchObject({
      location: { latitude: -23.55, longitude: -46.63, name: 'Base' },
    });
  });

  it('rejects location messages missing coordinates', async () => {
    const app = buildApp();
    const ticketId = '00000000-0000-4000-8000-000000000002';

    const response = await request(app).post('/api/tickets/messages').send({
      ticketId,
      type: 'LOCATION',
      location: { name: 'Sem coordenadas' },
    });

    expect(response.status).toBe(400);
    expect(response.body?.error?.code).toBe('VALIDATION_ERROR');
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('accepts contact messages carrying vCard or structured data', async () => {
    const app = buildApp();
    const ticketId = '00000000-0000-4000-8000-000000000003';
    const message = { id: 'message-contact', ticketId, metadata: {} } as unknown as Message;
    sendMessageMock.mockResolvedValueOnce(message);

    const response = await request(app).post('/api/tickets/messages').send({
      ticketId,
      type: 'CONTACT',
      contact: { name: 'Alice', phones: ['+5511999999999'] },
    });

    expect(response.status).toBe(201);
    const [, , payload] = sendMessageMock.mock.calls[0];
    expect(payload.metadata).toMatchObject({
      contacts: [
        {
          name: 'Alice',
          phones: ['+5511999999999'],
        },
      ],
    });
  });

  it('rejects contact messages without any payload', async () => {
    const app = buildApp();
    const ticketId = '00000000-0000-4000-8000-000000000004';

    const response = await request(app).post('/api/tickets/messages').send({
      ticketId,
      type: 'CONTACT',
    });

    expect(response.status).toBe(400);
    expect(response.body?.error?.code).toBe('VALIDATION_ERROR');
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('accepts template messages and stores template metadata', async () => {
    const app = buildApp();
    const ticketId = '00000000-0000-4000-8000-000000000005';
    const message = { id: 'message-template', ticketId, metadata: {} } as unknown as Message;
    sendMessageMock.mockResolvedValueOnce(message);

    const response = await request(app).post('/api/tickets/messages').send({
      ticketId,
      type: 'TEMPLATE',
      template: {
        name: 'order_update',
        namespace: 'commerce',
        language: 'pt_BR',
        components: [{ type: 'body', parameters: [{ type: 'text', text: 'Olá' }] }],
      },
    });

    expect(response.status).toBe(201);
    const [, , payload] = sendMessageMock.mock.calls[0];
    expect(payload.metadata).toMatchObject({
      template: {
        name: 'order_update',
        namespace: 'commerce',
        language: 'pt_BR',
      },
    });
    expect(payload.metadata?.template?.components).toBeDefined();
  });

  it('rejects template messages without a valid template payload', async () => {
    const app = buildApp();
    const ticketId = '00000000-0000-4000-8000-000000000006';

    const response = await request(app).post('/api/tickets/messages').send({
      ticketId,
      type: 'TEMPLATE',
      template: { namespace: 'missing-name' },
    });

    expect(response.status).toBe(400);
    expect(response.body?.error?.code).toBe('VALIDATION_ERROR');
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('normalizes uppercase media types when sending outbound chat messages', async () => {
    const app = buildApp();

    findOrCreateOpenTicketByChatMock.mockResolvedValueOnce({
      ticket: { id: 'ticket-chat-123', contactId: 'contact-1' },
      wasCreated: true,
    });
    upsertMessageByExternalIdMock.mockResolvedValueOnce({
      message: { id: 'message-chat-1', ticketId: 'ticket-chat-123', externalId: 'wamid-chat' },
      wasCreated: true,
    });

    const response = await request(app).post('/api/tickets/messages').send({
      chatId: '5511999999999',
      iid: 'instance-abc',
      type: 'IMAGE',
      media: {
        mediaType: 'IMAGE',
        mediaUrl: 'https://cdn.example.com/image.jpg',
        caption: '  Check this out  ',
      },
    });

    expect(response.status).toBe(200);
    expect(transportSendMessageMock).toHaveBeenCalledTimes(1);

    const [instanceId, transportPayload] = transportSendMessageMock.mock.calls[0];
    expect(instanceId).toBe('instance-abc');
    expect(transportPayload).toMatchObject({
      type: 'image',
      caption: 'Check this out',
      media: expect.objectContaining({
        mediaType: 'image',
        mediaUrl: 'https://cdn.example.com/image.jpg',
      }),
    });

    expect(upsertMessageByExternalIdMock).toHaveBeenCalledTimes(1);
    const storagePayload = upsertMessageByExternalIdMock.mock.calls[0]?.[0];
    expect(storagePayload.media).toMatchObject({
      mediaType: 'image',
      url: 'https://cdn.example.com/image.jpg',
      caption: 'Check this out',
    });

    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      ticketId: 'ticket-chat-123',
      messageId: 'message-chat-1',
      externalId: 'wamid-chat',
    });
  });

  it('returns 502 when the broker rejects the send request', async () => {
    const app = buildApp();
    const ticketId = '00000000-0000-4000-8000-000000000007';
    const brokerError = new WhatsAppBrokerError('broker rejected message', { code: 'INSTANCE_NOT_CONNECTED' });
    sendMessageMock.mockRejectedValueOnce(brokerError);

    const response = await request(app).post('/api/tickets/messages').send({
      ticketId,
      type: 'TEXT',
      content: 'Hello!',
    });

    expect(response.status).toBe(502);
    expect(response.body).toMatchObject({ code: 'BROKER_ERROR' });
  });

  it('returns 503 when the broker is not configured', async () => {
    const app = buildApp();
    const ticketId = '00000000-0000-4000-8000-000000000008';
    const configurationError = new WhatsAppBrokerNotConfiguredError();
    sendMessageMock.mockRejectedValueOnce(configurationError);

    const response = await request(app).post('/api/tickets/messages').send({
      ticketId,
      type: 'TEXT',
      content: 'Hello!',
    });

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ code: 'BROKER_NOT_CONFIGURED' });
  });
});
