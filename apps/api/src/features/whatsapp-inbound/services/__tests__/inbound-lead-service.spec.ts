import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { NotFoundError } from '@ticketz/core';

const findUniqueMock = vi.fn();
const findFirstMock = vi.fn();
const queueUpsertMock = vi.fn();
const createTicketMock = vi.fn();
const sendMessageMock = vi.fn();
const leadUpsertMock = vi.fn();
const leadFindFirstMock = vi.fn();
const leadUpdateMock = vi.fn();
const leadCreateMock = vi.fn();
const leadActivityFindFirstMock = vi.fn();
const leadActivityCreateMock = vi.fn();
const emitToTenantMock = vi.fn();
const emitToTicketMock = vi.fn();
const leadLastContactGaugeSetMock = vi.fn();
const whatsappInstanceFindUniqueMock = vi.fn();
const whatsappInstanceCreateMock = vi.fn();
const whatsappInstanceFindFirstMock = vi.fn();
const whatsappInstanceUpdateMock = vi.fn();
const tenantFindFirstMock = vi.fn();
const contactFindUniqueMock = vi.fn();
const contactFindFirstMock = vi.fn();
const contactUpdateMock = vi.fn();
const contactCreateMock = vi.fn();
const ticketFindUniqueMock = vi.fn();

vi.mock('../../../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../../lib/prisma', () => ({
  prisma: {
    queue: {
      findUnique: findUniqueMock,
      findFirst: findFirstMock,
      upsert: queueUpsertMock,
    },
    whatsAppInstance: {
      findUnique: whatsappInstanceFindUniqueMock,
      create: whatsappInstanceCreateMock,
      findFirst: whatsappInstanceFindFirstMock,
      update: whatsappInstanceUpdateMock,
    },
    tenant: {
      findFirst: tenantFindFirstMock,
    },
    contact: {
      findUnique: contactFindUniqueMock,
      findFirst: contactFindFirstMock,
      update: contactUpdateMock,
      create: contactCreateMock,
    },
    lead: {
      findFirst: leadFindFirstMock,
      upsert: leadUpsertMock,
      update: leadUpdateMock,
      create: leadCreateMock,
    },
    leadActivity: {
      findFirst: leadActivityFindFirstMock,
      create: leadActivityCreateMock,
    },
    ticket: {
      findUnique: ticketFindUniqueMock,
    },
  },
}));

vi.mock('../../../../services/ticket-service', () => ({
  createTicket: createTicketMock,
  sendMessage: sendMessageMock,
}));

vi.mock('../../../../lib/socket-registry', () => ({
  emitToTenant: emitToTenantMock,
  emitToTicket: emitToTicketMock,
  emitToAgreement: vi.fn(),
}));

const ensureTenantRecordMock = vi.fn();

vi.mock('../../../../services/tenant-service', () => ({
  ensureTenantRecord: ensureTenantRecordMock,
}));

vi.mock('../../../../lib/metrics', () => ({
  inboundMessagesProcessedCounter: { inc: vi.fn() },
  leadLastContactGauge: { set: leadLastContactGaugeSetMock },
}));

type TestingHelpers = typeof import('../inbound-lead-service')['__testing'];

let testing!: TestingHelpers;
type UpsertParams = Parameters<TestingHelpers['upsertLeadFromInbound']>[0];
type ProcessEventParams = Parameters<TestingHelpers['processStandardInboundEvent']>;
type InboundEvent = ProcessEventParams[0];

beforeAll(async () => {
  testing = (await import('../inbound-lead-service')).__testing;
});

