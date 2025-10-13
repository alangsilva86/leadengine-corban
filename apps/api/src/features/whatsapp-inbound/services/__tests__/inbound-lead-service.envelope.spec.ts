import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const findOrCreateOpenTicketByChatMock = vi.fn();
const upsertMessageByExternalIdMock = vi.fn();
const normalizeInboundMessageMock = vi.fn();
const inboundMessagesCounterIncMock = vi.fn();
const socketEmitMock = vi.fn();
const socketToMock = vi.fn(() => ({ emit: socketEmitMock }));

vi.mock('../../../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../../lib/prisma', () => ({
  prisma: {},
}));

vi.mock('../../../../data/lead-allocation-store', () => ({
  addAllocations: vi.fn(),
}));

vi.mock('../../../../lib/socket-registry', () => ({
  emitToTenant: vi.fn(),
  emitToTicket: vi.fn(),
  emitToAgreement: vi.fn(),
  getSocketServer: vi.fn(() => ({
    to: socketToMock,
  })),
}));

vi.mock('../../../../services/ticket-service', () => ({
  createTicket: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock('../../../../lib/metrics', () => ({
  inboundMessagesProcessedCounter: { inc: inboundMessagesCounterIncMock },
  leadLastContactGauge: { set: vi.fn() },
}));

vi.mock('@ticketz/storage', () => ({
  findOrCreateOpenTicketByChat: findOrCreateOpenTicketByChatMock,
  upsertMessageByExternalId: upsertMessageByExternalIdMock,
}));

vi.mock('../utils/normalize', () => ({
  normalizeInboundMessage: normalizeInboundMessageMock,
}));

let ingestInboundWhatsAppMessage:
  typeof import('../inbound-lead-service')['ingestInboundWhatsAppMessage'];
let resetInboundLeadServiceTestState:
  typeof import('../inbound-lead-service')['resetInboundLeadServiceTestState'];

beforeAll(async () => {
  const module = await import('../inbound-lead-service');
  ingestInboundWhatsAppMessage = module.ingestInboundWhatsAppMessage;
  resetInboundLeadServiceTestState = module.resetInboundLeadServiceTestState;
});

describe('ingestInboundWhatsAppMessage (simplified envelope)', () => {
  const baseEnvelope = {
    origin: 'broker',
    instanceId: 'instance-1',
    chatId: '5511999999999@s.whatsapp.net',
    tenantId: 'tenant-1',
    message: {
      kind: 'message' as const,
      id: 'wamid.123',
      externalId: 'wamid.123',
      timestamp: '2024-05-10T12:00:00.000Z',
      direction: 'INBOUND' as const,
      contact: {
        phone: '+55 11 99999-9999',
        pushName: 'João',
      },
      payload: {
        key: {
          id: 'wamid.123',
          remoteJid: '5511999999999@s.whatsapp.net',
        },
        messageTimestamp: 1715342400,
      },
      metadata: {
        existing: 'value',
      },
    },
    raw: {
      brokerEventId: 'event-123',
    },
  } satisfies Parameters<typeof ingestInboundWhatsAppMessage>[0];

  const buildEnvelope = (): typeof baseEnvelope => ({
    ...baseEnvelope,
    message: {
      ...baseEnvelope.message,
      contact: { ...baseEnvelope.message.contact },
      payload: { ...baseEnvelope.message.payload },
      metadata: baseEnvelope.message.metadata
        ? { ...(baseEnvelope.message.metadata as Record<string, unknown>) }
        : undefined,
    },
    raw: baseEnvelope.raw ? { ...(baseEnvelope.raw as Record<string, unknown>) } : undefined,
  });

  beforeEach(() => {
    resetInboundLeadServiceTestState();
    findOrCreateOpenTicketByChatMock.mockReset();
    upsertMessageByExternalIdMock.mockReset();
    normalizeInboundMessageMock.mockReset();
    inboundMessagesCounterIncMock.mockReset();
    socketEmitMock.mockClear();
    socketToMock.mockClear();

    findOrCreateOpenTicketByChatMock.mockResolvedValue({
      ticket: {
        id: 'ticket-1',
        tenantId: 'tenant-1',
      },
      wasCreated: true,
    });

    upsertMessageByExternalIdMock.mockResolvedValue({
      message: {
        id: 'message-1',
        tenantId: 'tenant-1',
        ticketId: 'ticket-1',
        chatId: '5511999999999@s.whatsapp.net',
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

    normalizeInboundMessageMock.mockReturnValue({
      type: 'TEXT',
      text: 'Olá',
      caption: null,
      mediaUrl: null,
      mimetype: null,
      fileSize: null,
      brokerMessageTimestamp: 1715342400000,
    });
  });

  it('persists passthrough artifacts without transport metadata', async () => {
    const processed = await ingestInboundWhatsAppMessage(buildEnvelope());

    expect(processed).toBe(true);

    expect(findOrCreateOpenTicketByChatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        chatId: '5511999999999@s.whatsapp.net',
        instanceId: 'instance-1',
      })
    );

    expect(upsertMessageByExternalIdMock).toHaveBeenCalledTimes(1);
    const upsertPayload = upsertMessageByExternalIdMock.mock.calls[0]?.[0];
    expect(upsertPayload).toBeTruthy();
    expect(upsertPayload.metadata).not.toHaveProperty('transport');
    expect(upsertPayload.metadata).not.toHaveProperty('origin');
    expect(upsertPayload.metadata).toMatchObject({
      tenantId: 'tenant-1',
      chatId: '5511999999999@s.whatsapp.net',
      instanceId: 'instance-1',
      direction: 'inbound',
      sourceInstance: 'instance-1',
    });

    expect(inboundMessagesCounterIncMock).toHaveBeenCalledWith({
      origin: 'passthrough',
      tenantId: 'tenant-1',
      instanceId: 'instance-1',
    });

    expect(socketToMock).toHaveBeenCalledWith('tenant:tenant-1');
    expect(socketToMock).toHaveBeenCalledWith('ticket:ticket-1');
    expect(socketEmitMock).toHaveBeenCalled();
  });

  it('skips duplicates across tenant/instance/chat identifiers', async () => {
    const processedFirst = await ingestInboundWhatsAppMessage(buildEnvelope());
    const processedSecond = await ingestInboundWhatsAppMessage(buildEnvelope());

    expect(processedFirst).toBe(true);
    expect(processedSecond).toBe(false);

    expect(findOrCreateOpenTicketByChatMock).toHaveBeenCalledTimes(1);
    expect(upsertMessageByExternalIdMock).toHaveBeenCalledTimes(1);
    expect(inboundMessagesCounterIncMock).toHaveBeenCalledTimes(1);
  });
});
