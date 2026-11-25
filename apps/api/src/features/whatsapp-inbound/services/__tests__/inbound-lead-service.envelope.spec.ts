
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeUpsertEvent } from '../baileys-raw-normalizer';

const normalizeInboundMessageMock = vi.fn();
const inboundMessagesCounterIncMock = vi.fn();

const prismaMock = {
  whatsAppInstance: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  tenant: { findFirst: vi.fn() },
  campaign: { findMany: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), create: vi.fn(), update: vi.fn() },
  queue: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn() },
  contact: { findUnique: vi.fn(), findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), create: vi.fn() },
  contactPhone: { upsert: vi.fn(), updateMany: vi.fn() },
  contactTag: { deleteMany: vi.fn(), upsert: vi.fn() },
  tag: { findMany: vi.fn(), create: vi.fn() },
  ticket: { findFirst: vi.fn(), findUnique: vi.fn() },
  lead: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  leadActivity: { findFirst: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
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
  emitToCampaign: vi.fn(),
  getSocketServer: vi.fn(() => null),
}));

vi.mock('../../../../services/ticket-service', () => ({
  createTicket: createTicketMock,
  sendMessage: sendMessageMock,
}));

vi.mock('../../../../lib/metrics', () => ({
  inboundMessagesProcessedCounter: { inc: inboundMessagesCounterIncMock },
  leadLastContactGauge: { set: vi.fn() },
  whatsappInboundMetrics: { observeLatency: vi.fn() },
  whatsappWebhookEventsCounter: { inc: vi.fn() },
}));

vi.mock('@ticketz/storage', () => ({
  allocateBrokerLeads: vi.fn(),
  listAllocations: vi.fn(),
  updateAllocation: vi.fn(),
  enqueueInboundMediaJob: vi.fn(),
  $Enums: { MessageType: {} },
}));