describe('getDefaultQueueId', () => {
  beforeEach(() => {
    testing.queueCacheByTenant.clear();
    vi.resetAllMocks();
    queueUpsertMock.mockReset();
  });

  it('returns cached queue id when entry is valid and queue exists', async () => {
    testing.queueCacheByTenant.set('tenant-1', {
      id: 'queue-1',
      expires: Date.now() + testing.DEFAULT_QUEUE_CACHE_TTL_MS,
    });

    findUniqueMock.mockResolvedValueOnce({ id: 'queue-1' });

    const queueId = await testing.getDefaultQueueId('tenant-1');

    expect(queueId).toBe('queue-1');
    expect(findUniqueMock).toHaveBeenCalledTimes(1);
    expect(findFirstMock).not.toHaveBeenCalled();
    expect(queueUpsertMock).not.toHaveBeenCalled();
  });

  it('refetches queue when cached id is missing', async () => {
    testing.queueCacheByTenant.set('tenant-2', {
      id: 'queue-old',
      expires: Date.now() + testing.DEFAULT_QUEUE_CACHE_TTL_MS,
    });

    findUniqueMock.mockResolvedValueOnce(null);
    findFirstMock.mockResolvedValueOnce({ id: 'queue-new' });

    const queueId = await testing.getDefaultQueueId('tenant-2');

    expect(queueId).toBe('queue-new');
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { id: 'queue-old' } });
    expect(findFirstMock).toHaveBeenCalledTimes(1);
    expect(testing.queueCacheByTenant.get('tenant-2')).toMatchObject({ id: 'queue-new' });
    expect(queueUpsertMock).not.toHaveBeenCalled();
  });

  it('provisions fallback queue when none is found', async () => {
    findFirstMock.mockResolvedValueOnce(null);
    queueUpsertMock.mockResolvedValueOnce({ id: 'queue-fallback' });

    const queueId = await testing.getDefaultQueueId('tenant-3');

    expect(queueId).toBe('queue-fallback');
    expect(queueUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_name: {
            tenantId: 'tenant-3',
            name: 'Atendimento Geral',
          },
        },
        update: expect.objectContaining({
          description: expect.stringContaining('WhatsApp'),
        }),
        create: expect.objectContaining({
          tenantId: 'tenant-3',
          name: 'Atendimento Geral',
        }),
      })
    );
    expect(testing.queueCacheByTenant.get('tenant-3')).toMatchObject({ id: 'queue-fallback' });
  });
});

