import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  ensureTenantRecordMock,
  createTicketMock,
  getDefaultQueueIdForTenantMock,
  sendMessageMock,
  prismaMock,
} = vi.hoisted(() => ({
  ensureTenantRecordMock: vi.fn(),
  createTicketMock: vi.fn(),
  getDefaultQueueIdForTenantMock: vi.fn(),
  sendMessageMock: vi.fn(),
  prismaMock: {
    contact: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    lead: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  } as Record<string, any>,
}));

vi.mock('../../services/tenant-service', () => ({
  ensureTenantRecord: ensureTenantRecordMock,
}));

vi.mock('../../services/ticket-service', () => ({
  createTicket: createTicketMock,
  getTicketById: vi.fn(),
  getDefaultQueueIdForTenant: getDefaultQueueIdForTenantMock,
  sendMessage: sendMessageMock,
}));

vi.mock('../../lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../../middleware/auth', () => ({
  requireTenant: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = {
      id: 'missing-user-id',
      tenantId: 'tenant-1',
      email: 'anonymous@example.com',
      name: 'MVP Anonymous',
      role: 'ADMIN',
      isActive: true,
      permissions: [],
    };
    next();
  },
}));

import { manualConversationsRouter } from '../manual-conversations';

describe('manual conversations route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.contact.findUnique.mockReset();
    prismaMock.contact.create.mockReset();
    prismaMock.lead.create.mockReset();
    prismaMock.lead.findUnique.mockReset();
    prismaMock.lead.update.mockReset();
    prismaMock.user.findUnique.mockReset();
    ensureTenantRecordMock.mockReset();
    getDefaultQueueIdForTenantMock.mockReset();
    createTicketMock.mockReset();
    sendMessageMock.mockReset();
  });

  it('creates outbound message without actor when the operator lookup fails', async () => {
    const contact = {
      id: 'contact-1',
      tenantId: 'tenant-1',
      name: 'Contact 5511999999999',
      phone: '5511999999999',
    };

    const lead = {
      id: 'lead-1',
      tenantId: 'tenant-1',
      contactId: contact.id,
      source: 'WHATSAPP',
      status: 'NEW',
      notes: 'Olá',
      contact,
      campaign: null,
      assignee: null,
    };

    const ticket = {
      id: 'ticket-1',
      tenantId: 'tenant-1',
      contactId: contact.id,
      queueId: 'queue-1',
      subject: 'Contact 5511999999999',
      channel: 'WHATSAPP',
      priority: 'NORMAL',
      metadata: {},
    };

    const messageRecord = {
      id: 'message-1',
      ticketId: ticket.id,
      tenantId: 'tenant-1',
      content: 'Olá',
      direction: 'OUTBOUND',
      type: 'TEXT',
      userId: null,
      metadata: {},
    };

    prismaMock.contact.findUnique.mockResolvedValue(contact);
    prismaMock.lead.create.mockResolvedValue(lead);
    prismaMock.user.findUnique.mockResolvedValue(null);

    ensureTenantRecordMock.mockResolvedValue(undefined);
    getDefaultQueueIdForTenantMock.mockResolvedValue('queue-1');
    createTicketMock.mockResolvedValue(ticket);
    sendMessageMock.mockResolvedValue(messageRecord);

    const app = express();
    app.use(express.json());
    app.use('/api/manual-conversations', manualConversationsRouter);

    const response = await request(app)
      .post('/api/manual-conversations')
      .send({ phone: '5511999999999', message: ' Olá ' })
      .expect(201);

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { id: 'missing-user-id' } });
    expect(sendMessageMock).toHaveBeenCalledWith(
      'tenant-1',
      undefined,
      expect.objectContaining({
        ticketId: 'ticket-1',
        content: 'Olá',
        direction: 'OUTBOUND',
      })
    );
    expect(response.body?.data?.messageRecord).toEqual(messageRecord);
  });
});