vi.mock('../../utils/normalize', () => ({
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
let dedupeCache: typeof import('../dedupe')['dedupeCache'];
let queueCacheByTenant: typeof import('../provisioning')['queueCacheByTenant'];
let loggerMock: MockedLogger;

beforeAll(async () => {
  const module = await import('../inbound-lead-service');
  ingestInboundWhatsAppMessage = module.ingestInboundWhatsAppMessage;
  resetInboundLeadServiceTestState = module.resetInboundLeadServiceTestState;
  ({ dedupeCache } = await import('../dedupe'));
  ({ queueCacheByTenant } = await import('../provisioning'));

  const loggerModule = await import('../../../../config/logger');
  loggerMock = loggerModule.logger as MockedLogger;
});

const resetPrismaMocks = () => {
  for (const model of Object.values(prismaMock)) {
    if (typeof model === 'function') {
      model.mockReset();
      continue;
    }
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
    normalizeInboundMessageMock.mockReset();
    inboundMessagesCounterIncMock.mockReset();
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

  // O modo passthrough (findOrCreateOpenTicketByChat/upsertMessageByExternalId direto na ingestão)
  // foi removido em ef28e1dd/76b323a8; a ingestão sempre usa a pipeline padrão abaixo.
  describe('standard inbound pipeline', () => {
    afterEach(() => {
      delete process.env.WHATSAPP_INBOUND_AUTOPROVISION_ENABLED;
      delete process.env.WHATSAPP_INBOUND_AUTOPROVISION_ALLOWLIST;
    });

    // Desde eb613513 o autoprovisionamento exige flag + allowlist do tenant.
    const allowInboundAutoProvision = (tenantId = 'tenant-1') => {
      process.env.WHATSAPP_INBOUND_AUTOPROVISION_ENABLED = 'true';
      process.env.WHATSAPP_INBOUND_AUTOPROVISION_ALLOWLIST = tenantId;
    };

    beforeEach(() => {
      prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) =>
        callback(prismaMock)
      );
      prismaMock.tag.findMany.mockResolvedValue([]);
      prismaMock.tag.create.mockImplementation(async (args: { data: { name: string } }) => ({
        id: `tag-${args.data.name}`,
        name: args.data.name,
      }));
      prismaMock.contact.findUniqueOrThrow.mockImplementation(async (args: { where: { id: string } }) => ({
        id: args.where.id,
        tenantId: 'tenant-1',
        displayName: 'João',
        fullName: 'João',
        primaryPhone: '+5511999999999',
        tags: [],
        phones: [],
      }));
      prismaMock.whatsAppInstance.findFirst.mockResolvedValue(null);
      prismaMock.whatsAppInstance.findMany.mockResolvedValue([]);
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

    it('persists normalized webhook payloads without nested message metadata', async () => {
      const envelope = buildEnvelope();
      envelope.origin = 'webhook';
      envelope.message.payload = {
        id: 'wamid.normalized',
        type: 'TEXT',
        text: 'Mensagem normalizada',
        key: {
          id: 'wamid.normalized',
          remoteJid: '5511999999999@s.whatsapp.net',
        },
        messageTimestamp: 1715342400,
      } as unknown as typeof envelope.message.payload;
      envelope.message.metadata = {
        source: 'baileys:webhook',
        direction: 'INBOUND',
        chatId: envelope.chatId,
        tenantId: envelope.tenantId,
        instanceId: envelope.instanceId,
        sessionId: 'session-9',
        broker: { messageType: 'text', instanceId: envelope.instanceId },
      } satisfies Record<string, unknown>;

      const processed = await ingestInboundWhatsAppMessage(envelope);

      expect(processed).toBe(true);
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
      expect(normalizeInboundMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'wamid.normalized', type: 'TEXT', text: 'Mensagem normalizada' })
      );
    });

    it('translates normalized poll choice votes into poll_update acknowledgements', async () => {
      const pollEvent = {
        event: 'WHATSAPP_MESSAGES_UPSERT',
        iid: 'instance-1',
        payload: {
          instanceId: 'instance-1',
          tenantId: 'tenant-1',
          sessionId: 'session-1',
          owner: 'server',
          source: 'unit-test',
          timestamp: 1_700_000_000,
          messages: [
            {
              key: {
                id: 'wamid.poll',
                remoteJid: '5511999999999@s.whatsapp.net',
                fromMe: false,
              },
              pushName: 'Cliente Poll',
              messageTimestamp: 1_700_000_400,
              message: {
                pollUpdateMessage: {
                  pollCreationMessageId: 'poll-1',
                  vote: {
                    values: [1],
                  },
                },
              },
            },
          ],
        },
      } satisfies Parameters<typeof normalizeUpsertEvent>[0];

      const normalization = normalizeUpsertEvent(pollEvent);
      expect(normalization.normalized).toHaveLength(1);
      const [normalized] = normalization.normalized;
      expect(normalized.messageType).toBe('poll_choice');

      const envelope = buildEnvelope();
      envelope.origin = 'webhook';
      envelope.instanceId = normalized.data.instanceId ?? envelope.instanceId;
      envelope.tenantId = normalized.tenantId ?? envelope.tenantId;
      envelope.chatId = '5511999999999@s.whatsapp.net';
      envelope.message.id = normalized.messageId ?? 'wamid.poll';
      envelope.message.externalId = envelope.message.id ?? undefined;
      envelope.message.contact = {
        ...(normalized.data.from as Record<string, unknown>),
      } as typeof envelope.message.contact;
      envelope.message.payload = {
        ...(normalized.data.message as Record<string, unknown>),
      } as typeof envelope.message.payload;

      const metadataBase = {
        ...(normalized.data.metadata as Record<string, unknown>),
      } as Record<string, unknown>;

      const brokerMeta = metadataBase.broker && typeof metadataBase.broker === 'object' && !Array.isArray(metadataBase.broker)
        ? { ...(metadataBase.broker as Record<string, unknown>) }
        : ({} as Record<string, unknown>);

      brokerMeta.messageContentType = 'poll_choice';
      brokerMeta.messageType = 'poll_choice';
      brokerMeta.instanceId = envelope.instanceId;

      metadataBase.broker = brokerMeta;
      metadataBase.messageType = 'poll_choice';
      metadataBase.interactive = { type: 'poll_choice' };
      metadataBase.poll = {
        id: 'poll-1',
        question: 'Qual sua cor favorita?',
        selectedOptions: [{ id: 'option-azul', title: 'Azul' }],
      } satisfies Record<string, unknown>;
      metadataBase.pollChoice = {
        pollId: 'poll-1',
        question: 'Qual sua cor favorita?',
        vote: {
          selectedOptions: [{ id: 'option-azul', title: 'Azul' }],
          optionIds: ['option-azul'],
          timestamp: new Date('2024-05-10T12:00:05.000Z').toISOString(),
        },
      } satisfies Record<string, unknown>;

      envelope.message.metadata = metadataBase;

      const normalizeModule = await vi.importActual<typeof import('../../utils/normalize')>(
        '../../utils/normalize'
      );

      let normalizeInput: Record<string, unknown> | null = null;
      normalizeInboundMessageMock.mockImplementationOnce((message: unknown) => {
        normalizeInput = (message ?? {}) as Record<string, unknown>;
        return normalizeModule.normalizeInboundMessage(message as Parameters<typeof normalizeModule.normalizeInboundMessage>[0]);
      });

      const expectedChoiceText = 'Azul';

      let timelinePayload: { content?: string; metadata?: Record<string, unknown> } | null = null;
      sendMessageMock.mockImplementationOnce(async (...args: unknown[]) => {
        const [, , payload] = args as [unknown, unknown, { content: string; metadata?: Record<string, unknown> }];
        timelinePayload = payload;
        return {
          id: 'timeline-poll',
          tenantId: envelope.tenantId,
          content: payload.content,
          direction: 'INBOUND',
          metadata: { eventMetadata: payload.metadata?.eventMetadata ?? {} },
          createdAt: new Date('2024-05-10T12:00:06.000Z'),
        };
      });

      const processed = await ingestInboundWhatsAppMessage(envelope);

      expect(processed).toBe(true);
      expect(normalizeInboundMessageMock).toHaveBeenCalledTimes(1);
      expect(normalizeInput?.['text']).toBe(expectedChoiceText);
      expect(timelinePayload?.content).toBe(expectedChoiceText);
      expect(timelinePayload?.content).not.toContain('[Mensagem recebida via WhatsApp]');

      // A metadata da timeline guarda a metadata do envelope em `eventMetadata` (o `source` do
      // envelope — 'raw_normalized' — tem precedência sobre o do normalizador de enquete).
      const raw = (timelinePayload?.metadata?.raw ?? {}) as Record<string, unknown>;
      expect(raw).toMatchObject({ type: 'TEXT', text: expectedChoiceText });

      const eventMetadata = (timelinePayload?.metadata?.eventMetadata ?? {}) as Record<string, unknown>;
      expect(eventMetadata).toMatchObject({ tenantId: 'tenant-1', chatId: '5511999999999@s.whatsapp.net' });
      const pollMetadata = (eventMetadata.poll ?? {}) as Record<string, unknown>;
      const pollSelectedOptions = Array.isArray(pollMetadata.selectedOptions)
        ? (pollMetadata.selectedOptions as Record<string, unknown>[])
        : [];
      expect(pollSelectedOptions[0]?.title).toBe('Azul');
      const pollChoice = (eventMetadata.pollChoice ?? {}) as { vote?: { optionIds?: unknown } };
      expect(pollChoice.vote?.optionIds).toEqual(['option-azul']);
    });

    it('does not create instance-indexed allocations when no campaign already owns the lead', async () => {
      // Piloto Corban (adae3c03): só uma alocação de campanha existente e inequívoca define a origem;
      // a alocação "fallback" indexada por instância foi removida.
      const processed = await ingestInboundWhatsAppMessage(buildEnvelope());

      expect(processed).toBe(true);
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
      expect(addAllocationsMock).not.toHaveBeenCalled();
      expect(emitToTenantMock).not.toHaveBeenCalledWith('tenant-1', 'leadAllocations.new', expect.anything());
      expect(prismaMock.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-1', whatsappInstanceId: 'instance-1', status: 'active' }),
        })
      );
      expect(inboundMessagesCounterIncMock).toHaveBeenCalledWith({
        origin: 'webhook',
        tenantId: 'tenant-1',
        instanceId: 'instance-1',
      });
    });

    it('allocates the lead to the single campaign that already owns it', async () => {
      prismaMock.campaign.findMany.mockResolvedValueOnce([
        { id: 'campaign-1', name: 'Campanha', status: 'active', whatsappInstanceId: 'instance-1', tenantId: 'tenant-1', agreementId: 'agreement-1' },
      ]);
      addAllocationsMock.mockResolvedValueOnce({
        newlyAllocated: [
          { allocationId: 'alloc-1', leadId: 'lead-1', campaignId: 'campaign-1', agreementId: 'agreement-1', instanceId: 'instance-1' },
        ],
        summary: { total: 1, contacted: 0, won: 0, lost: 0 },
      });

      const processed = await ingestInboundWhatsAppMessage(buildEnvelope());

      expect(processed).toBe(true);
      expect(addAllocationsMock).toHaveBeenCalledWith('tenant-1', { campaignId: 'campaign-1' }, expect.any(Array));
      expect(emitToTenantMock).toHaveBeenCalledWith(
        'tenant-1',
        'leadAllocations.new',
        expect.objectContaining({ campaignId: 'campaign-1', instanceId: 'instance-1' })
      );
    });

    it('permits retry when queue provisioning fails before persisting the message', async () => {
      prismaMock.queue.findFirst.mockResolvedValueOnce(null);
      prismaMock.queue.upsert.mockRejectedValueOnce(new Error('queue unavailable'));

      const firstAttempt = await ingestInboundWhatsAppMessage(buildEnvelope());
      expect(firstAttempt).toBe(false);
      expect(sendMessageMock).not.toHaveBeenCalled();
      expect(dedupeCache.size).toBe(0);

      const secondAttempt = await ingestInboundWhatsAppMessage(buildEnvelope());
      expect(secondAttempt).toBe(true);
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
      expect(prismaMock.queue.upsert).toHaveBeenCalledTimes(1);
      expect(dedupeCache.size).toBeGreaterThan(0);
    });

    // Desde 8dcc45dd a resolução da instância é: id (findUnique) → brokerId (findFirst) → autoprov
    // → instâncias do tenant. Antes a busca por broker vinha primeiro (com tenantId no where).
    it('resolves the instance by id before falling back to the broker lookup', async () => {
      const envelope = buildEnvelope();
      envelope.message.metadata = {
        ...(envelope.message.metadata as Record<string, unknown>),
        brokerId: envelope.instanceId,
      };

      const processed = await ingestInboundWhatsAppMessage(envelope);

      expect(processed).toBe(true);
      expect(prismaMock.whatsAppInstance.findUnique).toHaveBeenCalledWith({ where: { id: 'instance-1' } });
      expect(prismaMock.whatsAppInstance.findFirst).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ brokerId: 'instance-1' }) })
      );
      expect(prismaMock.whatsAppInstance.create).not.toHaveBeenCalled();
    });

    it('processes messages when only the broker UUID is available as instance identifier', async () => {
      const envelope = buildEnvelope();
      envelope.instanceId = 'broker-uuid-9';
      envelope.message.metadata = {
        ...(envelope.message.metadata as Record<string, unknown>),
        instanceId: envelope.instanceId,
        brokerId: envelope.instanceId,
      };

      const instanceRecord = { id: 'instance-legacy', tenantId: 'tenant-1' };
      prismaMock.whatsAppInstance.findUnique.mockResolvedValueOnce(null);
      prismaMock.whatsAppInstance.findFirst.mockResolvedValueOnce(instanceRecord);

      const processed = await ingestInboundWhatsAppMessage(envelope);

      expect(processed).toBe(true);
      expect(prismaMock.whatsAppInstance.findUnique).toHaveBeenCalledWith({ where: { id: 'broker-uuid-9' } });
      // brokerId é único só por tenant (@@unique([tenantId, brokerId])): a busca é escopada pela dica de tenant.
      expect(prismaMock.whatsAppInstance.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', brokerId: 'broker-uuid-9' },
      });
      expect(prismaMock.whatsAppInstance.create).not.toHaveBeenCalled();
      expect(createTicketMock).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1' }));
    });

    // Sem tenant padrão: o tenant sai só do mapeamento instância → tenant; nada cai em `demo-tenant`.
    describe('tenant resolution without a default tenant', () => {
      it('resolves a tenantless event strictly from the instance → tenant mapping', async () => {
        const envelope = buildEnvelope();
        envelope.tenantId = null;
        prismaMock.whatsAppInstance.findUnique.mockResolvedValueOnce({ id: 'instance-1', tenantId: 'tenant-1' });

        const processed = await ingestInboundWhatsAppMessage(envelope);

        expect(processed).toBe(true);
        expect(createTicketMock).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1' }));
        expect(prismaMock.whatsAppInstance.findMany).not.toHaveBeenCalled();
      });

      it('rejects (and does not reroute) events whose instance is unknown, even with a tenant hint', async () => {
        const envelope = buildEnvelope();
        envelope.instanceId = 'instance-ghost';
        envelope.message.metadata = { ...(envelope.message.metadata as Record<string, unknown>), instanceId: 'instance-ghost' };
        prismaMock.whatsAppInstance.findUnique.mockResolvedValueOnce(null);
        prismaMock.whatsAppInstance.findMany.mockResolvedValue([{ id: 'instance-1', tenantId: 'tenant-1' }]);

        const processed = await ingestInboundWhatsAppMessage(envelope);

        expect(processed).toBe(false);
        // Antes: caía na "melhor instância do tenant" e gravava a mensagem nela.
        expect(prismaMock.whatsAppInstance.findMany).not.toHaveBeenCalledWith({ where: { tenantId: 'tenant-1' } });
        expect(createTicketMock).not.toHaveBeenCalled();
        expect(loggerMock.warn).toHaveBeenCalledWith(
          expect.stringContaining('Instância WhatsApp não localizada'),
          expect.objectContaining({ reason: 'unknown_instance', instanceId: 'instance-ghost' })
        );
      });

      it('rejects events whose instance belongs to a tenant other than the hint', async () => {
        prismaMock.whatsAppInstance.findUnique.mockResolvedValueOnce({ id: 'instance-1', tenantId: 'tenant-other' });

        const processed = await ingestInboundWhatsAppMessage(buildEnvelope());

        expect(processed).toBe(false);
        expect(createTicketMock).not.toHaveBeenCalled();
        expect(loggerMock.warn).toHaveBeenCalledWith(
          expect.stringContaining('Instância WhatsApp não localizada'),
          expect.objectContaining({ reason: 'tenant_mismatch' })
        );
      });

      it('rejects tenantless events whose brokerId exists in more than one tenant', async () => {
        const envelope = buildEnvelope();
        envelope.tenantId = null;
        envelope.instanceId = 'shared-broker-id';
        envelope.message.metadata = {
          ...(envelope.message.metadata as Record<string, unknown>),
          instanceId: 'shared-broker-id',
          brokerId: 'shared-broker-id',
        };
        prismaMock.whatsAppInstance.findUnique.mockResolvedValueOnce(null);
        prismaMock.whatsAppInstance.findMany.mockResolvedValueOnce([
          { id: 'instance-a', tenantId: 'tenant-a', brokerId: 'shared-broker-id' },
          { id: 'instance-b', tenantId: 'tenant-b', brokerId: 'shared-broker-id' },
        ]);

        const processed = await ingestInboundWhatsAppMessage(envelope);

        expect(processed).toBe(false);
        expect(prismaMock.whatsAppInstance.findMany).toHaveBeenCalledWith({
          where: { brokerId: 'shared-broker-id' },
          take: 2,
        });
        expect(createTicketMock).not.toHaveBeenCalled();
        expect(loggerMock.warn).toHaveBeenCalledWith(
          expect.stringContaining('Instância WhatsApp não localizada'),
          expect.objectContaining({ reason: 'ambiguous_broker_id' })
        );
      });
    });

    it('auto provisions missing instances before processing standard inbound flow', async () => {
      allowInboundAutoProvision();
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
      // Os eventos realtime do ticket/mensagem saem de sendMessage (camada de tickets, mockada aqui);
      // a ingestão chama emitRealtimeUpdatesForInbound com emitTicketRealtimeEvents=false para não duplicar.
      expect(sendMessageMock).toHaveBeenCalledWith(
        'tenant-1',
        undefined,
        expect.objectContaining({ ticketId: 'ticket-1', direction: 'INBOUND' })
      );
      expect(emitToTicketMock).not.toHaveBeenCalledWith('ticket-1', 'ticketMessages.new', expect.anything());
    });

    // A ingestão lê a dica de tenant de metadata → envelope (sem tenant padrão); dicas soltas no payload (fora de
    // metadata) não são consideradas, então o tenant chega via metadata do envelope.
    it('auto provisions instance and default queue on the first inbound message when only metadata identifies the tenant', async () => {
      allowInboundAutoProvision();
      const envelope = buildEnvelope();
      envelope.tenantId = null;
      envelope.message.metadata = {
        ...(envelope.message.metadata as Record<string, unknown>),
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
      expect(sendMessageMock).toHaveBeenCalledWith(
        'tenant-1',
        undefined,
        expect.objectContaining({ ticketId: 'ticket-1' })
      );
      expect(emitToTenantMock).toHaveBeenCalledWith(
        'tenant-1',
        'whatsapp.queue.autoProvisioned',
        expect.objectContaining({ tenantId: 'tenant-1', queueId: 'queue-auto-1' })
      );

      expect(queueCacheByTenant.get('tenant-1')).toEqual(
        expect.objectContaining({ id: 'queue-auto-1' })
      );
    });

    it('logs auto provisioning success for fresh instances of an existing tenant', async () => {
      allowInboundAutoProvision();
      const envelope = buildEnvelope();

      prismaMock.whatsAppInstance.findUnique.mockResolvedValueOnce(null);
      // eb613513: o tenant precisa existir (não há mais ensureTenantRecord no autoprov).
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
        '🎯 LeadEngine • WhatsApp :: 🆕 Instância provisionada automaticamente',
        expect.objectContaining({
          instanceId: 'instance-1',
          tenantId: 'tenant-1',
          brokerId: 'instance-1',
        })
      );
      expect(loggerMock.error).not.toHaveBeenCalledWith(
        '🎯 LeadEngine • WhatsApp :: ⚠️ Falha ao autoprov instância durante ingestão',
        expect.any(Object)
      );
      expect(createTicketMock).toHaveBeenCalledTimes(1);
      expect(sendMessageMock).toHaveBeenCalledTimes(1);
    });

    it('does not auto provision instances for tenants outside the allowlist', async () => {
      allowInboundAutoProvision('another-tenant');
      prismaMock.whatsAppInstance.findUnique.mockResolvedValueOnce(null);
      prismaMock.tenant.findFirst.mockResolvedValue({ id: 'tenant-1', name: 'Tenant One' });

      const processed = await ingestInboundWhatsAppMessage(buildEnvelope());

      expect(processed).toBe(false);
      expect(prismaMock.whatsAppInstance.create).not.toHaveBeenCalled();
      expect(sendMessageMock).not.toHaveBeenCalled();
    });
  });
});