describe('metadata helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('collects unique tenant identifiers from metadata', () => {
    const metadata = {
      tenantId: 'tenant-1',
      tenantSlug: 'tenant-slug',
      tenant: { id: 'tenant-1', slug: 'tenant-slug-alt' },
      context: { tenantId: 'tenant-ctx', tenant: { slug: 'tenant-slug-ctx' } },
    };

    const result = testing.resolveTenantIdentifiersFromMetadata(metadata);

    expect(result).toEqual([
      'tenant-1',
      'tenant-slug',
      'tenant-slug-alt',
      'tenant-ctx',
      'tenant-slug-ctx',
    ]);
  });

  describe('attemptAutoProvisionWhatsAppInstance', () => {
    const baseMetadata = {
      tenantId: 'tenant-autoprov',
      sessionId: 'session-1',
      instanceId: 'wa-auto',
      instanceName: 'WhatsApp Principal',
    };

    beforeEach(() => {
      whatsappInstanceFindUniqueMock.mockReset();
      whatsappInstanceCreateMock.mockReset();
      whatsappInstanceFindFirstMock.mockReset();
      whatsappInstanceUpdateMock.mockReset();
      tenantFindFirstMock.mockReset();
      whatsappInstanceFindFirstMock.mockResolvedValue(null);
    });

    it('returns null when simple mode is disabled', async () => {
      const result = await testing.attemptAutoProvisionWhatsAppInstance({
        instanceId: 'wa-auto',
        metadata: baseMetadata,
        requestId: 'req-1',
        simpleMode: false,
      });

      expect(result).toBeNull();
      expect(tenantFindFirstMock).not.toHaveBeenCalled();
      expect(whatsappInstanceCreateMock).not.toHaveBeenCalled();
    });

    it('creates a WhatsApp instance when tenant is resolved', async () => {
      const tenantRecord = { id: 'tenant-autoprov', name: 'Tenant Demo', slug: 'tenant-autoprov' };
      const instanceRecord = {
        id: 'wa-auto',
        tenantId: tenantRecord.id,
        name: 'WhatsApp Principal',
        brokerId: 'wa-auto',
        status: 'connected',
        connected: true,
        phoneNumber: null,
        lastSeenAt: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      tenantFindFirstMock.mockResolvedValueOnce(tenantRecord);
      whatsappInstanceFindFirstMock.mockResolvedValueOnce(null);
      whatsappInstanceCreateMock.mockResolvedValueOnce(instanceRecord);

      const result = await testing.attemptAutoProvisionWhatsAppInstance({
        instanceId: 'wa-auto',
        metadata: baseMetadata,
        requestId: 'req-2',
        simpleMode: true,
      });

      expect(tenantFindFirstMock).toHaveBeenCalledWith({
        where: {
          OR: [
            { id: 'tenant-autoprov' },
            { slug: 'tenant-autoprov' },
          ],
        },
      });
      expect(whatsappInstanceCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'wa-auto',
            tenantId: tenantRecord.id,
            name: 'WhatsApp Principal',
            brokerId: 'wa-auto',
            connected: true,
            status: 'connected',
            metadata: expect.objectContaining({
              autopProvisionBrokerId: 'wa-auto',
              autopProvisionTenantIdentifiers: ['tenant-autoprov'],
              autopProvisionRequestId: 'req-2',
            }),
          }),
        })
      );
      expect(whatsappInstanceFindFirstMock).toHaveBeenCalledWith({
        where: { brokerId: 'wa-auto', tenantId: tenantRecord.id },
      });
      expect(result).toEqual(expect.objectContaining({ id: 'wa-auto', tenantId: tenantRecord.id }));
    });

    it('reuses existing instance located by broker before creating a new record', async () => {
      const tenantRecord = { id: 'tenant-autoprov', name: 'Tenant Demo', slug: 'tenant-autoprov' };
      const existingRecord = {
        id: 'wa-existing',
        tenantId: tenantRecord.id,
        name: 'WhatsApp Existing',
        brokerId: 'session-1',
        status: 'connected',
        connected: true,
        phoneNumber: null,
        lastSeenAt: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      tenantFindFirstMock.mockResolvedValueOnce(tenantRecord);
      const metadataWithoutInstance = { ...baseMetadata };
      delete (metadataWithoutInstance as Record<string, unknown>).instanceId;
      whatsappInstanceFindFirstMock.mockResolvedValueOnce(existingRecord);
      whatsappInstanceUpdateMock.mockResolvedValueOnce(existingRecord);

      const result = await testing.attemptAutoProvisionWhatsAppInstance({
        instanceId: 'wa-auto',
        metadata: metadataWithoutInstance,
        requestId: 'req-3',
        simpleMode: true,
      });

      expect(whatsappInstanceFindFirstMock).toHaveBeenCalledWith({
        where: { brokerId: 'wa-auto', tenantId: tenantRecord.id },
      });
      expect(whatsappInstanceCreateMock).not.toHaveBeenCalled();
      expect(result).toBe(existingRecord);
    });

    it('reuses existing instance when broker collision happens', async () => {
      const tenantRecord = { id: 'tenant-autoprov', name: 'Tenant Demo', slug: 'tenant-autoprov' };
      const existingRecord = {
        id: 'wa-existing',
        tenantId: tenantRecord.id,
        name: 'WhatsApp Existing',
        brokerId: 'session-1',
        status: 'connected',
        connected: true,
        phoneNumber: null,
        lastSeenAt: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      tenantFindFirstMock.mockResolvedValueOnce(tenantRecord);
      whatsappInstanceFindFirstMock.mockResolvedValueOnce(null);
      whatsappInstanceCreateMock.mockRejectedValueOnce({ code: 'P2002' });
      whatsappInstanceFindUniqueMock.mockResolvedValueOnce(null);
      whatsappInstanceFindFirstMock.mockResolvedValueOnce(existingRecord);
      whatsappInstanceFindUniqueMock.mockResolvedValueOnce(existingRecord);
      whatsappInstanceUpdateMock.mockResolvedValue(existingRecord);

      const result = await testing.attemptAutoProvisionWhatsAppInstance({
        instanceId: 'wa-auto',
        metadata: baseMetadata,
        requestId: 'req-3',
        simpleMode: true,
      });

      expect(whatsappInstanceFindFirstMock).toHaveBeenNthCalledWith(1, {
        where: { brokerId: 'wa-auto', tenantId: tenantRecord.id },
      });
      expect(whatsappInstanceFindUniqueMock).toHaveBeenCalledWith({ where: { id: 'wa-auto' } });
      expect(whatsappInstanceFindUniqueMock).toHaveBeenCalledWith({
        where: {
          tenantId_brokerId: {
            tenantId: tenantRecord.id,
            brokerId: 'wa-auto',
          },
        },
      });
      expect(result).toBe(existingRecord);
    });
  });
});

