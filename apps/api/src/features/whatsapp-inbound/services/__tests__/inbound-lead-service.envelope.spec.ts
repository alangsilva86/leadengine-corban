
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const findOrCreateOpenTicketByChatMock = vi.fn();
const upsertMessageByExternalIdMock = vi.fn();
const normalizeInboundMessageMock = vi.fn();
const inboundMessagesCounterIncMock = vi.fn();
const socketEmitMock = vi.fn();
const socketToMock = vi.fn(() => ({ emit: socketEmitMock }));

const isWhatsappPassthroughModeEnabledMock = vi.fn();
const isWhatsappInboundSimpleModeEnabledMock = vi.fn();

const prismaMock = {
  whatsAppInstance: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  tenant: { findFirst: vi.fn() },
  campaign: { findMany: vi.fn(), upsert: vi.fn() },
  queue: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn() },
  contact: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  ticket: { findFirst: vi.fn(), findUnique: vi.fn() },
  lead: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  leadActivity: { findFirst: vi.fn(), create: vi.fn() },
};

const addAllocationsMock = vi.fn();
const emitToTenantMock = vi.fn();
const emitToTicketMock = vi.fn();
const emitToAgreementMock = vi.fn();
const createTicketMock = vi.fn();
const sendMessageMock = vi.fn();

vi.mock('../../../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../../config/feature-flags', () => ({
  isWhatsappPassthroughModeEnabled: isWhatsappPassthroughModeEnabledMock,
  isWhatsappInboundSimpleModeEnabled: isWhatsappInboundSimpleModeEnabledMock,
}));

vi.mock('../../../../lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../../../../data/lead-allocation-store', () => ({
  addAllocations: addAllocationsMock,
}));

vi.mock('../../../../lib/socket-registry', () => ({
  emitToTenant: emitToTenantMock,
  emitToTicket: emitToTicketMock,
  emitToAgreement: emitToAgreementMock,
  getSocketServer: vi.fn(() => ({
    to: socketToMock,
  })),
}));

