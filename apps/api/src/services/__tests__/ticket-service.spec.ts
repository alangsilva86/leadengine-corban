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

const emitToAgreement = vi.fn();
const emitToTenant = vi.fn();
const emitToTicket = vi.fn();
const emitToUser = vi.fn();

vi.mock('../../lib/socket-registry', () => ({
  emitToAgreement,
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
    const failedMessage = {
      ...messageRecord,
      status: 'FAILED',
      metadata: {
        ...messageRecord.metadata,
        broker: {
          error: { message: 'network failure' },
        },
      },
    };

    storageFindTicketById.mockResolvedValue(ticket);
    storageCreateMessage.mockResolvedValue(messageRecord);
    storageUpdateMessage.mockResolvedValue(failedMessage);
    prisma.contact.findUnique.mockResolvedValue({ id: 'contact-2', phone: '5511999999988' });
    prisma.whatsAppInstance.findUnique.mockResolvedValue({ id: 'inst-2', brokerId: 'broker-77' });

    const transport = {
      sendMessage: vi.fn().mockRejectedValue(new Error('network failure')),
    };

    const ticketService = await import('../ticket-service');
    const emitMessageUpdatedEventsMock = vi.fn().mockResolvedValue(undefined);

    await expect(
      ticketService.sendMessage(
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
        { transport, emitMessageUpdatedEvents: emitMessageUpdatedEventsMock }
      )
    ).rejects.toThrow('network failure');

    expect(storageUpdateMessage).toHaveBeenCalledWith(
      'tenant-2',
      'message-2',
      expect.objectContaining({
        status: 'FAILED',
        metadata: expect.objectContaining({
          broker: expect.objectContaining({
            error: expect.objectContaining({ message: 'network failure' }),
          }),
        }),
      })
    );

    expect(emitMessageUpdatedEventsMock).toHaveBeenCalledWith(
      'tenant-2',
      ticket.id,
      failedMessage,
      'user-2'
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

describe('ticket-service phone normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches outbound WhatsApp messages using a trimmed primary phone', async () => {
    const ticket = {
      id: 'ticket-primary-1',
      tenantId: 'tenant-primary-1',
      contactId: 'contact-primary-1',
      channel: 'WHATSAPP',
      metadata: { whatsappInstanceId: 'inst-primary-1' },
      userId: 'user-primary-1',
      updatedAt: new Date(),
      lastMessageAt: new Date(),
      lastMessagePreview: 'preview',
    };
    const messageRecord = {
      id: 'message-primary-1',
      ticketId: ticket.id,
      type: 'text',
      direction: 'OUTBOUND',
      content: 'hello primary phone',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'PENDING',
      instanceId: 'inst-primary-1',
    };
    const brokerTimestamp = new Date().toISOString();
    const updatedMessage = {
      ...messageRecord,
      status: 'SENT',
      metadata: {
        broker: {
          provider: 'whatsapp',
          instanceId: 'inst-primary-1',
          externalId: 'external-primary-1',
          status: 'SENT',
          dispatchedAt: brokerTimestamp,
        },
      },
    };

    storageFindTicketById.mockResolvedValue(ticket);
    storageCreateMessage.mockResolvedValue(messageRecord);
    storageUpdateMessage.mockResolvedValue(updatedMessage);
    prisma.contact.findUnique.mockResolvedValue({
      id: 'contact-primary-1',
      primaryPhone: ' 5511987654321 ',
      phone: null,
    });
    prisma.whatsAppInstance.findUnique.mockResolvedValue({
      id: 'inst-primary-1',
      brokerId: 'broker-primary-1',
    });

    const transport = {
      sendMessage: vi.fn().mockResolvedValue({
        externalId: 'external-primary-1',
        status: 'SENT',
        timestamp: brokerTimestamp,
      }),
    };

    const { sendMessage } = await import('../ticket-service');

    await sendMessage(
      'tenant-primary-1',
      'user-primary-1',
      {
        ticketId: ticket.id,
        type: 'text',
        instanceId: 'inst-primary-1',
        direction: 'OUTBOUND',
        content: 'hello primary phone',
        metadata: {},
      },
      { transport }
    );

    expect(transport.sendMessage).toHaveBeenCalledTimes(1);
    expect(transport.sendMessage).toHaveBeenCalledWith(
      'broker-primary-1',
      expect.objectContaining({
        to: '5511987654321',
        externalId: 'message-primary-1',
      }),
      { idempotencyKey: 'message-primary-1' }
    );

    expect(logger.warn).not.toHaveBeenCalledWith(
      'whatsapp.outbound.contactPhoneMissing',
      expect.anything()
    );

    expect(storageUpdateMessage).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ status: 'FAILED' })
    );
  });
});

