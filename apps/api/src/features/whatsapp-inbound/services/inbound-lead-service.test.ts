import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resetInboundLeadServiceTestState,
  __testing,
} from './inbound-lead-service';

import type * as TicketService from '../../../services/ticket-service';
import type { PrismaClient } from '@prisma/client';

vi.mock('../../../lib/socket-registry.js', () => {
  const emitToTenant = vi.fn();
  const emitToTicket = vi.fn();
  const emitToAgreement = vi.fn();
  const emitToCampaign = vi.fn();
  const getSocketServer = vi.fn(() => null);
  return {
    emitToTenant,
    emitToTicket,
    emitToAgreement,
    emitToCampaign,
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

const { emitRealtimeUpdatesForInbound } = __testing;
type SendMessageResult = Awaited<ReturnType<typeof TicketService.sendMessage>>;
let emitToTenantMock: ReturnType<typeof vi.fn>;
let emitToTicketMock: ReturnType<typeof vi.fn>;
let emitToAgreementMock: ReturnType<typeof vi.fn>;
let emitToCampaignMock: ReturnType<typeof vi.fn>;
let prismaClientMock: PrismaClient;

beforeAll(async () => {
  const socketModule = await import('../../../lib/socket-registry.js');
  const prismaModule = await import('../../../lib/prisma.js');
  emitToTenantMock = socketModule.emitToTenant as unknown as ReturnType<typeof vi.fn>;
  emitToTicketMock = socketModule.emitToTicket as unknown as ReturnType<typeof vi.fn>;
  emitToAgreementMock = socketModule.emitToAgreement as unknown as ReturnType<typeof vi.fn>;
  emitToCampaignMock = socketModule.emitToCampaign as unknown as ReturnType<typeof vi.fn>;
  prismaClientMock = prismaModule.prisma as PrismaClient;
});


describe('emitRealtimeUpdatesForInbound', () => {
  const baseMessage = {
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

  beforeEach(() => {
    resetInboundLeadServiceTestState();
    emitToTenantMock.mockClear();
    emitToTicketMock.mockClear();
    emitToAgreementMock.mockClear();
    emitToCampaignMock.mockClear();
    (prismaClientMock.ticket.findUnique as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it('emits realtime updates even when ticket tenant differs from event tenant when enabled', async () => {
    (prismaClientMock.ticket.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'ticket-cross',
      tenantId: 'tenant-database',
      agreementId: 'agreement-cross',
      campaignId: 'campaign-cross',
      status: 'OPEN',
      updatedAt: new Date('2024-01-03T09:00:00.000Z'),
      queueId: 'queue-cross',
      subject: 'Contato WhatsApp',
      metadata: {},
    });

    await emitRealtimeUpdatesForInbound({
      tenantId: 'tenant-event',
      ticketId: 'ticket-cross',
      instanceId: 'inst-cross',
      message: baseMessage,
      providerMessageId: 'wamid.cross',
    });

    // Desde 9182ab76 o fluxo inbound emite ticketMessages.new/leadActivities.new (tickets.updated
    // sai da camada de tickets); desde 6f3dcc26 a sala de agreement deu lugar à de campanha.
    const envelope = expect.objectContaining({
      tenantId: 'tenant-event',
      ticket: { id: 'ticket-cross', agreementId: 'agreement-cross', campaignId: 'campaign-cross' },
      providerMessageId: 'wamid.cross',
    });
    expect(emitToTenantMock).toHaveBeenCalledWith('tenant-event', 'ticketMessages.new', envelope);
    expect(emitToTicketMock).toHaveBeenCalledWith('ticket-cross', 'ticketMessages.new', envelope);
    expect(emitToTenantMock).toHaveBeenCalledWith('tenant-event', 'leadActivities.new', envelope);
    expect(emitToTicketMock).toHaveBeenCalledWith('ticket-cross', 'leadActivities.new', envelope);
    expect(emitToCampaignMock).toHaveBeenCalledWith('campaign-cross', 'leadActivities.new', envelope);
    // Nunca emite para o tenant gravado no ticket quando ele difere do tenant do evento.
    expect(emitToTenantMock).not.toHaveBeenCalledWith('tenant-database', expect.anything(), expect.anything());
    expect(emitToAgreementMock).not.toHaveBeenCalled();
  });

  it('propagates null instance identifiers in realtime payloads', async () => {
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

    await emitRealtimeUpdatesForInbound({
      tenantId: 'tenant-event',
      ticketId: 'ticket-cross',
      instanceId: null,
      message: baseMessage,
      providerMessageId: 'wamid.cross',
    });

    expect(emitToTenantMock).toHaveBeenCalledWith(
      'tenant-event',
      'ticketMessages.new',
      expect.objectContaining({ instanceId: null })
    );
    expect(emitToTicketMock).toHaveBeenCalledWith(
      'ticket-cross',
      'ticketMessages.new',
      expect.objectContaining({ instanceId: null })
    );
    // Sem campaignId no ticket, não há sala de campanha para notificar.
    expect(emitToCampaignMock).not.toHaveBeenCalled();
  });

  it('skips redundant realtime updates when message creation already emitted them', async () => {
    await emitRealtimeUpdatesForInbound({
      tenantId: 'tenant-event',
      ticketId: 'ticket-cross',
      instanceId: 'inst-cross',
      message: baseMessage,
      providerMessageId: 'wamid.cross',
      emitTicketRealtimeEvents: false,
    });

    expect(emitToTenantMock).not.toHaveBeenCalled();
    expect(emitToTicketMock).not.toHaveBeenCalled();
    expect(emitToAgreementMock).not.toHaveBeenCalled();
    expect(emitToCampaignMock).not.toHaveBeenCalled();
    expect(prismaClientMock.ticket.findUnique).not.toHaveBeenCalled();
  });
});
