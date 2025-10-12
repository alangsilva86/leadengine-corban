import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resetInboundLeadServiceTestState,
  __testing,
} from './inbound-lead-service';

vi.mock('../../../lib/socket-registry', () => ({
  emitToTenant: vi.fn(),
  emitToTicket: vi.fn(),
  emitToAgreement: vi.fn(),
  getSocketServer: vi.fn(() => null),
}));

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    ticket: {
      findUnique: vi.fn(),
    },
  },
}));

const { emitPassthroughRealtimeUpdates } = __testing;
const socketModule = await import('../../../lib/socket-registry');
const emitToTenantMock = socketModule.emitToTenant as unknown as ReturnType<typeof vi.fn>;
const emitToTicketMock = socketModule.emitToTicket as unknown as ReturnType<typeof vi.fn>;
const emitToAgreementMock = socketModule.emitToAgreement as unknown as ReturnType<typeof vi.fn>;
const { prisma } = await import('../../../lib/prisma');

describe('emitPassthroughRealtimeUpdates', () => {
  beforeEach(() => {
    resetInboundLeadServiceTestState();
    emitToTenantMock.mockClear();
    emitToTicketMock.mockClear();
    emitToAgreementMock.mockClear();
    (prisma.ticket.findUnique as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it('emits tickets.updated and tickets.new payloads when a passthrough ticket is created', async () => {
    (prisma.ticket.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
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
});
