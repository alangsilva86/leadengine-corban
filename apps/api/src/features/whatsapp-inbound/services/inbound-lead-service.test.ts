import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resetInboundLeadServiceTestState,
  __testing,
} from './inbound-lead-service';

import type * as TicketService from '../../../../services/ticket-service.js';
import type { PrismaClient } from '@prisma/client';

vi.mock('../../../lib/socket-registry.js', () => {
  const emitToTenant = vi.fn();
  const emitToTicket = vi.fn();
  const emitToAgreement = vi.fn();
  const getSocketServer = vi.fn(() => null);
  return {
    emitToTenant,
    emitToTicket,
    emitToAgreement,
    getSocketServer,
  };
});

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    ticket: {
      findUnique: vi.fn(),
    },
  },
}));

const { emitPassthroughRealtimeUpdates, emitRealtimeUpdatesForInbound } = __testing;
type SendMessageResult = Awaited<ReturnType<typeof TicketService.sendMessage>>;
let emitToTenantMock: ReturnType<typeof vi.fn>;
let emitToTicketMock: ReturnType<typeof vi.fn>;
let emitToAgreementMock: ReturnType<typeof vi.fn>;
let prismaClientMock: PrismaClient;

beforeAll(async () => {
  const socketModule = await import('../../../lib/socket-registry.js');
  const prismaModule = await import('../../../lib/prisma.js');
  emitToTenantMock = socketModule.emitToTenant as unknown as ReturnType<typeof vi.fn>;
  emitToTicketMock = socketModule.emitToTicket as unknown as ReturnType<typeof vi.fn>;
  emitToAgreementMock = socketModule.emitToAgreement as unknown as ReturnType<typeof vi.fn>;
  prismaClientMock = prismaModule.prisma as PrismaClient;
});

describe('emitPassthroughRealtimeUpdates', () => {
  beforeEach(() => {
    resetInboundLeadServiceTestState();
    emitToTenantMock.mockClear();
    emitToTicketMock.mockClear();
    emitToAgreementMock.mockClear();
    (prismaClientMock.ticket.findUnique as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it('emits tickets.updated and tickets.new payloads when a passthrough ticket is created', async () => {
    (prismaClientMock.ticket.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'ticket-1',
      tenantId: 'tenant-1',
      agreementId: 'agreement-1',
      status: 'OPEN',
      updatedAt: new Date('2024-01-01T12:05:00.000Z'),
      queueId: 'queue-1',
      subject: 'Contato WhatsApp',
      metadata: {},
    });

    await emitPassthroughRealtimeUpdates({
      tenantId: 'tenant-1',
      ticketId: 'ticket-1',
      instanceId: 'inst-1',
      ticketWasCreated: true,
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
    });

    const updatedCall = emitToTenantMock.mock.calls.find(([, event]) => event === 'tickets.updated');
    expect(updatedCall).toBeTruthy();
    const updatedPayload = updatedCall?.[2] as Record<string, unknown> | undefined;
    expect(updatedPayload).toMatchObject({
      tenantId: 'tenant-1',
      ticketId: 'ticket-1',
      messageId: 'message-1',
      providerMessageId: 'wamid.123',
    });

    const newCall = emitToTenantMock.mock.calls.find(([, event]) => event === 'tickets.new');
    expect(newCall).toBeTruthy();
    expect(newCall?.[2]).toEqual(updatedPayload);

    expect(emitToTicketMock).toHaveBeenCalledWith('ticket-1', 'tickets.updated', expect.any(Object));
    expect(emitToTicketMock).toHaveBeenCalledWith('ticket-1', 'tickets.new', expect.any(Object));
    expect(emitToAgreementMock).toHaveBeenCalledWith('agreement-1', 'tickets.updated', expect.any(Object));
    expect(emitToAgreementMock).toHaveBeenCalledWith('agreement-1', 'tickets.new', expect.any(Object));
  });

  it('propagates realtime events even when the persisted ticket belongs to another tenant', async () => {
    (prismaClientMock.ticket.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'ticket-foreign',
      tenantId: 'tenant-foreign',
      agreementId: 'agreement-foreign',
      status: 'OPEN',
      updatedAt: new Date('2024-01-02T08:00:00.000Z'),
      queueId: 'queue-foreign',
      subject: 'Contato WhatsApp',
      metadata: {},
    });

    await emitPassthroughRealtimeUpdates({
      tenantId: 'tenant-event',
      ticketId: 'ticket-foreign',
      instanceId: 'inst-foreign',
      ticketWasCreated: false,
      message: {
        id: 'message-foreign',
        tenantId: 'tenant-event',
        ticketId: 'ticket-foreign',
        chatId: 'chat-foreign',
        direction: 'inbound',
        type: 'text',
        text: 'Olá de outro tenant',
        media: null,
        metadata: {},
        createdAt: new Date('2024-01-02T08:00:00.000Z'),
        externalId: 'wamid.foreign',
      },
    });

    expect(emitToTenantMock).toHaveBeenCalledWith('tenant-event', 'tickets.updated', expect.any(Object));
    expect(emitToTicketMock).toHaveBeenCalledWith('ticket-foreign', 'tickets.updated', expect.any(Object));
    expect(emitToAgreementMock).toHaveBeenCalledWith(
      'agreement-foreign',
      'tickets.updated',
      expect.any(Object)
    );
  });
});

describe('emitRealtimeUpdatesForInbound', () => {
  beforeEach(() => {
    resetInboundLeadServiceTestState();
    emitToTenantMock.mockClear();
    emitToTicketMock.mockClear();
    emitToAgreementMock.mockClear();
    (prismaClientMock.ticket.findUnique as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it('emits realtime updates even when ticket tenant differs from event tenant', async () => {
    (prismaClientMock.ticket.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'ticket-cross',
      tenantId: 'tenant-database',
      agreementId: 'agreement-cross',
      status: 'OPEN',
      updatedAt: new Date('2024-01-03T09:00:00.000Z'),
      queueId: 'queue-cross',
      subject: 'Contato WhatsApp',
      metadata: {},
    });

    const message = {
      id: 'message-cross',
      ticketId: 'ticket-cross',
      tenantId: 'tenant-event',
      direction: 'INBOUND',
      status: 'SENT',
      content: 'Olá cross tenant',
      metadata: { eventMetadata: { requestId: 'req-cross' } },
      createdAt: new Date('2024-01-03T09:00:00.000Z'),
      updatedAt: new Date('2024-01-03T09:00:00.000Z'),
    } as SendMessageResult;

    await emitRealtimeUpdatesForInbound({
      tenantId: 'tenant-event',
      ticketId: 'ticket-cross',
      instanceId: 'inst-cross',
      message,
      providerMessageId: 'wamid.cross',
    });

    expect(emitToTenantMock).toHaveBeenCalledWith('tenant-event', 'tickets.updated', expect.any(Object));
    expect(emitToTicketMock).toHaveBeenCalledWith('ticket-cross', 'tickets.updated', expect.any(Object));
    expect(emitToAgreementMock).toHaveBeenCalledWith(
      'agreement-cross',
      'tickets.updated',
      expect.any(Object)
    );
  });
});