describe('ensureInboundQueueForInboundMessage', () => {
  beforeEach(() => {
    testing.queueCacheByTenant.clear();
    vi.resetAllMocks();
  });

  it('ensures tenant automatically when foreign key errors occur', async () => {
    findFirstMock.mockResolvedValueOnce(null);
    const fkError = new Prisma.PrismaClientKnownRequestError('Missing tenant', {
      code: 'P2003',
      clientVersion: '5.0.0',
    });
    queueUpsertMock.mockRejectedValueOnce(fkError).mockResolvedValueOnce({
      id: 'queue-after-tenant',
      tenantId: 'tenant-missing',
    });
    ensureTenantRecordMock.mockResolvedValueOnce({ id: 'tenant-missing', slug: 'tenant-missing' });

    const result = await testing.ensureInboundQueueForInboundMessage({
      tenantId: 'tenant-missing',
      requestId: 'req-tenant',
      instanceId: 'instance-tenant',
      simpleMode: true,
    });

    expect(result.queueId).toBe('queue-after-tenant');
    expect(result.wasProvisioned).toBe(true);
    expect(result.error).toBeUndefined();
    expect(ensureTenantRecordMock).toHaveBeenCalledWith(
      'tenant-missing',
      expect.objectContaining({ source: 'whatsapp-inbound-auto-queue', action: 'ensure-tenant' })
    );
    expect(emitToTenantMock).toHaveBeenCalledWith(
      'tenant-missing',
      'whatsapp.queue.autoProvisioned',
      expect.objectContaining({ queueId: 'queue-after-tenant' })
    );
  });

  it('returns recoverable error when tenant cannot be provisioned automatically', async () => {
    findFirstMock.mockResolvedValueOnce(null);
    const fkError = new Prisma.PrismaClientKnownRequestError('Missing tenant', {
      code: 'P2003',
      clientVersion: '5.0.0',
    });
    queueUpsertMock.mockRejectedValueOnce(fkError).mockRejectedValueOnce(fkError);
    ensureTenantRecordMock.mockResolvedValueOnce({ id: 'tenant-missing', slug: 'tenant-missing' });

    const result = await testing.ensureInboundQueueForInboundMessage({
      tenantId: 'tenant-missing',
      requestId: 'req-tenant',
      instanceId: 'instance-tenant',
      simpleMode: false,
    });

    expect(result.queueId).toBeNull();
    expect(result.wasProvisioned).toBe(false);
    expect(result.error).toEqual(
      expect.objectContaining({ reason: 'TENANT_NOT_FOUND', recoverable: true })
    );
    expect(emitToTenantMock).toHaveBeenCalledWith(
      'tenant-missing',
      'whatsapp.queue.missing',
      expect.objectContaining({
        reason: 'TENANT_NOT_FOUND',
        recoverable: true,
      })
    );
    expect(testing.queueCacheByTenant.has('tenant-missing')).toBe(false);
  });
});

