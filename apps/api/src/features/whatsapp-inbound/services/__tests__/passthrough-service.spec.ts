import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const findOrCreateOpenTicketByChatMock = vi.fn();
const upsertMessageByExternalIdMock = vi.fn();
const normalizeInboundMessageMock = vi.fn();
const inboundMessagesCounterIncMock = vi.fn();
const emitToTenantMock = vi.fn();
const emitToTicketMock = vi.fn();
const emitToAgreementMock = vi.fn();
const socketEmitMock = vi.fn();
const socketToMock = vi.fn(() => ({ emit: socketEmitMock }));
const getSocketServerMock = vi.fn(() => ({ to: socketToMock }));
const prismaTicketFindUniqueMock = vi.fn();

const loggerMock = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock('../../../../config/logger', () => ({
  logger: loggerMock,
}));

vi.mock('../../../../lib/metrics', () => ({
  inboundMessagesProcessedCounter: { inc: inboundMessagesCounterIncMock },
}));

vi.mock('../../../../lib/socket-registry', () => ({
  emitToTenant: emitToTenantMock,
  emitToTicket: emitToTicketMock,
  emitToAgreement: emitToAgreementMock,
  getSocketServer: getSocketServerMock,
}));

vi.mock('@ticketz/storage', () => ({
  findOrCreateOpenTicketByChat: findOrCreateOpenTicketByChatMock,
  upsertMessageByExternalId: upsertMessageByExternalIdMock,
}));

vi.mock('../utils/normalize', () => ({
  normalizeInboundMessage: normalizeInboundMessageMock,
}));

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    ticket: { findUnique: prismaTicketFindUniqueMock },
  },
}));

let handlePassthroughIngest:
  typeof import('../passthrough-service')['handlePassthroughIngest'];

beforeAll(async () => {
  ({ handlePassthroughIngest } = await import('../passthrough-service'));
});

const baseEvent = {
  id: 'event-1',
  instanceId: 'instance-1',
  direction: 'INBOUND' as const,
  chatId: null,
  externalId: null,
  timestamp: '2024-05-10T12:00:00.000Z',
  contact: {
    name: 'Contato WhatsApp',
    phone: null,
    document: null,
    pushName: 'Cliente',
  },
  message: {
    id: 'wamid.123',
    type: 'TEXT',
    text: 'Olá',
  },
  metadata: {
    contact: { id: 'contact-123' },
    sessionId: 'session-abc',
  },
  tenantId: 'tenant-1',
  sessionId: null,
};