vi.mock('../../../../services/ticket-service', () => ({
  createTicket: createTicketMock,
  sendMessage: sendMessageMock,
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

type MockedLogger = {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
};

let ingestInboundWhatsAppMessage:
  typeof import('../inbound-lead-service')['ingestInboundWhatsAppMessage'];
let resetInboundLeadServiceTestState:
  typeof import('../inbound-lead-service')['resetInboundLeadServiceTestState'];
let testingInternals: typeof import('../inbound-lead-service')['__testing'];
let loggerMock: MockedLogger;

beforeAll(async () => {
  const module = await import('../inbound-lead-service');
  ingestInboundWhatsAppMessage = module.ingestInboundWhatsAppMessage;
  resetInboundLeadServiceTestState = module.resetInboundLeadServiceTestState;
  testingInternals = module.__testing;

  const loggerModule = await import('../../../../config/logger');
  loggerMock = loggerModule.logger as MockedLogger;
});

const resetPrismaMocks = () => {
  for (const model of Object.values(prismaMock)) {
    for (const fn of Object.values(model)) {
      fn.mockReset();
    }
  }
};

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
    socketEmitMock.mockReset();
    socketToMock.mockReset();
    socketToMock.mockImplementation(() => ({ emit: socketEmitMock }));
    isWhatsappPassthroughModeEnabledMock.mockReset();
    isWhatsappInboundSimpleModeEnabledMock.mockReset();
    resetPrismaMocks();
    addAllocationsMock.mockReset();
    emitToTenantMock.mockReset();
    emitToTicketMock.mockReset();
    emitToAgreementMock.mockReset();
    createTicketMock.mockReset();
    sendMessageMock.mockReset();
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    loggerMock.debug.mockReset();

    isWhatsappPassthroughModeEnabledMock.mockReturnValue(true);
    isWhatsappInboundSimpleModeEnabledMock.mockReturnValue(false);

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
      id: 'wamid.123',
      clientMessageId: 'client-123',
      conversationId: 'conversation-123',
      latitude: null,
      longitude: null,
      locationName: null,
      contacts: null,
      raw: {},
      receivedAt: '2024-05-10T12:00:00.000Z',
    });
  });

  describe('when passthrough mode is enabled', () => {
    beforeEach(() => {
      isWhatsappPassthroughModeEnabledMock.mockReturnValue(true);
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

  describe('when passthrough mode is disabled', () => {
    beforeEach(() => {
      isWhatsappPassthroughModeEnabledMock.mockReturnValue(false);

      prismaMock.whatsAppInstance.findFirst.mockResolvedValue(null);
      prismaMock.whatsAppInstance.findUnique.mockResolvedValue({
        id: 'instance-1',
        tenantId: 'tenant-1',
      });
      prismaMock.campaign.findMany.mockResolvedValue([]);
      prismaMock.campaign.upsert.mockRejectedValue(new Error('no fallback'));
      prismaMock.queue.findUnique.mockResolvedValue(null);
      prismaMock.queue.findFirst.mockResolvedValue({ id: 'queue-1' });
      prismaMock.contact.findUnique.mockResolvedValue(null);
      prismaMock.contact.findFirst.mockResolvedValue(null);
      prismaMock.contact.create.mockResolvedValue({
        id: 'contact-1',
        name: 'Contato WhatsApp',
        phone: '+5511999999999',
        tags: ['whatsapp', 'inbound'],
        customFields: {},
      });
      prismaMock.ticket.findFirst.mockResolvedValue(null);
      prismaMock.ticket.findUnique.mockResolvedValue({
        id: 'ticket-1',
        status: 'OPEN',
        updatedAt: new Date('2024-05-10T12:00:05.000Z'),
      });
      prismaMock.lead.findFirst.mockResolvedValue(null);
      prismaMock.lead.create.mockResolvedValue({
        id: 'lead-1',
        tenantId: 'tenant-1',
      });
      prismaMock.leadActivity.findFirst.mockResolvedValue(null);
      prismaMock.leadActivity.create.mockResolvedValue({
        id: 'activity-1',
        tenantId: 'tenant-1',
      });

      createTicketMock.mockResolvedValue({ id: 'ticket-1' });
      sendMessageMock.mockResolvedValue({
        id: 'timeline-1',
        tenantId: 'tenant-1',
        content: 'Olá',
        direction: 'INBOUND',
        metadata: { eventMetadata: {} },
        createdAt: new Date('2024-05-10T12:00:01.000Z'),
      });

      addAllocationsMock.mockResolvedValue({
        newlyAllocated: [
          {
            allocationId: 'alloc-1',
            leadId: 'lead-1',
            campaignId: null,
            agreementId: null,
            instanceId: 'instance-1',
          },
        ],
        summary: { total: 1, contacted: 0, won: 0, lost: 0 },
      });
    });

    it('allocates leads indexed by instance when no campaigns exist', async () => {
      const processed = await ingestInboundWhatsAppMessage(buildEnvelope());

      expect(processed).toBe(true);
      expect(addAllocationsMock).toHaveBeenCalledWith(
        'tenant-1',
        { instanceId: 'instance-1' },
        expect.any(Array)
      );

      expect(emitToTenantMock).toHaveBeenCalledWith(
        'tenant-1',
        'leadAllocations.new',
        expect.objectContaining({
          instanceId: 'instance-1',
          campaignId: null,
        })
      );

      expect(inboundMessagesCounterIncMock).toHaveBeenCalledWith({
        origin: 'legacy',
        tenantId: 'tenant-1',
        instanceId: 'instance-1',
      });
    });

    it('permits retry when queue provisioning fails before persisting the message', async () => {
      prismaMock.queue.findFirst.mockResolvedValueOnce(null);
      prismaMock.queue.upsert.mockRejectedValueOnce(new Error('queue unavailable'));

      const firstAttempt = await ingestInboundWhatsAppMessage(buildEnvelope());
      expect(firstAttempt).toBe(true);
      expect(sendMessageMock).not.toHaveBeenCalled();

      const secondAttempt = await ingestInboundWhatsAppMessage(buildEnvelope());
      expect(secondAttempt).toBe(true);
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
      expect(prismaMock.queue.upsert).toHaveBeenCalledTimes(1);
    });

    it('reuses instance resolved via broker identifier matching the envelope instance id', async () => {
      const envelope = buildEnvelope();
      envelope.message.metadata = {
        ...(envelope.message.metadata as Record<string, unknown>),
        brokerId: envelope.instanceId,
      };

      const instanceRecord = { id: 'instance-1', tenantId: 'tenant-1' };
      prismaMock.whatsAppInstance.findFirst.mockResolvedValueOnce(instanceRecord);

      const processed = await ingestInboundWhatsAppMessage(envelope);

      expect(processed).toBe(true);
      expect(prismaMock.whatsAppInstance.findFirst).toHaveBeenCalledWith({
        where: { brokerId: 'instance-1', tenantId: 'tenant-1' },
      });
      expect(prismaMock.whatsAppInstance.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.whatsAppInstance.create).not.toHaveBeenCalled();
    });

    it('processes messages when only the broker UUID is available as instance identifier', async () => {
      const envelope = buildEnvelope();
      envelope.instanceId = 'broker-uuid-9';
      envelope.message.metadata = {
        ...(envelope.message.metadata as Record<string, unknown>),
        instanceId: envelope.instanceId,
      };

      const instanceRecord = { id: 'instance-legacy', tenantId: 'tenant-1' };
      prismaMock.whatsAppInstance.findFirst.mockResolvedValueOnce(instanceRecord);

      const processed = await ingestInboundWhatsAppMessage(envelope);

      expect(processed).toBe(true);
      expect(prismaMock.whatsAppInstance.findFirst).toHaveBeenCalledWith({
        where: { brokerId: 'broker-uuid-9', tenantId: 'tenant-1' },
      });
      expect(prismaMock.whatsAppInstance.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.whatsAppInstance.create).not.toHaveBeenCalled();
    });

    it('auto provisions missing instances before processing standard inbound flow', async () => {
      prismaMock.whatsAppInstance.findUnique.mockResolvedValueOnce(null);
      prismaMock.tenant.findFirst.mockResolvedValueOnce({ id: 'tenant-1', name: 'Tenant One' });
      const createdInstance = {
        id: 'instance-1',
        tenantId: 'tenant-1',
        brokerId: 'wa-friendly',
        metadata: {},
      };
      prismaMock.whatsAppInstance.create.mockResolvedValueOnce(createdInstance);

      const envelope = buildEnvelope();
      envelope.message.metadata = {
        ...(envelope.message.metadata as Record<string, unknown>),
        brokerId: 'wa-friendly',
        instanceName: 'WhatsApp Principal',
      };

      const processed = await ingestInboundWhatsAppMessage(envelope);

      expect(processed).toBe(true);
      expect(prismaMock.whatsAppInstance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'instance-1',
            tenantId: 'tenant-1',
            metadata: expect.objectContaining({
              autopProvisionSource: 'inbound-auto',
              autopProvisionBrokerId: 'wa-friendly',
              autopProvisionTenantIdentifiers: expect.arrayContaining(['tenant-1']),
            }),
            brokerId: 'wa-friendly',
          }),
        })
      );
      expect(prismaMock.whatsAppInstance.update).not.toHaveBeenCalled();
      expect(createTicketMock).toHaveBeenCalledTimes(1);
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
      expect(emitToTicketMock).toHaveBeenCalledWith(
        'ticket-1',
        expect.stringMatching(/tickets\./),
        expect.objectContaining({
          tenantId: 'tenant-1',
          ticketId: 'ticket-1',
        })
      );
      expect(emitToTenantMock).toHaveBeenCalledWith(
        'tenant-1',
        expect.stringMatching(/tickets\./),
        expect.objectContaining({
          tenantId: 'tenant-1',
          ticketId: 'ticket-1',
        })
      );
    });

    it('auto provisions queues for first inbound message when payload supplies tenant identification', async () => {
      const envelope = buildEnvelope();
      envelope.tenantId = null;
      envelope.message.payload = {
        ...envelope.message.payload,
        tenantId: 'tenant-1',
        tenant: { id: 'tenant-1' },
      };

      prismaMock.whatsAppInstance.findUnique.mockResolvedValueOnce(null);
      prismaMock.tenant.findFirst.mockResolvedValueOnce({ id: 'tenant-1', name: 'Tenant One' });
      const createdInstance = {
        id: 'instance-1',
        tenantId: 'tenant-1',
        brokerId: 'instance-1',
        metadata: {},
      };
      prismaMock.whatsAppInstance.create.mockResolvedValueOnce(createdInstance);

      prismaMock.queue.findFirst.mockResolvedValueOnce(null);
      prismaMock.queue.upsert.mockResolvedValueOnce({ id: 'queue-auto-1' });

      const processed = await ingestInboundWhatsAppMessage(envelope);

      expect(processed).toBe(true);

      expect(prismaMock.tenant.findFirst).toHaveBeenCalledWith({
        where: {
          OR: expect.arrayContaining([
            expect.objectContaining({ id: 'tenant-1' }),
            expect.objectContaining({ slug: 'tenant-1' }),
          ]),
        },
      });

      expect(prismaMock.queue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId_name: {
              tenantId: 'tenant-1',
              name: 'Atendimento Geral',
            },
          },
        })
      );

      expect(createTicketMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          queueId: 'queue-auto-1',
        })
      );

      expect(sendMessageMock).toHaveBeenCalledTimes(1);
      expect(emitToTicketMock).toHaveBeenCalledWith(
        'ticket-1',
        'tickets.updated',
        expect.objectContaining({ tenantId: 'tenant-1', ticketId: 'ticket-1' })
      );
      expect(emitToTenantMock).toHaveBeenCalledWith(
        'tenant-1',
        'tickets.updated',
        expect.objectContaining({ tenantId: 'tenant-1', ticketId: 'ticket-1' })
      );

      expect(testingInternals.queueCacheByTenant.get('tenant-1')).toEqual(
        expect.objectContaining({ id: 'queue-auto-1' })
      );
    });

    it('logs auto provisioning success for fresh instances when simple mode is disabled', async () => {
      const envelope = buildEnvelope();

      prismaMock.whatsAppInstance.findUnique.mockResolvedValueOnce(null);
      prismaMock.tenant.findFirst.mockResolvedValueOnce(null);
      prismaMock.tenant.findFirst.mockResolvedValue({ id: 'tenant-1', name: 'Tenant One' });

      const createdInstance = {
        id: 'instance-1',
        tenantId: 'tenant-1',
        brokerId: 'instance-1',
        metadata: {},
      };
      prismaMock.whatsAppInstance.create.mockResolvedValueOnce(createdInstance);

      const processed = await ingestInboundWhatsAppMessage(envelope);

      expect(processed).toBe(true);

      expect(loggerMock.info).toHaveBeenCalledWith(
        '🎯 LeadEngine • WhatsApp :: 🆕 Instância autoprov criada durante ingestão padrão',
        expect.objectContaining({
          instanceId: 'instance-1',
          tenantId: 'tenant-1',
          tenantIdentifiers: expect.arrayContaining(['tenant-1']),
          brokerId: 'instance-1',
        })
      );
      expect(loggerMock.warn).not.toHaveBeenCalledWith(
        '🎯 LeadEngine • WhatsApp :: ⚠️ Autoprovisionamento não realizado durante ingestão padrão',
        expect.any(Object)
      );
      expect(createTicketMock).toHaveBeenCalledTimes(1);
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
    });
  });
});