describe('ensureTicketForContact', () => {
  beforeEach(() => {
    testing.queueCacheByTenant.clear();
    vi.resetAllMocks();
  });

  it('provisions fallback queue for tenants without queues and continues ticket creation', async () => {
    findFirstMock.mockResolvedValueOnce(null);
    queueUpsertMock.mockResolvedValueOnce({ id: 'queue-auto', tenantId: 'tenant-queue-less' });

    const queueResolution = await testing.ensureInboundQueueForInboundMessage({
      tenantId: 'tenant-queue-less',
      requestId: 'req-queue',
      instanceId: 'instance-queue',
      simpleMode: false,
    });

    expect(queueResolution.queueId).toBe('queue-auto');
    expect(queueResolution.wasProvisioned).toBe(true);
    expect(queueResolution.error).toBeUndefined();
    expect(testing.queueCacheByTenant.get('tenant-queue-less')).toMatchObject({ id: 'queue-auto' });
    expect(emitToTenantMock).toHaveBeenCalledWith(
      'tenant-queue-less',
      'whatsapp.queue.autoProvisioned',
      expect.objectContaining({
        tenantId: 'tenant-queue-less',
        instanceId: 'instance-queue',
        queueId: 'queue-auto',
      })
    );

    createTicketMock.mockResolvedValueOnce({ id: 'ticket-auto' });

    const ticketId = await testing.ensureTicketForContact(
      'tenant-queue-less',
      'contact-queue',
      queueResolution.queueId!,
      'Subject',
      {}
    );

    expect(ticketId).toBe('ticket-auto');
    expect(createTicketMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-queue-less',
        contactId: 'contact-queue',
        queueId: 'queue-auto',
      })
    );
  });

  it('clears cache and retries with refreshed queue when NotFoundError is thrown', async () => {
    testing.queueCacheByTenant.set('tenant-3', {
      id: 'queue-stale',
      expires: Date.now() + testing.DEFAULT_QUEUE_CACHE_TTL_MS,
    });

    createTicketMock.mockRejectedValueOnce(new NotFoundError('Queue', 'queue-stale'));
    findFirstMock.mockResolvedValueOnce({ id: 'queue-fresh' });
    createTicketMock.mockResolvedValueOnce({ id: 'ticket-123' });

    const result = await testing.ensureTicketForContact('tenant-3', 'contact-1', 'queue-stale', 'Subject', {});

    expect(result).toBe('ticket-123');
    expect(testing.queueCacheByTenant.get('tenant-3')).toMatchObject({ id: 'queue-fresh' });
    expect(createTicketMock).toHaveBeenCalledTimes(2);
    expect(createTicketMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ queueId: 'queue-fresh' })
    );
  });

  it('retries when foreign key error is present in error cause', async () => {
    testing.queueCacheByTenant.set('tenant-4', {
      id: 'queue-deleted',
      expires: Date.now() + testing.DEFAULT_QUEUE_CACHE_TTL_MS,
    });

    const prismaError = new Prisma.PrismaClientKnownRequestError('Missing queue', {
      code: 'P2003',
      clientVersion: '5.0.0',
    });
    const wrappedError = new Error('Failed to create ticket');
    (wrappedError as { cause?: unknown }).cause = prismaError;

    createTicketMock.mockRejectedValueOnce(wrappedError);
    findFirstMock.mockResolvedValueOnce({ id: 'queue-recreated' });
    createTicketMock.mockResolvedValueOnce({ id: 'ticket-456' });

    const result = await testing.ensureTicketForContact('tenant-4', 'contact-9', 'queue-deleted', 'Subject', {});

    expect(result).toBe('ticket-456');
    expect(testing.queueCacheByTenant.get('tenant-4')).toMatchObject({ id: 'queue-recreated' });
    expect(createTicketMock).toHaveBeenCalledTimes(2);
    expect(createTicketMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ queueId: 'queue-recreated' })
    );
  });
});