describe('handlePassthroughIngest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketToMock.mockImplementation(() => ({ emit: socketEmitMock }));
    getSocketServerMock.mockImplementation(() => ({ to: socketToMock }));

    normalizeInboundMessageMock.mockImplementation((payload: unknown) => ({
      type: (payload as { type?: string }).type ?? 'TEXT',
      text: (payload as { text?: string | null }).text ?? null,
      caption: null,
      mediaUrl: null,
      mimetype: null,
      fileSize: null,
      brokerMessageTimestamp: undefined,
      id: (payload as { id?: string | null }).id ?? null,
    }));

    findOrCreateOpenTicketByChatMock.mockResolvedValue({
      ticket: { id: 'ticket-1', tenantId: 'tenant-1' },
      wasCreated: true,
    });

    upsertMessageByExternalIdMock.mockResolvedValue({
      message: {
        id: 'message-stored',
        tenantId: 'tenant-1',
        ticketId: 'ticket-1',
        chatId: 'chat-resolved',
        direction: 'inbound',
        type: 'text',
        text: 'Olá',
        media: null,
        metadata: {},
        createdAt: new Date('2024-05-10T12:00:01.000Z'),
        externalId: 'wamid.123',
      },
      wasCreated: true,
    });

    prismaTicketFindUniqueMock.mockResolvedValue({
      id: 'ticket-1',
      tenantId: 'tenant-1',
      agreementId: 'agreement-1',
      status: 'OPEN',
      updatedAt: new Date('2024-05-10T12:00:05.000Z'),
      metadata: {},
    });
  });

  it('reuses deterministic identifiers when phone and document are missing', async () => {
    await handlePassthroughIngest({ ...baseEvent });
    await handlePassthroughIngest({
      ...baseEvent,
      id: 'event-2',
      message: { ...baseEvent.message, id: 'wamid.456', text: 'Olá novamente' },
    });

    expect(findOrCreateOpenTicketByChatMock).toHaveBeenCalledTimes(2);
    const firstCall = findOrCreateOpenTicketByChatMock.mock.calls[0]?.[0];
    const secondCall = findOrCreateOpenTicketByChatMock.mock.calls[1]?.[0];

    expect(firstCall).toBeTruthy();
    expect(secondCall).toBeTruthy();
    expect(secondCall.chatId).toBe(firstCall.chatId);
    expect(secondCall.phone).toBe(firstCall.phone);
    expect(firstCall.chatId).toBe('instance-1:contact-123');
    expect(firstCall.phone).toBe('instance-1:contact-123');

    expect(upsertMessageByExternalIdMock).toHaveBeenCalledTimes(2);
    expect(upsertMessageByExternalIdMock.mock.calls[0]?.[0].chatId).toBe(firstCall.chatId);
    expect(upsertMessageByExternalIdMock.mock.calls[1]?.[0].externalId).toBe('wamid.456');
  });

  it('persists normalized payload and emits socket updates', async () => {
    normalizeInboundMessageMock.mockReturnValue({
      type: 'TEXT',
      text: 'Olá',
      caption: null,
      mediaUrl: null,
      mimetype: null,
      fileSize: null,
      brokerMessageTimestamp: 1715342400000,
      id: 'wamid.123',
    });

    await handlePassthroughIngest({
      ...baseEvent,
      metadata: {
        ...baseEvent.metadata,
        remoteJid: '5511999999999@s.whatsapp.net',
      },
    });

    expect(upsertMessageByExternalIdMock).toHaveBeenCalledTimes(1);
    const upsertPayload = upsertMessageByExternalIdMock.mock.calls[0]?.[0];
    expect(upsertPayload).toMatchObject({
      tenantId: 'tenant-1',
      direction: 'inbound',
      type: 'text',
      text: 'Olá',
      metadata: expect.objectContaining({
        tenantId: 'tenant-1',
        chatId: expect.any(String),
        direction: 'inbound',
        sourceInstance: 'instance-1',
        remoteJid: '5511999999999@s.whatsapp.net',
      }),
    });
    expect(upsertPayload.metadata).not.toHaveProperty('transport');

    expect(socketToMock).toHaveBeenCalledWith('tenant:tenant-1');
    expect(socketToMock).toHaveBeenCalledWith('ticket:ticket-1');
    expect(socketEmitMock).toHaveBeenCalledTimes(2);
    expect(inboundMessagesCounterIncMock).toHaveBeenCalledWith({
      origin: 'passthrough',
      tenantId: 'tenant-1',
      instanceId: 'instance-1',
    });
  });

  it('derives media payload metadata for rich messages', async () => {
    normalizeInboundMessageMock.mockReturnValue({
      type: 'IMAGE',
      text: null,
      caption: 'Foto da proposta',
      mediaUrl: 'https://cdn.local/photo.jpg',
      mimetype: 'image/jpeg',
      fileSize: 12345,
      brokerMessageTimestamp: undefined,
      id: 'wamid.media',
    });

    await handlePassthroughIngest({
      ...baseEvent,
      message: {
        id: 'wamid.media',
        type: 'IMAGE',
        text: null,
      },
    });

    expect(upsertMessageByExternalIdMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'media',
        text: 'Foto da proposta',
        media: expect.objectContaining({
          mediaType: 'image',
          url: 'https://cdn.local/photo.jpg',
          mimeType: 'image/jpeg',
          caption: 'Foto da proposta',
        }),
      })
    );
  });
});
