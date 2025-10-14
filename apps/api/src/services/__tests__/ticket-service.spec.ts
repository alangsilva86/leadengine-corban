import { beforeEach, describe, expect, it, vi } from 'vitest';

const logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock('../../config/logger', () => ({
  logger,
}));

const emitToTenant = vi.fn();
const emitToTicket = vi.fn();
const emitToUser = vi.fn();

vi.mock('../../lib/socket-registry', () => ({
  emitToTenant,
  emitToTicket,
  emitToUser,
}));

const storageFindTicketById = vi.fn();
const storageCreateMessage = vi.fn();
const storageUpdateMessage = vi.fn();
const storageFindMessageByExternalId = vi.fn();

vi.mock('@ticketz/storage', () => ({
  assignTicket: vi.fn(),
  closeTicket: vi.fn(),
  createMessage: storageCreateMessage,
  createTicket: vi.fn(),
  findTicketById: storageFindTicketById,
  findTicketsByContact: vi.fn(),
  findMessageByExternalId: storageFindMessageByExternalId,
  listMessages: vi.fn(),
  listTickets: vi.fn(),
  updateMessage: storageUpdateMessage,
  updateTicket: vi.fn(),
}));

const prisma = {
  contact: {
    findUnique: vi.fn(),
  },
  whatsAppInstance: {
    findUnique: vi.fn(),
  },
  ticket: {
    findUnique: vi.fn(),
  },
  queue: {
    findFirst: vi.fn(),
  },
};

vi.mock('../../lib/prisma', () => ({
  prisma,
}));

const whatsappOutboundMetrics = {
  incTotal: vi.fn(),
  observeLatency: vi.fn(),
};

const whatsappOutboundDeliverySuccessCounter = {
  inc: vi.fn(),
};

const whatsappSocketReconnectsCounter = {
  inc: vi.fn(),
};

vi.mock('../../lib/metrics', () => ({
  whatsappOutboundMetrics,
  whatsappOutboundDeliverySuccessCounter,
  whatsappSocketReconnectsCounter,
}));

const assertCircuitClosed = vi.fn();
const buildCircuitBreakerKey = vi.fn(() => 'circuit-key');
const getCircuitBreakerConfig = vi.fn(() => ({ windowMs: 1000, cooldownMs: 1000 }));
const recordCircuitFailure = vi.fn(() => ({ opened: false, failureCount: 1 }));
const recordCircuitSuccess = vi.fn(() => false);

vi.mock('../../utils/circuit-breaker', () => ({
  assertCircuitClosed,
  buildCircuitBreakerKey,
  getCircuitBreakerConfig,
  recordCircuitFailure,
  recordCircuitSuccess,
}));

vi.mock('../../config/feature-flags', () => ({
  isWhatsappPassthroughModeEnabled: () => false,
}));

describe('ticket-service logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs circuit closed with dispatch resolution details', async () => {
    const ticket = {
      id: 'ticket-1',
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      channel: 'WHATSAPP',
      metadata: { whatsappInstanceId: 'inst-1' },
      userId: 'user-1',
      updatedAt: new Date(),
      lastMessageAt: new Date(),
      lastMessagePreview: 'preview',
    };
    const messageRecord = {
      id: 'message-1',
      ticketId: ticket.id,
      type: 'text',
      direction: 'OUTBOUND',
      content: 'hello',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'PENDING',
      instanceId: 'inst-1',
    };
    const updatedMessage = { ...messageRecord, status: 'SENT' };

    storageFindTicketById.mockResolvedValue(ticket);
    storageCreateMessage.mockResolvedValue(messageRecord);
    storageUpdateMessage.mockResolvedValue(updatedMessage);
    prisma.contact.findUnique.mockResolvedValue({ id: 'contact-1', phone: '5511999999999' });
    prisma.whatsAppInstance.findUnique.mockResolvedValue({ id: 'inst-1', brokerId: 'broker-42' });

    const transport = {
      sendMessage: vi.fn().mockResolvedValue({
        externalId: 'external-1',
        status: 'SENT',
        timestamp: new Date().toISOString(),
      }),
    };

    recordCircuitSuccess.mockReturnValueOnce(true);

    const { sendMessage } = await import('../ticket-service');

    await sendMessage(
      'tenant-1',
      'user-1',
      {
        ticketId: ticket.id,
        type: 'text',
        instanceId: 'inst-1',
        direction: 'OUTBOUND',
        content: 'hello',
        metadata: {},
      },
      { transport }
    );

    expect(logger.info).toHaveBeenCalledWith('whatsapp.outbound.circuit.closed', {
      tenantId: 'tenant-1',
      ticketId: 'ticket-1',
      instanceId: 'inst-1',
      requestedInstanceId: 'inst-1',
      resolvedDispatchId: 'broker-42',
      brokerId: 'broker-42',
    });
  });

  it('logs dispatch failure with dispatch resolution details', async () => {
    const ticket = {
      id: 'ticket-2',
      tenantId: 'tenant-2',
      contactId: 'contact-2',
      channel: 'WHATSAPP',
      metadata: { whatsappInstanceId: 'inst-2' },
      userId: 'user-2',
      updatedAt: new Date(),
      lastMessageAt: new Date(),
      lastMessagePreview: 'preview',
    };
    const messageRecord = {
      id: 'message-2',
      ticketId: ticket.id,
      type: 'text',
      direction: 'OUTBOUND',
      content: 'hello again',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'PENDING',
      instanceId: 'inst-2',
    };
    const failedMessage = { ...messageRecord, status: 'FAILED' };

    storageFindTicketById.mockResolvedValue(ticket);
    storageCreateMessage.mockResolvedValue(messageRecord);
    storageUpdateMessage.mockResolvedValue(failedMessage);
    prisma.contact.findUnique.mockResolvedValue({ id: 'contact-2', phone: '5511999999988' });
    prisma.whatsAppInstance.findUnique.mockResolvedValue({ id: 'inst-2', brokerId: 'broker-77' });

    const transport = {
      sendMessage: vi.fn().mockRejectedValue(new Error('network failure')),
    };

    const { sendMessage } = await import('../ticket-service');

    await sendMessage(
      'tenant-2',
      'user-2',
      {
        ticketId: ticket.id,
        type: 'text',
        instanceId: 'inst-2',
        direction: 'OUTBOUND',
        content: 'hello again',
        metadata: {},
      },
      { transport }
    );

    expect(logger.error).toHaveBeenCalledWith('whatsapp.outbound.dispatch.failed', {
      tenantId: 'tenant-2',
      ticketId: 'ticket-2',
      messageId: 'message-2',
      error: 'network failure',
      errorCode: undefined,
      status: undefined,
      requestId: undefined,
      rawErrorCode: undefined,
      requestedInstanceId: 'inst-2',
      resolvedDispatchId: 'broker-77',
      brokerId: 'broker-77',
    });
  });
});