describe('upsertLeadFromInbound', () => {
  const baseMessage = {
    id: 'message-1',
    createdAt: new Date('2024-03-20T10:00:00.000Z'),
    direction: 'INBOUND',
    content: 'Olá, mundo! Esta é uma mensagem de teste.',
  } as const;

  beforeEach(() => {
    leadFindFirstMock.mockReset();
    leadFindFirstMock.mockResolvedValue(null);
    leadUpdateMock.mockReset();
    leadCreateMock.mockReset();
    leadUpsertMock.mockReset();
    leadActivityFindFirstMock.mockReset();
    leadActivityFindFirstMock.mockResolvedValue(null);
    leadActivityCreateMock.mockReset();
    emitToTenantMock.mockReset();
    emitToTicketMock.mockReset();
    leadLastContactGaugeSetMock.mockReset();
  });

  it('creates a new lead, records activity and emits realtime events', async () => {
    const leadRecord = {
      id: 'lead-1',
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      status: 'NEW',
      source: 'WHATSAPP',
      lastContactAt: baseMessage.createdAt,
    };
    const activityRecord = {
      id: 'activity-1',
      tenantId: 'tenant-1',
      leadId: leadRecord.id,
      type: 'WHATSAPP_REPLIED',
      occurredAt: baseMessage.createdAt,
    };
    leadCreateMock.mockResolvedValueOnce(leadRecord);
    leadActivityCreateMock.mockResolvedValueOnce(activityRecord);

    const message = baseMessage as unknown as UpsertParams['message'];
    await testing.upsertLeadFromInbound({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      ticketId: 'ticket-1',
      instanceId: 'instance-1',
      providerMessageId: 'provider-1',
      message,
    });

    expect(leadCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          contactId: 'contact-1',
          status: 'NEW',
          source: 'WHATSAPP',
          lastContactAt: baseMessage.createdAt,
        }),
      })
    );

    expect(leadActivityCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: leadRecord.id,
          type: 'WHATSAPP_REPLIED',
          occurredAt: baseMessage.createdAt,
          metadata: expect.objectContaining({
            ticketId: 'ticket-1',
            instanceId: 'instance-1',
            providerMessageId: 'provider-1',
            messageId: baseMessage.id,
            contactId: 'contact-1',
            preview: 'Olá, mundo! Esta é uma mensagem de teste.',
          }),
        }),
      })
    );

    expect(leadLastContactGaugeSetMock).toHaveBeenCalledWith(
      { tenantId: 'tenant-1', leadId: leadRecord.id },
      baseMessage.createdAt.getTime()
    );

    expect(emitToTenantMock).toHaveBeenCalledWith(
      'tenant-1',
      'leads.updated',
      expect.objectContaining({
        lead: expect.objectContaining({ id: leadRecord.id }),
        leadActivity: expect.objectContaining({ id: activityRecord.id }),
      })
    );
    expect(emitToTenantMock).toHaveBeenCalledWith(
      'tenant-1',
      'leadActivities.new',
      expect.objectContaining({
        lead: expect.objectContaining({ id: leadRecord.id }),
        leadActivity: expect.objectContaining({ id: activityRecord.id }),
      })
    );
    expect(emitToTicketMock).toHaveBeenCalledWith(
      'ticket-1',
      'leads.updated',
      expect.objectContaining({
        lead: expect.objectContaining({ id: leadRecord.id }),
        leadActivity: expect.objectContaining({ id: activityRecord.id }),
      })
    );
    expect(emitToTicketMock).toHaveBeenCalledWith(
      'ticket-1',
      'leadActivities.new',
      expect.objectContaining({
        lead: expect.objectContaining({ id: leadRecord.id }),
        leadActivity: expect.objectContaining({ id: activityRecord.id }),
      })
    );
    expect(leadLastContactGaugeSetMock).toHaveBeenCalledWith(
      { tenantId: 'tenant-1', leadId: leadRecord.id },
      baseMessage.createdAt.getTime()
    );
  });

  it('reuses existing lead activity when messageId matches', async () => {
    const leadRecord = {
      id: 'lead-2',
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      status: 'NEW',
      source: 'WHATSAPP',
      lastContactAt: baseMessage.createdAt,
    };
    const existingActivity = {
      id: 'activity-existing',
      tenantId: 'tenant-1',
      leadId: leadRecord.id,
      type: 'WHATSAPP_REPLIED',
      occurredAt: baseMessage.createdAt,
    };

    leadFindFirstMock.mockResolvedValueOnce(leadRecord);
    leadUpdateMock.mockResolvedValueOnce(leadRecord);
    leadActivityFindFirstMock.mockResolvedValueOnce(existingActivity);

    const message = baseMessage as unknown as UpsertParams['message'];
    const result = await testing.upsertLeadFromInbound({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      ticketId: 'ticket-1',
      instanceId: 'instance-1',
      providerMessageId: 'provider-1',
      message,
    });

    expect(result).toEqual({ lead: leadRecord, leadActivity: existingActivity });
    expect(leadActivityCreateMock).not.toHaveBeenCalled();
    expect(emitToTenantMock).not.toHaveBeenCalled();
    expect(emitToTicketMock).not.toHaveBeenCalled();
    expect(leadLastContactGaugeSetMock).toHaveBeenCalledTimes(1);
    expect(leadUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: leadRecord.id },
        data: expect.objectContaining({ lastContactAt: baseMessage.createdAt }),
      })
    );
    expect(leadCreateMock).not.toHaveBeenCalled();
  });

  it('updates existing lead when already present', async () => {
    const message = {
      ...baseMessage,
      createdAt: new Date('2024-03-22T15:30:00.000Z'),
    } as unknown as UpsertParams['message'];
    const existingLead = {
      id: 'lead-existing',
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      status: 'CONTACTED',
      source: 'WHATSAPP',
      lastContactAt: new Date('2024-03-20T15:30:00.000Z'),
    };

    leadFindFirstMock.mockResolvedValueOnce(existingLead);
    leadUpdateMock.mockResolvedValueOnce({ ...existingLead, lastContactAt: message.createdAt });
    leadActivityCreateMock.mockResolvedValueOnce({
      id: 'activity-2',
      tenantId: 'tenant-1',
      leadId: 'lead-existing',
      type: 'WHATSAPP_REPLIED',
      occurredAt: message.createdAt,
    });

    await testing.upsertLeadFromInbound({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      ticketId: 'ticket-1',
      instanceId: 'instance-1',
      providerMessageId: null,
      message,
    });

    expect(leadUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-existing' },
        data: expect.objectContaining({ lastContactAt: message.createdAt }),
      })
    );
    expect(leadCreateMock).not.toHaveBeenCalled();
    expect(leadActivityCreateMock).toHaveBeenCalledTimes(1);
  });
});