describe('ticket-service dispatch guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches outbound WhatsApp messages without a userId', async () => {
    const ticket = {
      id: 'ticket-out-1',
      tenantId: 'tenant-out-1',
      contactId: 'contact-out-1',
      channel: 'WHATSAPP',
      metadata: { whatsappInstanceId: 'inst-out-1' },
      updatedAt: new Date(),
      lastMessageAt: new Date(),
      lastMessagePreview: 'preview',
    };
    const messageRecord = {
      id: 'message-out-1',
      ticketId: ticket.id,
      type: 'text',
      direction: 'OUTBOUND',
      content: 'hello automation',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'SENT',
      instanceId: 'inst-out-1',
    };
    const brokerTimestamp = new Date().toISOString();
    const updatedMessage = {
      ...messageRecord,
      status: 'SENT',
      metadata: {
        broker: {
          provider: 'whatsapp',
          instanceId: 'inst-out-1',
          externalId: 'external-out-1',
          status: 'SENT',
          dispatchedAt: brokerTimestamp,
        },
      },
    };

    storageFindTicketById.mockResolvedValue(ticket);
    storageCreateMessage.mockResolvedValue(messageRecord);
    storageUpdateMessage.mockResolvedValue(updatedMessage);
    prisma.contact.findUnique.mockResolvedValue({ id: 'contact-out-1', phone: '5511988887777' });
    prisma.whatsAppInstance.findUnique.mockResolvedValue({ id: 'inst-out-1', brokerId: 'broker-out-1' });

    const transport = {
      sendMessage: vi.fn().mockResolvedValue({
        externalId: 'external-out-1',
        status: 'SENT',
        timestamp: brokerTimestamp,
      }),
    };

    const { sendMessage } = await import('../ticket-service');

    await sendMessage(
      'tenant-out-1',
      undefined,
      {
        ticketId: ticket.id,
        type: 'text',
        instanceId: 'inst-out-1',
        direction: 'OUTBOUND',
        content: 'hello automation',
        metadata: {},
      },
      { transport }
    );

    expect(transport.sendMessage).toHaveBeenCalledTimes(1);
    expect(transport.sendMessage).toHaveBeenCalledWith(
      'broker-out-1',
      expect.objectContaining({
        to: '5511988887777',
        externalId: 'message-out-1',
      }),
      { idempotencyKey: 'message-out-1' }
    );
    expect(logger.info).toHaveBeenCalledWith(
      'whatsapp.outbound.dispatch.attempt',
      expect.objectContaining({
        tenantId: 'tenant-out-1',
        ticketId: 'ticket-out-1',
        messageId: 'message-out-1',
        requestedInstanceId: 'inst-out-1',
        resolvedDispatchId: 'broker-out-1',
        brokerId: 'broker-out-1',
      })
    );
  });

  it('includes media payload details when dispatching attachments', async () => {
    const ticket = {
      id: 'ticket-media-1',
      tenantId: 'tenant-media-1',
      contactId: 'contact-media-1',
      channel: 'WHATSAPP',
      metadata: { whatsappInstanceId: 'inst-media-1' },
      updatedAt: new Date(),
      lastMessageAt: new Date(),
      lastMessagePreview: 'preview',
    };
    const messageRecord = {
      id: 'message-media-1',
      ticketId: ticket.id,
      type: 'DOCUMENT',
      direction: 'OUTBOUND',
      content: '[Anexo enviado]',
      caption: 'Contrato assinado',
      mediaUrl: 'https://cdn.example.com/contrato.pdf',
      mediaFileName: 'contrato.pdf',
      mediaMimeType: 'application/pdf',
      metadata: {
        attachments: [
          {
            mediaUrl: 'https://cdn.example.com/contrato.pdf',
            fileName: 'contrato.pdf',
            mimeType: 'application/pdf',
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'PENDING',
      instanceId: 'inst-media-1',
    };
    const brokerTimestamp = new Date().toISOString();
    const updatedMessage = {
      ...messageRecord,
      status: 'SENT',
      metadata: {
        ...messageRecord.metadata,
        broker: {
          provider: 'whatsapp',
          instanceId: 'inst-media-1',
          externalId: 'external-media-1',
          status: 'SENT',
          dispatchedAt: brokerTimestamp,
        },
      },
    };

    storageFindTicketById.mockResolvedValue(ticket);
    storageCreateMessage.mockResolvedValue(messageRecord);
    storageUpdateMessage.mockResolvedValue(updatedMessage);
    prisma.contact.findUnique.mockResolvedValue({ id: 'contact-media-1', phone: '5511999998888' });
    prisma.whatsAppInstance.findUnique.mockResolvedValue({ id: 'inst-media-1', brokerId: 'broker-media-1' });

    const transport = {
      sendMessage: vi.fn().mockResolvedValue({
        externalId: 'external-media-1',
        status: 'SENT',
        timestamp: brokerTimestamp,
      }),
    };

    const { sendMessage } = await import('../ticket-service');

    await sendMessage(
      'tenant-media-1',
      'agent-media-1',
      {
        ticketId: ticket.id,
        type: 'DOCUMENT',
        direction: 'OUTBOUND',
        content: '[Anexo enviado]',
        caption: 'Contrato assinado',
        mediaUrl: 'https://cdn.example.com/contrato.pdf',
        mediaFileName: 'contrato.pdf',
        mediaMimeType: 'application/pdf',
        metadata: messageRecord.metadata,
      },
      { transport }
    );

    expect(transport.sendMessage).toHaveBeenCalledTimes(1);
    expect(transport.sendMessage).toHaveBeenCalledWith(
      'broker-media-1',
      expect.objectContaining({
        to: '5511999998888',
        type: 'DOCUMENT',
        caption: 'Contrato assinado',
        mediaUrl: 'https://cdn.example.com/contrato.pdf',
        mediaFileName: 'contrato.pdf',
        mediaMimeType: 'application/pdf',
      }),
      { idempotencyKey: 'message-media-1' }
    );
    expect(storageCreateMessage).toHaveBeenCalledWith(
      'tenant-media-1',
      ticket.id,
      expect.objectContaining({
        mediaUrl: 'https://cdn.example.com/contrato.pdf',
        mediaFileName: 'contrato.pdf',
        mediaMimeType: 'application/pdf',
        caption: 'Contrato assinado',
        metadata: messageRecord.metadata,
      })
    );
  });

  it('skips dispatch for inbound WhatsApp messages', async () => {
    const ticket = {
      id: 'ticket-in-1',
      tenantId: 'tenant-in-1',
      contactId: 'contact-in-1',
      channel: 'WHATSAPP',
      metadata: { whatsappInstanceId: 'inst-in-1' },
      updatedAt: new Date(),
      lastMessageAt: new Date(),
      lastMessagePreview: 'preview',
    };
    const messageRecord = {
      id: 'message-in-1',
      ticketId: ticket.id,
      type: 'text',
      direction: 'INBOUND',
      content: 'hello from contact',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'SENT',
      instanceId: null,
    };

    storageFindTicketById.mockResolvedValue(ticket);
    storageCreateMessage.mockResolvedValue(messageRecord);

    const transport = {
      sendMessage: vi.fn(),
    };

    const { sendMessage } = await import('../ticket-service');

    await sendMessage(
      'tenant-in-1',
      'user-inbound-1',
      {
        ticketId: ticket.id,
        type: 'text',
        direction: 'INBOUND',
        content: 'hello from contact',
        metadata: {},
      },
      { transport }
    );

    expect(transport.sendMessage).not.toHaveBeenCalled();
    expect(prisma.contact.findUnique).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalledWith(
      'whatsapp.outbound.dispatch.attempt',
      expect.anything()
    );
  });
});
