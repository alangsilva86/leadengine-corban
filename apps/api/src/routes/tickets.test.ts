import express from 'express';
import type { Request } from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@ticketz/storage', () => import('../test-utils/storage-mock'));

import { ticketsRouter } from './tickets';
import { errorHandler } from '../middleware/error-handler';
import { registerSocketServer, type SocketServerAdapter } from '../lib/socket-registry';
import { resetTicketStore } from '@ticketz/storage';
import { WhatsAppBrokerNotConfiguredError } from '../services/whatsapp-broker-client';
import * as ticketService from '../services/ticket-service';

vi.mock('../middleware/auth', () => ({
  requireTenant: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

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

const startTestServer = async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as Request).user = {
      id: '44444444-4444-4444-4444-444444444444',
      tenantId: 'tenant-123',
      email: 'agent@example.com',
      name: 'Agent Smith',
      role: 'AGENT',
      isActive: true,
      permissions: ['tickets:read', 'tickets:write'],
    };
    next();
  });
  app.use('/api/tickets', ticketsRouter);
  app.use(errorHandler);

  return new Promise<{ server: Server; url: string }>((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
};

const stopTestServer = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

describe('Tickets routes', () => {
  let mockSocket: MockSocketServer;

  beforeEach(async () => {
    mockSocket = new MockSocketServer();
    registerSocketServer(mockSocket as unknown as SocketServerAdapter);
    await resetTicketStore();
  });

  afterEach(() => {
    registerSocketServer(null);
    vi.restoreAllMocks();
  });

  it('handles ticket lifecycle end-to-end', async () => {
    const { server, url } = await startTestServer();

    try {
      const contactId = '00000000-0000-4000-8000-000000000111';
      const queueId = '00000000-0000-4000-8000-000000000222';

      const createResponse = await fetch(`${url}/api/tickets`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({
          contactId,
          queueId,
          subject: 'Support request',
          channel: 'WHATSAPP',
          priority: 'HIGH',
          tags: ['vip'],
          metadata: { source: 'test' },
        }),
      });

      expect(createResponse.status).toBe(201);
      const createdBody = await createResponse.json();
      expect(createdBody.success).toBe(true);
      const createdTicket = createdBody.data;
      expect(createdTicket).toMatchObject({
        contactId,
        queueId,
        status: 'OPEN',
        priority: 'HIGH',
      });

      const ticketId = createdTicket.id as string;

      const listResponse = await fetch(`${url}/api/tickets?limit=10`, {
        headers: { 'x-tenant-id': 'tenant-123' },
      });
      expect(listResponse.status).toBe(200);
      const listBody = await listResponse.json();
      expect(listBody.data.items).toHaveLength(1);
      expect(listBody.data.total).toBe(1);

      const getResponse = await fetch(`${url}/api/tickets/${ticketId}`, {
        headers: { 'x-tenant-id': 'tenant-123' },
      });
      expect(getResponse.status).toBe(200);
      const getBody = await getResponse.json();
      expect(getBody.data.id).toBe(ticketId);

      const updateResponse = await fetch(`${url}/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({
          status: 'PENDING',
          priority: 'URGENT',
          tags: ['vip', 'follow-up'],
        }),
      });
      expect(updateResponse.status).toBe(200);
      const updateBody = await updateResponse.json();
      expect(updateBody.data.status).toBe('PENDING');
      expect(updateBody.data.priority).toBe('URGENT');
      expect(updateBody.data.tags).toContain('follow-up');

      const assignResponse = await fetch(`${url}/api/tickets/${ticketId}/assign`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({ userId: '44444444-4444-4444-4444-444444444444' }),
      });
      expect(assignResponse.status).toBe(200);
      const assignBody = await assignResponse.json();
      expect(assignBody.data.userId).toBe('44444444-4444-4444-4444-444444444444');
      expect(assignBody.data.status).toBe('ASSIGNED');

      const messageResponse = await fetch(`${url}/api/tickets/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({
          ticketId,
          content: 'Hello from support',
          type: 'TEXT',
        }),
      });
      expect(messageResponse.status).toBe(201);
      const messageBody = await messageResponse.json();
      expect(messageBody.data.ticketId).toBe(ticketId);
      expect(messageBody.data.content).toBe('Hello from support');

      const messagesListResponse = await fetch(`${url}/api/tickets/${ticketId}/messages`, {
        headers: { 'x-tenant-id': 'tenant-123' },
      });
      expect(messagesListResponse.status).toBe(200);
      const messagesListBody = await messagesListResponse.json();
      expect(messagesListBody.data.items).toHaveLength(1);

      const closeResponse = await fetch(`${url}/api/tickets/${ticketId}/close`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({ reason: 'Issue resolved' }),
      });
      expect(closeResponse.status).toBe(200);
      const closeBody = await closeResponse.json();
      expect(closeBody.data.status).toBe('CLOSED');
      expect(closeBody.data.closeReason).toBe('Issue resolved');

      const finalGetResponse = await fetch(`${url}/api/tickets/${ticketId}`, {
        headers: { 'x-tenant-id': 'tenant-123' },
      });
      const finalBody = await finalGetResponse.json();
      expect(finalBody.data.status).toBe('CLOSED');
      expect(finalBody.data.lastMessageAt).toBeTruthy();

      const emittedEvents = mockSocket.events.map((item) => item.event);
      expect(emittedEvents).toContain('ticket.created');
      expect(emittedEvents).not.toContain('ticket.updated');
      expect(emittedEvents).not.toContain('ticket.assigned');
      expect(emittedEvents).not.toContain('ticket.message');
      expect(emittedEvents).toContain('messages.new');
      expect(emittedEvents).not.toContain('ticket.closed');
      const ticketsUpdatedCount = emittedEvents.filter((event) => event === 'tickets.updated').length;
      expect(ticketsUpdatedCount).toBeGreaterThanOrEqual(4);
    } finally {
      await stopTestServer(server);
    }
  });

  it('orders tickets by last interaction without explicit sort', async () => {
    const { server, url } = await startTestServer();

    const tenantHeaders = {
      'content-type': 'application/json',
      'x-tenant-id': 'tenant-123',
    } as const;

    const createTicket = async (contactId: string, subject: string) => {
      const response = await fetch(`${url}/api/tickets`, {
        method: 'POST',
        headers: tenantHeaders,
        body: JSON.stringify({
          contactId,
          queueId: '00000000-0000-4000-8000-000000000555',
          subject,
          channel: 'WHATSAPP',
        }),
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      return body.data.id as string;
    };

    const sendMessage = async (ticketId: string, isoTimestamp: string, content: string) => {
      const response = await fetch(`${url}/api/tickets/messages`, {
        method: 'POST',
        headers: tenantHeaders,
        body: JSON.stringify({
          ticketId,
          content,
          metadata: { normalizedTimestamp: isoTimestamp },
        }),
      });

      expect(response.status).toBe(201);
    };

    try {
      const ticketOlder = await createTicket('00000000-0000-4000-8000-000000000211', 'Old interaction');
      const ticketNewer = await createTicket('00000000-0000-4000-8000-000000000212', 'Recent interaction');
      const ticketWithoutMessages = await createTicket(
        '00000000-0000-4000-8000-000000000213',
        'No interactions yet'
      );

      await sendMessage(ticketOlder, '2024-01-01T10:00:00.000Z', 'First reply');
      await sendMessage(ticketNewer, '2024-01-02T15:30:00.000Z', 'Follow-up reply');

      const listResponse = await fetch(`${url}/api/tickets?limit=10`, {
        headers: { 'x-tenant-id': 'tenant-123' },
      });

      expect(listResponse.status).toBe(200);
      const listBody = await listResponse.json();
      const returnedIds = listBody.data.items.map((ticket: { id: string }) => ticket.id);

      expect(returnedIds.slice(0, 3)).toEqual([
        ticketNewer,
        ticketOlder,
        ticketWithoutMessages,
      ]);

      expect(listBody.data.items[0].lastMessageAt).toBeTruthy();
      expect(listBody.data.items[1].lastMessageAt).toBeTruthy();
      expect(listBody.data.items[2].lastMessageAt).toBeUndefined();
    } finally {
      await stopTestServer(server);
    }
  });

  it('returns 503 when broker is not configured for ticket messages', async () => {
    const { server, url } = await startTestServer();

    const ticketId = '00000000-0000-4000-8000-000000000123';
    const brokerError = new WhatsAppBrokerNotConfiguredError('Broker disabled');
    const sendMessageSpy = vi
      .spyOn(ticketService, 'sendMessage')
      .mockRejectedValue(brokerError);

    try {
      const response = await fetch(`${url}/api/tickets/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tenant-id': 'tenant-123',
        },
        body: JSON.stringify({
          ticketId,
          content: 'Mensagem de teste',
          type: 'TEXT',
        }),
      });

      expect(sendMessageSpy).toHaveBeenCalledWith(
        'tenant-123',
        '44444444-4444-4444-4444-444444444444',
        expect.objectContaining({
          ticketId,
          direction: 'OUTBOUND',
        })
      );

      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body).toEqual({ code: 'BROKER_NOT_CONFIGURED' });
    } finally {
      await stopTestServer(server);
    }
  });

  it('rejects ticket queries when tenant header mismatches authenticated tenant', async () => {
    const { server, url } = await startTestServer();

    try {
      const response = await fetch(`${url}/api/tickets`, {
        headers: { 'x-tenant-id': 'tenant-other' },
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    } finally {
      await stopTestServer(server);
    }
  });
});