describe('processStandardInboundEvent', () => {
  beforeEach(() => {
    testing.queueCacheByTenant.clear();
    vi.resetAllMocks();
    ticketFindUniqueMock.mockReset();
  });

  it('auto provisions fallback queue and delivers message to inbox when tenant lacks queues', async () => {
    const instanceRecord = {
      id: 'wa-tenantless',
      tenantId: 'tenant-queue-gap',
      name: 'WhatsApp Principal',
      brokerId: 'wa-tenantless',
    } as const;

    const event: InboundEvent = {
      id: 'event-queue-gap',
      instanceId: instanceRecord.id,
      tenantId: instanceRecord.tenantId,
      direction: 'INBOUND',
      contact: { phone: '+5511999999999', name: 'Cliente WhatsApp' },
      message: { id: 'broker-message-1', text: 'Olá!' },
      timestamp: new Date('2024-03-22T10:00:00.000Z').toISOString(),
      metadata: { requestId: 'req-queue-gap' },
      chatId: null,
      externalId: null,
      sessionId: null,
    } as unknown as InboundEvent;

    findFirstMock.mockResolvedValueOnce(null);
    queueUpsertMock.mockResolvedValueOnce({ id: 'queue-fallback', tenantId: instanceRecord.tenantId });

    createTicketMock.mockResolvedValueOnce({ id: 'ticket-fallback' });
    contactFindUniqueMock.mockResolvedValueOnce(null);
    contactFindFirstMock.mockResolvedValueOnce(null);
    contactCreateMock.mockResolvedValueOnce({
      id: 'contact-fallback',
      tenantId: instanceRecord.tenantId,
      phone: '+5511999999999',
      name: 'Cliente WhatsApp',
    });
    sendMessageMock.mockResolvedValueOnce({
      id: 'timeline-1',
      createdAt: new Date('2024-03-22T10:00:00.000Z'),
      metadata: { eventMetadata: { requestId: 'req-queue-gap' } },
      content: 'Olá! Tudo bem?',
    });
    ticketFindUniqueMock.mockResolvedValueOnce({
      id: 'ticket-fallback',
      status: 'OPEN',
      updatedAt: new Date('2024-03-22T10:00:00.000Z'),
    });

    await testing.processStandardInboundEvent(event, Date.now(), {
      passthroughMode: false,
      simpleMode: true,
      preloadedInstance: instanceRecord as unknown as Parameters<TestingHelpers['processStandardInboundEvent']>[2]['preloadedInstance'],
    });

    expect(queueUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId_name: expect.objectContaining({ tenantId: instanceRecord.tenantId }) }),
      })
    );
    expect(createTicketMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: instanceRecord.tenantId, queueId: 'queue-fallback' })
    );
    expect(sendMessageMock).toHaveBeenCalledWith(
      instanceRecord.tenantId,
      undefined,
      expect.objectContaining({ ticketId: 'ticket-fallback', content: 'Olá!' })
    );
    expect(emitToTenantMock).toHaveBeenCalledWith(
      instanceRecord.tenantId,
      'tickets.updated',
      expect.objectContaining({ ticketId: 'ticket-fallback' })
    );
  });
});
