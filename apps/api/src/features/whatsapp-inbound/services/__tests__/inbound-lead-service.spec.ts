import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { NotFoundError } from '@ticketz/core';
import { DEFAULT_QUEUE_CACHE_TTL_MS } from '../constants';
import {
  attemptAutoProvisionWhatsAppInstance,
  ensureInboundQueueForInboundMessage,
  getDefaultQueueId,
  queueCacheByTenant,
} from '../provisioning';
import { resolveTenantIdentifiersFromMetadata } from '../identifiers';
import type { InboundWhatsAppEnvelope, InboundWhatsAppEvent } from '../types';
import { logger } from '../../../../config/logger';

const prismaMock = vi.hoisted(() => {
  const mock = {
    queue: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    whatsAppInstance: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    tenant: {
      findFirst: vi.fn(),
    },
    campaign: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    contact: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    contactPhone: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    contactTag: {
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
    tag: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    lead: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    leadActivity: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    ticket: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  } satisfies Record<string, unknown>;

  return mock as typeof mock & { $transaction: ReturnType<typeof vi.fn> };
});

const applyDefaultPrismaTransactionMock = () => {
  prismaMock.$transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => unknown) =>
    callback(prismaMock as unknown as Prisma.TransactionClient)
  );
  prismaMock.tag.findMany.mockResolvedValue([]);
  prismaMock.tag.create.mockImplementation(async (args: { data?: { name?: string } }) => ({
    id: `tag-${args?.data?.name ?? 'generated'}`,
    name: args?.data?.name ?? 'generated',
  }));
  prismaMock.contact.findUniqueOrThrow.mockImplementation(async (args: { where?: { id?: string } }) => ({
    id: args?.where?.id ?? 'contact-generated',
    tenantId: 'tenant-generated',
    displayName: 'Contato WhatsApp',
    fullName: 'Contato WhatsApp',
    primaryPhone: '+5511000000000',
    tags: [],
    phones: [],
  }));
};

applyDefaultPrismaTransactionMock();

const createPrismaKnownRequestError = (code: string, message: string) =>
  Object.assign(new Error(message), { code, clientVersion: '5.0.0' }) as Prisma.PrismaClientKnownRequestError;

const findUniqueMock = prismaMock.queue.findUnique;
const findFirstMock = prismaMock.queue.findFirst;
const queueUpsertMock = prismaMock.queue.upsert;
const whatsappInstanceFindUniqueMock = prismaMock.whatsAppInstance.findUnique;
const whatsappInstanceCreateMock = prismaMock.whatsAppInstance.create;
const whatsappInstanceFindFirstMock = prismaMock.whatsAppInstance.findFirst;
const whatsappInstanceFindManyMock = prismaMock.whatsAppInstance.findMany;
const whatsappInstanceUpdateMock = prismaMock.whatsAppInstance.update;
const tenantFindFirstMock = prismaMock.tenant.findFirst;
const campaignFindManyMock = prismaMock.campaign.findMany;
const campaignUpsertMock = prismaMock.campaign.upsert;
const contactFindUniqueMock = prismaMock.contact.findUnique;
const contactFindFirstMock = prismaMock.contact.findFirst;
const contactFindUniqueOrThrowMock = prismaMock.contact.findUniqueOrThrow;
const contactUpdateMock = prismaMock.contact.update;
const contactCreateMock = prismaMock.contact.create;
const contactPhoneUpsertMock = prismaMock.contactPhone.upsert;
const contactPhoneUpdateManyMock = prismaMock.contactPhone.updateMany;
const contactTagDeleteManyMock = prismaMock.contactTag.deleteMany;
const contactTagUpsertMock = prismaMock.contactTag.upsert;
const tagFindManyMock = prismaMock.tag.findMany;
const tagCreateMock = prismaMock.tag.create;
const leadFindFirstMock = prismaMock.lead.findFirst;
const leadUpsertMock = prismaMock.lead.upsert;
const leadUpdateMock = prismaMock.lead.update;
const leadCreateMock = prismaMock.lead.create;
const leadActivityFindFirstMock = prismaMock.leadActivity.findFirst;
const leadActivityCreateMock = prismaMock.leadActivity.create;
const ticketFindUniqueMock = prismaMock.ticket.findUnique;

const allocateBrokerLeadsMock = vi.hoisted(() => vi.fn());
const listAllocationsMock = vi.hoisted(() => vi.fn());
const updateAllocationMock = vi.hoisted(() => vi.fn());
const createTicketMock = vi.hoisted(() => vi.fn());
const sendMessageMock = vi.hoisted(() => vi.fn());
const emitToTenantMock = vi.hoisted(() => vi.fn());
const emitToTicketMock = vi.hoisted(() => vi.fn());
const leadLastContactGaugeSetMock = vi.hoisted(() => vi.fn());
const downloadViaBaileysMock = vi.hoisted(() => vi.fn());
const downloadViaBrokerMock = vi.hoisted(() => vi.fn());
const saveWhatsAppMediaMock = vi.hoisted(() => vi.fn());
const enqueueInboundMediaJobMock = vi.hoisted(() => vi.fn());

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

vi.mock('../../../../services/ticket-service', () => ({
  createTicket: createTicketMock,
  sendMessage: sendMessageMock,
}));

vi.mock('../media-downloader', () => ({
  downloadViaBaileys: (...args: unknown[]) => downloadViaBaileysMock(...args),
  downloadViaBroker: (...args: unknown[]) => downloadViaBrokerMock(...args),
}));

vi.mock('../../../../services/whatsapp-media-service', () => ({
  saveWhatsAppMedia: (...args: unknown[]) => saveWhatsAppMediaMock(...args),
}));

vi.mock('../../../../lib/socket-registry', () => ({
  emitToTenant: emitToTenantMock,
  emitToTicket: emitToTicketMock,
  emitToAgreement: vi.fn(),
  getSocketServer: vi.fn(() => null),
}));

vi.mock('@ticketz/storage', () => ({
  allocateBrokerLeads: allocateBrokerLeadsMock,
  listAllocations: listAllocationsMock,
  updateAllocation: updateAllocationMock,
  enqueueInboundMediaJob: enqueueInboundMediaJobMock,
  $Enums: { MessageType: {} },
}));

const ensureTenantRecordMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../services/tenant-service', () => ({
  ensureTenantRecord: ensureTenantRecordMock,
}));

vi.mock('../../../../lib/metrics', () => ({
  inboundMessagesProcessedCounter: { inc: vi.fn() },
  leadLastContactGauge: { set: leadLastContactGaugeSetMock },
  whatsappInboundMetrics: { observeLatency: vi.fn() },
}));

type InboundModule = typeof import('../inbound-lead-service');
type TestingHelpers = InboundModule['__testing'];

let testing!: TestingHelpers;
let ingestInboundWhatsAppMessage!: InboundModule['ingestInboundWhatsAppMessage'];
type UpsertParams = Parameters<TestingHelpers['upsertLeadFromInbound']>[0];
type ProcessEventParams = Parameters<TestingHelpers['processStandardInboundEvent']>;
type InboundEvent = ProcessEventParams[0];

beforeAll(async () => {
  const module = await import('../inbound-lead-service');
  testing = module.__testing;
  ingestInboundWhatsAppMessage = module.ingestInboundWhatsAppMessage;
});

describe('getDefaultQueueId', () => {
  beforeEach(() => {
    queueCacheByTenant.clear();
    vi.resetAllMocks();
    queueUpsertMock.mockReset();
    applyDefaultPrismaTransactionMock();
  });

  it('returns cached queue id when entry is valid and queue exists', async () => {
    queueCacheByTenant.set('tenant-1', {
      id: 'queue-1',
      expires: Date.now() + DEFAULT_QUEUE_CACHE_TTL_MS,
    });

    findUniqueMock.mockResolvedValueOnce({ id: 'queue-1' });

    const queueId = await getDefaultQueueId('tenant-1');

    expect(queueId).toBe('queue-1');
    expect(findUniqueMock).toHaveBeenCalledTimes(1);
    expect(findFirstMock).not.toHaveBeenCalled();
    expect(queueUpsertMock).not.toHaveBeenCalled();
  });

  it('refetches queue when cached id is missing', async () => {
    queueCacheByTenant.set('tenant-2', {
      id: 'queue-old',
      expires: Date.now() + DEFAULT_QUEUE_CACHE_TTL_MS,
    });

    findUniqueMock.mockResolvedValueOnce(null);
    findFirstMock.mockResolvedValueOnce({ id: 'queue-new' });

    const queueId = await getDefaultQueueId('tenant-2');

    expect(queueId).toBe('queue-new');
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { id: 'queue-old' } });
    expect(findFirstMock).toHaveBeenCalledTimes(1);
    expect(queueCacheByTenant.get('tenant-2')).toMatchObject({ id: 'queue-new' });
    expect(queueUpsertMock).not.toHaveBeenCalled();
  });

  it('provisions fallback queue when none is found', async () => {
    findFirstMock.mockResolvedValueOnce(null);
    queueUpsertMock.mockResolvedValueOnce({ id: 'queue-fallback' });

    const queueId = await getDefaultQueueId('tenant-3');

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
    expect(queueCacheByTenant.get('tenant-3')).toMatchObject({ id: 'queue-fallback' });
  });
});

describe('ingestInboundWhatsAppMessage', () => {
  beforeEach(() => {
    queueCacheByTenant.clear();
    vi.clearAllMocks();
    applyDefaultPrismaTransactionMock();
  });

  it('ensures tenant creation and persists inbound message for unknown tenant', async () => {
    const ensuredTenant = { id: 'tenant-fresh', name: 'Tenant Fresh', slug: 'tenant-fresh' };
    const timestamp = new Date('2024-03-25T12:00:00.000Z');
    const envelope: InboundWhatsAppEnvelope = {
      origin: 'webhook',
      instanceId: 'wa-new',
      chatId: null,
      tenantId: null,
      message: {
        kind: 'message',
        id: 'msg-ensure',
        externalId: 'ext-ensure',
        brokerMessageId: 'broker-ensure',
        timestamp: timestamp.toISOString(),
        direction: 'INBOUND',
        contact: { phone: '+5511999999999', name: 'Cliente Webhook' },
        payload: {
          id: 'payload-ensure',
          type: 'text',
          text: 'Olá, LeadEngine!',
          key: { id: 'broker-ensure' },
          metadata: null,
        },
        metadata: {
          tenantId: ensuredTenant.id,
          requestId: 'req-ensure',
        },
      },
    };

    tenantFindFirstMock.mockResolvedValueOnce(null).mockResolvedValueOnce(ensuredTenant);
    ensureTenantRecordMock.mockResolvedValueOnce(ensuredTenant);
    whatsappInstanceFindFirstMock.mockResolvedValueOnce(null);
    const createdInstance = {
      id: 'wa-new',
      tenantId: ensuredTenant.id,
      name: 'Instance Webhook',
      brokerId: 'wa-new',
      status: 'connected',
      connected: true,
      phoneNumber: null,
      lastSeenAt: null,
      metadata: {},
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    whatsappInstanceCreateMock.mockResolvedValueOnce(createdInstance);
    campaignFindManyMock.mockResolvedValueOnce([]);
    campaignUpsertMock.mockResolvedValueOnce({
      id: 'campaign-fallback',
      tenantId: ensuredTenant.id,
      whatsappInstanceId: 'wa-new',
      status: 'active',
    });
    findFirstMock.mockResolvedValueOnce(null);
    queueUpsertMock.mockResolvedValueOnce({ id: 'queue-auto', tenantId: ensuredTenant.id });
    contactFindUniqueMock.mockResolvedValueOnce(null);
    contactFindFirstMock.mockResolvedValueOnce(null);
    contactCreateMock.mockResolvedValueOnce({
      id: 'contact-auto',
      tenantId: ensuredTenant.id,
      phone: '+5511999999999',
      name: 'Cliente Webhook',
      displayName: 'Cliente Webhook',
      fullName: 'Cliente Webhook',
      primaryPhone: '+5511999999999',
    });
    const leadRecord = {
      id: 'lead-auto',
      tenantId: ensuredTenant.id,
      contactId: 'contact-auto',
      status: 'NEW',
      source: 'WHATSAPP',
      lastContactAt: timestamp,
    };
    leadFindFirstMock.mockResolvedValueOnce(null);
    leadCreateMock.mockResolvedValueOnce(leadRecord);
    leadActivityFindFirstMock.mockResolvedValueOnce(null);
    leadActivityCreateMock.mockResolvedValueOnce({
      id: 'activity-auto',
      tenantId: ensuredTenant.id,
      leadId: leadRecord.id,
      type: 'WHATSAPP_REPLIED',
      occurredAt: timestamp,
    });
    createTicketMock.mockResolvedValueOnce({ id: 'ticket-auto' });
    ticketFindUniqueMock.mockResolvedValueOnce({
      id: 'ticket-auto',
      status: 'OPEN',
      updatedAt: timestamp,
    });
    sendMessageMock.mockResolvedValueOnce({
      id: 'timeline-auto',
      createdAt: timestamp,
      metadata: { eventMetadata: { requestId: 'req-ensure' } },
      content: 'Olá, LeadEngine!',
    });

    const persisted = await ingestInboundWhatsAppMessage(envelope);

    expect(persisted).toBe(true);
    expect(ensureTenantRecordMock).toHaveBeenCalledWith(
      ensuredTenant.id,
      expect.objectContaining({
        source: 'whatsapp-inbound-auto',
        action: 'ensure-tenant',
        instanceId: 'wa-new',
        requestId: 'req-ensure',
      })
    );
    expect(whatsappInstanceCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: ensuredTenant.id }),
      })
    );
    expect(queueUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ tenantId: ensuredTenant.id }),
      })
    );
    expect(createTicketMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: ensuredTenant.id, queueId: 'queue-auto' })
    );
    expect(sendMessageMock).toHaveBeenCalledWith(
      ensuredTenant.id,
      undefined,
      expect.objectContaining({ ticketId: 'ticket-auto', content: 'Olá, LeadEngine!' })
    );
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

    const result = resolveTenantIdentifiersFromMetadata(metadata);

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
      process.env.WHATSAPP_INBOUND_AUTOPROVISION_ENABLED = 'true';
      process.env.WHATSAPP_INBOUND_AUTOPROVISION_ALLOWLIST = 'tenant-autoprov';
      whatsappInstanceFindUniqueMock.mockReset();
      whatsappInstanceCreateMock.mockReset();
      whatsappInstanceFindFirstMock.mockReset();
      whatsappInstanceUpdateMock.mockReset();
      tenantFindFirstMock.mockReset();
      ensureTenantRecordMock.mockReset();
      whatsappInstanceFindFirstMock.mockResolvedValue(null);
    });

    afterEach(() => {
      delete process.env.WHATSAPP_INBOUND_AUTOPROVISION_ENABLED;
      delete process.env.WHATSAPP_INBOUND_AUTOPROVISION_ALLOWLIST;
    });

    it('returns null when tenant identifiers cannot be resolved', async () => {
      const result = await attemptAutoProvisionWhatsAppInstance({
        instanceId: 'wa-auto',
        metadata: { sessionId: 'session-1' },
        requestId: 'req-1',
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

      const result = await attemptAutoProvisionWhatsAppInstance({
        instanceId: 'wa-auto',
        metadata: baseMetadata,
        requestId: 'req-2',
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
      expect(result).toEqual(
        expect.objectContaining({
          instance: expect.objectContaining({ id: 'wa-auto', tenantId: tenantRecord.id }),
          wasCreated: true,
          brokerId: 'wa-auto',
        })
      );
    });

    it('returns null when tenant cannot be located instead of provisioning automatically', async () => {
      tenantFindFirstMock.mockResolvedValueOnce(null);

      const result = await attemptAutoProvisionWhatsAppInstance({
        instanceId: 'wa-auto',
        metadata: baseMetadata,
        requestId: 'req-ensure',
      });

      expect(result).toBeNull();
      expect(ensureTenantRecordMock).not.toHaveBeenCalled();
      expect(whatsappInstanceCreateMock).not.toHaveBeenCalled();
    });

    it('creates a WhatsApp instance with inbound-auto source', async () => {
      const tenantRecord = { id: 'tenant-autoprov', name: 'Tenant Demo', slug: 'tenant-autoprov' };
      const instanceRecord = {
        id: 'wa-auto',
        tenantId: tenantRecord.id,
        name: 'WhatsApp Principal',
        brokerId: 'wa-friendly',
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

      const metadataWithBroker = {
        ...baseMetadata,
        brokerId: 'wa-friendly',
      };

      const result = await attemptAutoProvisionWhatsAppInstance({
        instanceId: 'wa-auto',
        metadata: metadataWithBroker,
        requestId: 'req-2',
      });

      expect(whatsappInstanceCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              autopProvisionSource: 'inbound-auto',
              autopProvisionBrokerId: 'wa-friendly',
            }),
          }),
        })
      );
      expect(result).toEqual(
        expect.objectContaining({
          instance: expect.objectContaining({ brokerId: 'wa-friendly' }),
          wasCreated: true,
          brokerId: 'wa-friendly',
        })
      );
    });

    it('blocks autoprovision when tenant is not allowlisted', async () => {
      process.env.WHATSAPP_INBOUND_AUTOPROVISION_ALLOWLIST = 'another-tenant';
      const tenantRecord = { id: 'tenant-autoprov', name: 'Tenant Demo', slug: 'tenant-autoprov' };

      tenantFindFirstMock.mockResolvedValueOnce(tenantRecord);

      const result = await attemptAutoProvisionWhatsAppInstance({
        instanceId: 'wa-auto',
        metadata: baseMetadata,
        requestId: 'req-blocked',
      });

      expect(result).toBeNull();
      expect(whatsappInstanceCreateMock).not.toHaveBeenCalled();
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

      const result = await attemptAutoProvisionWhatsAppInstance({
        instanceId: 'wa-auto',
        metadata: metadataWithoutInstance,
        requestId: 'req-3',
      });

      expect(whatsappInstanceFindFirstMock).toHaveBeenCalledWith({
        where: { brokerId: 'session-1', tenantId: tenantRecord.id },
      });
      expect(whatsappInstanceCreateMock).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          instance: existingRecord,
          wasCreated: false,
          brokerId: 'session-1',
        })
      );
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

      const result = await attemptAutoProvisionWhatsAppInstance({
        instanceId: 'wa-auto',
        metadata: baseMetadata,
        requestId: 'req-3',
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
      expect(result).toEqual(
        expect.objectContaining({
          instance: existingRecord,
          wasCreated: false,
          brokerId: 'wa-auto',
        })
      );
    });
  });
});

describe('ensureInboundQueueForInboundMessage', () => {
  beforeEach(() => {
    queueCacheByTenant.clear();
    vi.resetAllMocks();
    applyDefaultPrismaTransactionMock();
  });

  it('ensures tenant automatically when foreign key errors occur', async () => {
    findFirstMock.mockResolvedValueOnce(null);
    const fkError = createPrismaKnownRequestError('P2003', 'Missing tenant');
    queueUpsertMock.mockRejectedValueOnce(fkError).mockResolvedValueOnce({
      id: 'queue-after-tenant',
      tenantId: 'tenant-missing',
    });
    ensureTenantRecordMock.mockResolvedValueOnce({ id: 'tenant-missing', slug: 'tenant-missing' });

    const result = await ensureInboundQueueForInboundMessage({
      tenantId: 'tenant-missing',
      requestId: 'req-tenant',
      instanceId: 'instance-tenant',
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
    const fkError = createPrismaKnownRequestError('P2003', 'Missing tenant');
    queueUpsertMock.mockRejectedValueOnce(fkError).mockRejectedValueOnce(fkError);
    ensureTenantRecordMock.mockResolvedValueOnce({ id: 'tenant-missing', slug: 'tenant-missing' });

    const result = await ensureInboundQueueForInboundMessage({
      tenantId: 'tenant-missing',
      requestId: 'req-tenant',
      instanceId: 'instance-tenant',
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
    expect(queueCacheByTenant.has('tenant-missing')).toBe(false);
  });

  it('retries queue provisioning using ensured tenant id when it differs from the requested id', async () => {
    findFirstMock.mockResolvedValueOnce(null);
    const fkError = createPrismaKnownRequestError('P2003', 'Missing tenant');
    queueUpsertMock
      .mockRejectedValueOnce(fkError)
      .mockResolvedValueOnce({ id: 'queue-actual', tenantId: 'tenant-actual' });
    ensureTenantRecordMock.mockResolvedValueOnce({ id: 'tenant-actual', slug: 'tenant-slug' });

    const result = await ensureInboundQueueForInboundMessage({
      tenantId: 'tenant-slug',
      requestId: 'req-tenant',
      instanceId: 'instance-tenant',
    });

    expect(result.queueId).toBe('queue-actual');
    expect(result.wasProvisioned).toBe(true);
    expect(queueUpsertMock).toHaveBeenCalledTimes(2);

    const secondCallArgs = queueUpsertMock.mock.calls[1]?.[0];
    expect(secondCallArgs?.create?.tenantId).toBe('tenant-actual');
    expect(secondCallArgs?.where?.tenantId_name?.tenantId).toBe('tenant-actual');

    expect(queueCacheByTenant.get('tenant-slug')).toMatchObject({ id: 'queue-actual' });
    expect(queueCacheByTenant.get('tenant-actual')).toMatchObject({ id: 'queue-actual' });

    expect(emitToTenantMock).toHaveBeenLastCalledWith(
      'tenant-actual',
      'whatsapp.queue.autoProvisioned',
      expect.objectContaining({
        tenantId: 'tenant-actual',
        requestedTenantId: 'tenant-slug',
        queueId: 'queue-actual',
        instanceId: 'instance-tenant',
      })
    );
  });
});

describe('ensureTicketForContact', () => {
  beforeEach(() => {
    queueCacheByTenant.clear();
    vi.resetAllMocks();
    applyDefaultPrismaTransactionMock();
  });

  it('provisions fallback queue for tenants without queues and continues ticket creation', async () => {
    findFirstMock.mockResolvedValueOnce(null);
    queueUpsertMock.mockResolvedValueOnce({ id: 'queue-auto', tenantId: 'tenant-queue-less' });

    const queueResolution = await ensureInboundQueueForInboundMessage({
      tenantId: 'tenant-queue-less',
      requestId: 'req-queue',
      instanceId: 'instance-queue',
    });

    expect(queueResolution.queueId).toBe('queue-auto');
    expect(queueResolution.wasProvisioned).toBe(true);
    expect(queueResolution.error).toBeUndefined();
    expect(queueCacheByTenant.get('tenant-queue-less')).toMatchObject({ id: 'queue-auto' });
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
    queueCacheByTenant.set('tenant-3', {
      id: 'queue-stale',
      expires: Date.now() + DEFAULT_QUEUE_CACHE_TTL_MS,
    });

    createTicketMock.mockRejectedValueOnce(new NotFoundError('Queue', 'queue-stale'));
    findFirstMock.mockResolvedValueOnce({ id: 'queue-fresh' });
    createTicketMock.mockResolvedValueOnce({ id: 'ticket-123' });

    const result = await testing.ensureTicketForContact('tenant-3', 'contact-1', 'queue-stale', 'Subject', {});

    expect(result).toBe('ticket-123');
    expect(queueCacheByTenant.get('tenant-3')).toMatchObject({ id: 'queue-fresh' });
    expect(createTicketMock).toHaveBeenCalledTimes(2);
    expect(createTicketMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ queueId: 'queue-fresh' })
    );
  });

  it('retries when foreign key error is present in error cause', async () => {
    queueCacheByTenant.set('tenant-4', {
      id: 'queue-deleted',
      expires: Date.now() + DEFAULT_QUEUE_CACHE_TTL_MS,
    });

    const prismaError = createPrismaKnownRequestError('P2003', 'Missing queue');
    const wrappedError = new Error('Failed to create ticket');
    (wrappedError as { cause?: unknown }).cause = prismaError;

    createTicketMock.mockRejectedValueOnce(wrappedError);
    findFirstMock.mockResolvedValueOnce({ id: 'queue-recreated' });
    createTicketMock.mockResolvedValueOnce({ id: 'ticket-456' });

    const result = await testing.ensureTicketForContact('tenant-4', 'contact-9', 'queue-deleted', 'Subject', {});

    expect(result).toBe('ticket-456');
    expect(queueCacheByTenant.get('tenant-4')).toMatchObject({ id: 'queue-recreated' });
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
    leadUpsertMock.mockImplementation(async (args) => {
      leadCreateMock(args as any);
      return leadRecord;
    });
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

    expect(leadUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_contactId: { tenantId: 'tenant-1', contactId: 'contact-1' } },
        create: expect.objectContaining({
          tenantId: 'tenant-1',
          contactId: 'contact-1',
          status: 'NEW',
          source: 'WHATSAPP',
          lastContactAt: baseMessage.createdAt,
        }),
        update: expect.objectContaining({ lastContactAt: baseMessage.createdAt }),
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
    leadUpsertMock.mockImplementation(async (args) => {
      leadUpdateMock(args as any);
      return leadRecord;
    });
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
    expect(leadUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_contactId: { tenantId: 'tenant-1', contactId: 'contact-1' } },
        update: expect.objectContaining({ lastContactAt: baseMessage.createdAt }),
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
    leadUpsertMock.mockImplementation(async (args) => {
      leadUpdateMock(args as any);
      return { ...existingLead, lastContactAt: message.createdAt };
    });
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

    expect(leadUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_contactId: { tenantId: 'tenant-1', contactId: 'contact-1' } },
        update: expect.objectContaining({ lastContactAt: message.createdAt }),
      })
    );
    expect(leadCreateMock).not.toHaveBeenCalled();
    expect(leadActivityCreateMock).toHaveBeenCalledTimes(1);
  });
});

describe('processStandardInboundEvent', () => {
  beforeEach(() => {
    queueCacheByTenant.clear();
    vi.resetAllMocks();
    ticketFindUniqueMock.mockReset();
    whatsappInstanceFindManyMock.mockReset();
    whatsappInstanceFindManyMock.mockResolvedValue([]);
    applyDefaultPrismaTransactionMock();
    prismaMock.$transaction = vi.fn(async (callback) =>
      callback({
        contact: {
          update: prismaMock.contact.update,
          create: prismaMock.contact.create,
          findUniqueOrThrow: prismaMock.contact.findUniqueOrThrow,
        },
        contactPhone: {
          upsert: prismaMock.contactPhone.upsert,
          updateMany: prismaMock.contactPhone.updateMany,
        },
        contactTag: {
          deleteMany: prismaMock.contactTag.deleteMany,
          upsert: prismaMock.contactTag.upsert,
        },
        tag: {
          findMany: prismaMock.tag.findMany,
          create: prismaMock.tag.create,
        },
      } as unknown as Prisma.TransactionClient)
    );
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
    campaignFindManyMock.mockResolvedValueOnce([]);
    campaignUpsertMock.mockResolvedValueOnce({
      id: 'campaign-fallback',
      tenantId: instanceRecord.tenantId,
      whatsappInstanceId: instanceRecord.id,
    });

    createTicketMock.mockResolvedValueOnce({ id: 'ticket-fallback' });
    contactFindUniqueMock.mockResolvedValueOnce(null);
    contactFindFirstMock.mockResolvedValueOnce(null);
    contactCreateMock.mockResolvedValueOnce({
      id: 'contact-fallback',
      tenantId: instanceRecord.tenantId,
      phone: '+5511999999999',
      name: 'Cliente WhatsApp',
      displayName: 'Cliente WhatsApp',
      fullName: 'Cliente WhatsApp',
      primaryPhone: '+5511999999999',
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
      'whatsapp.queue.autoProvisioned',
      expect.objectContaining({
        tenantId: instanceRecord.tenantId,
        instanceId: instanceRecord.id,
        queueId: 'queue-fallback',
      })
    );
  });

  it('enriches broker metadata with tenant hints before auto provisioning when webhook metadata lacks tenant fields', async () => {
    const now = new Date('2024-03-30T12:30:00.000Z');

    const event: InboundEvent = {
      id: 'event-auto-metadata',
      instanceId: null,
      tenantId: 'tenant-autop',
      direction: 'INBOUND',
      contact: { phone: '+5511999999999', name: 'Cliente Webhook' },
      message: { id: 'message-autop', text: 'Olá, LeadEngine!' },
      timestamp: now.toISOString(),
      metadata: {
        requestId: 'req-auto-metadata',
        brokerId: 'broker-auto',
        broker: { id: 'broker-auto' },
      },
      chatId: '5511999999999@s.whatsapp.net',
      externalId: 'ext-auto',
      sessionId: 'session-auto',
    } as unknown as InboundEvent;

    const provisioningModule = await import('../provisioning');
    const contactModule = await import('../inbound-lead/contact-service');
    const ticketModule = await import('../inbound-lead/ticket-service');
    const leadModule = await import('../inbound-lead/lead-service');
    const realtimeModule = await import('../inbound-lead/realtime-service');

    const capturedMetadata: Record<string, unknown>[] = [];

    const attemptSpy = vi.spyOn(provisioningModule, 'attemptAutoProvisionWhatsAppInstance');
    const ensureQueueSpy = vi.spyOn(provisioningModule, 'ensureInboundQueueForInboundMessage');
    const ensureContactSpy = vi.spyOn(contactModule, 'ensureContact');
    const ensureTicketSpy = vi.spyOn(ticketModule, 'ensureTicketForContact');
    const upsertLeadSpy = vi.spyOn(leadModule, 'upsertLeadFromInbound');
    const emitRealtimeSpy = vi.spyOn(realtimeModule, 'emitRealtimeUpdatesForInbound');

    const instanceRecord = {
      id: 'wa-autop',
      tenantId: 'tenant-autop',
      name: 'WhatsApp Autoprovisionado',
      brokerId: 'broker-auto',
      status: 'connected',
      connected: true,
      phoneNumber: null,
      lastSeenAt: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };

    attemptSpy.mockImplementation(async ({ metadata }) => {
      capturedMetadata.push(metadata);
      return { instance: instanceRecord, wasCreated: true, brokerId: 'broker-auto' };
    });

    ensureQueueSpy.mockResolvedValue({ queueId: 'queue-auto', wasProvisioned: false });
    ensureContactSpy.mockResolvedValue({
      id: 'contact-autop',
      tenantId: 'tenant-autop',
      displayName: 'Cliente Webhook',
      fullName: 'Cliente Webhook',
      primaryPhone: '+5511999999999',
      phones: [],
      tags: [],
    } as const);
    ensureTicketSpy.mockResolvedValue('ticket-autop');
    upsertLeadSpy.mockResolvedValue({ lead: { id: 'lead-autop' }, leadActivity: { id: 'activity-autop' } });
    emitRealtimeSpy.mockResolvedValue();

    whatsappInstanceFindUniqueMock.mockResolvedValue(null);
    whatsappInstanceFindFirstMock.mockResolvedValue(null);
    campaignFindManyMock.mockResolvedValueOnce([
      {
        id: 'campaign-autop',
        tenantId: 'tenant-autop',
        whatsappInstanceId: 'wa-autop',
        status: 'active',
        name: 'Campanha Principal',
        agreementId: null,
      },
    ]);

    sendMessageMock.mockResolvedValueOnce({
      id: 'timeline-autop',
      direction: 'INBOUND',
      createdAt: now,
      metadata: { eventMetadata: { requestId: 'req-auto-metadata' } },
      content: 'Olá, LeadEngine!',
    });

    try {
      const result = await testing.processStandardInboundEvent(event, now.getTime(), {
        preloadedInstance: null,
      });

      expect(result).toBe(true);
      expect(attemptSpy).toHaveBeenCalledWith(
        expect.objectContaining({ instanceId: 'broker-auto', requestId: 'req-auto-metadata' })
      );
      expect(capturedMetadata).toHaveLength(1);
      expect(capturedMetadata[0]).toMatchObject({
        tenantId: 'tenant-autop',
        tenant: expect.objectContaining({ id: 'tenant-autop', tenantId: 'tenant-autop' }),
        broker: expect.objectContaining({
          id: 'broker-auto',
          instanceId: 'broker-auto',
          tenantId: 'tenant-autop',
          tenant: expect.objectContaining({ id: 'tenant-autop', tenantId: 'tenant-autop' }),
        }),
      });
    } finally {
      attemptSpy.mockRestore();
      ensureQueueSpy.mockRestore();
      ensureContactSpy.mockRestore();
      ensureTicketSpy.mockRestore();
      upsertLeadSpy.mockRestore();
      emitRealtimeSpy.mockRestore();
    }
  });

  it('selects the most recent active tenant instance deterministically and alerts on multiple active candidates', async () => {
    const now = new Date('2024-04-02T10:00:00.000Z');
    const tenantId = 'tenant-deterministic';

    const event: InboundEvent = {
      id: 'event-deterministic',
      instanceId: null,
      tenantId,
      direction: 'INBOUND',
      contact: { phone: '+5511888888888', name: 'Cliente Determinístico' },
      message: { id: 'message-deterministic', text: 'Olá, LeadEngine!' },
      timestamp: now.toISOString(),
      metadata: { requestId: 'req-deterministic' },
      chatId: '5511888888888@s.whatsapp.net',
      externalId: null,
      sessionId: null,
    } as unknown as InboundEvent;

    const provisioningModule = await import('../provisioning');
    const contactModule = await import('../inbound-lead/contact-service');
    const ticketModule = await import('../inbound-lead/ticket-service');
    const leadModule = await import('../inbound-lead/lead-service');
    const realtimeModule = await import('../inbound-lead/realtime-service');

    const ensureQueueSpy = vi.spyOn(provisioningModule, 'ensureInboundQueueForInboundMessage');
    const ensureContactSpy = vi.spyOn(contactModule, 'ensureContact');
    const ensureTicketSpy = vi.spyOn(ticketModule, 'ensureTicketForContact');
    const upsertLeadSpy = vi.spyOn(leadModule, 'upsertLeadFromInbound');
    const emitRealtimeSpy = vi.spyOn(realtimeModule, 'emitRealtimeUpdatesForInbound');

    const instances = [
      {
        id: 'wa-old-active',
        tenantId,
        name: 'WhatsApp Antigo',
        brokerId: 'broker-old',
        status: 'connected',
        connected: true,
        phoneNumber: null,
        lastSeenAt: new Date('2024-03-31T10:00:00.000Z'),
        createdAt: new Date('2024-02-01T10:00:00.000Z'),
        updatedAt: new Date('2024-03-31T10:00:00.000Z'),
      },
      {
        id: 'wa-new-active',
        tenantId,
        name: 'WhatsApp Mais Recente',
        brokerId: 'broker-new',
        status: 'connected',
        connected: true,
        phoneNumber: null,
        lastSeenAt: new Date('2024-04-02T09:30:00.000Z'),
        createdAt: new Date('2024-03-15T12:00:00.000Z'),
        updatedAt: new Date('2024-04-02T09:30:00.000Z'),
      },
      {
        id: 'wa-pending',
        tenantId,
        name: 'WhatsApp Pendente',
        brokerId: 'broker-pending',
        status: 'pending',
        connected: false,
        phoneNumber: null,
        lastSeenAt: null,
        createdAt: new Date('2024-03-20T08:00:00.000Z'),
        updatedAt: new Date('2024-03-20T08:00:00.000Z'),
      },
    ];

    whatsappInstanceFindUniqueMock.mockResolvedValue(null);
    whatsappInstanceFindFirstMock.mockResolvedValue(null);
    whatsappInstanceFindManyMock.mockResolvedValueOnce(instances as any);

    campaignFindManyMock.mockResolvedValueOnce([
      {
        id: 'campaign-deterministic',
        tenantId,
        whatsappInstanceId: 'wa-new-active',
        status: 'active',
        name: 'Campanha Determinística',
        agreementId: null,
      },
    ]);

    ensureQueueSpy.mockResolvedValue({ queueId: 'queue-deterministic', wasProvisioned: false });
    ensureContactSpy.mockResolvedValue({
      id: 'contact-deterministic',
      tenantId,
      displayName: 'Cliente Determinístico',
      fullName: 'Cliente Determinístico',
      primaryPhone: '+5511888888888',
      phones: [],
      tags: [],
    } as const);
    ensureTicketSpy.mockResolvedValue('ticket-deterministic');
    upsertLeadSpy.mockResolvedValue({ lead: { id: 'lead-deterministic' }, leadActivity: { id: 'activity-deterministic' } });
    emitRealtimeSpy.mockResolvedValue();

    sendMessageMock.mockResolvedValueOnce({
      id: 'timeline-deterministic',
      createdAt: now,
      metadata: { eventMetadata: { requestId: 'req-deterministic' } },
      content: 'Olá, LeadEngine!',
    });

    try {
      const result = await testing.processStandardInboundEvent(event, now.getTime(), {
        preloadedInstance: null,
      });

      expect(result).toBe(true);
      expect(whatsappInstanceFindManyMock).toHaveBeenCalledWith({ where: { tenantId } });
      expect(ensureQueueSpy).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId, instanceId: 'wa-new-active' })
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Múltiplas instâncias ativas'),
        expect.objectContaining({
          tenantId,
          instanceIds: expect.arrayContaining(['wa-old-active', 'wa-new-active']),
        })
      );
    } finally {
      ensureQueueSpy.mockRestore();
      ensureContactSpy.mockRestore();
      ensureTicketSpy.mockRestore();
      upsertLeadSpy.mockRestore();
      emitRealtimeSpy.mockRestore();
    }
  });

  it('falls back deterministically to the most recently updated instance when tenant has no active records', async () => {
    const now = new Date('2024-04-03T08:00:00.000Z');
    const tenantId = 'tenant-inactive';

    const event: InboundEvent = {
      id: 'event-inactive',
      instanceId: null,
      tenantId,
      direction: 'INBOUND',
      contact: { phone: '+5511777777777', name: 'Cliente Inativo' },
      message: { id: 'message-inactive', text: 'Mensagem inativa' },
      timestamp: now.toISOString(),
      metadata: { requestId: 'req-inactive' },
      chatId: '5511777777777@s.whatsapp.net',
      externalId: null,
      sessionId: null,
    } as unknown as InboundEvent;

    const provisioningModule = await import('../provisioning');
    const contactModule = await import('../inbound-lead/contact-service');
    const ticketModule = await import('../inbound-lead/ticket-service');
    const leadModule = await import('../inbound-lead/lead-service');
    const realtimeModule = await import('../inbound-lead/realtime-service');

    const ensureQueueSpy = vi.spyOn(provisioningModule, 'ensureInboundQueueForInboundMessage');
    const ensureContactSpy = vi.spyOn(contactModule, 'ensureContact');
    const ensureTicketSpy = vi.spyOn(ticketModule, 'ensureTicketForContact');
    const upsertLeadSpy = vi.spyOn(leadModule, 'upsertLeadFromInbound');
    const emitRealtimeSpy = vi.spyOn(realtimeModule, 'emitRealtimeUpdatesForInbound');

    const instances = [
      {
        id: 'wa-stale',
        tenantId,
        name: 'WhatsApp Antigo',
        brokerId: 'broker-stale',
        status: 'error',
        connected: false,
        phoneNumber: null,
        lastSeenAt: new Date('2024-03-30T08:00:00.000Z'),
        createdAt: new Date('2024-03-01T08:00:00.000Z'),
        updatedAt: new Date('2024-03-30T08:00:00.000Z'),
      },
      {
        id: 'wa-fresher',
        tenantId,
        name: 'WhatsApp Mais Atualizado',
        brokerId: 'broker-fresher',
        status: 'pending',
        connected: false,
        phoneNumber: null,
        lastSeenAt: null,
        createdAt: new Date('2024-03-10T09:00:00.000Z'),
        updatedAt: new Date('2024-04-02T09:00:00.000Z'),
      },
    ];

    whatsappInstanceFindUniqueMock.mockResolvedValue(null);
    whatsappInstanceFindFirstMock.mockResolvedValue(null);
    whatsappInstanceFindManyMock.mockResolvedValueOnce(instances as any);

    campaignFindManyMock.mockResolvedValueOnce([
      {
        id: 'campaign-inactive',
        tenantId,
        whatsappInstanceId: 'wa-fresher',
        status: 'active',
        name: 'Campanha Inativa',
        agreementId: null,
      },
    ]);

    ensureQueueSpy.mockResolvedValue({ queueId: 'queue-inactive', wasProvisioned: false });
    ensureContactSpy.mockResolvedValue({
      id: 'contact-inactive',
      tenantId,
      displayName: 'Cliente Inativo',
      fullName: 'Cliente Inativo',
      primaryPhone: '+5511777777777',
      phones: [],
      tags: [],
    } as const);
    ensureTicketSpy.mockResolvedValue('ticket-inactive');
    upsertLeadSpy.mockResolvedValue({ lead: { id: 'lead-inactive' }, leadActivity: { id: 'activity-inactive' } });
    emitRealtimeSpy.mockResolvedValue();

    sendMessageMock.mockResolvedValueOnce({
      id: 'timeline-inactive',
      createdAt: now,
      metadata: { eventMetadata: { requestId: 'req-inactive' } },
      content: 'Mensagem inativa',
    });

    try {
      const result = await testing.processStandardInboundEvent(event, now.getTime(), {
        preloadedInstance: null,
      });

      expect(result).toBe(true);
      expect(whatsappInstanceFindManyMock).toHaveBeenCalledWith({ where: { tenantId } });
      expect(ensureQueueSpy).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId, instanceId: 'wa-fresher' })
      );
      expect(logger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Múltiplas instâncias ativas'),
        expect.anything()
      );
    } finally {
      ensureQueueSpy.mockRestore();
      ensureContactSpy.mockRestore();
      ensureTicketSpy.mockRestore();
      upsertLeadSpy.mockRestore();
      emitRealtimeSpy.mockRestore();
    }
  });

  it.each([
    {
      kind: 'IMAGE' as const,
      rawKey: 'imageMessage',
      caption: 'Imagem legal',
      mimetype: 'image/jpeg',
      extension: 'jpg',
      fileLength: 2048,
    },
    {
      kind: 'VIDEO' as const,
      rawKey: 'videoMessage',
      caption: 'Vídeo incrível',
      mimetype: 'video/mp4',
      extension: 'mp4',
      fileLength: 8192,
    },
    {
      kind: 'AUDIO' as const,
      rawKey: 'audioMessage',
      caption: null,
      mimetype: 'audio/ogg',
      extension: 'ogg',
      fileLength: 1024,
    },
  ])('downloads inbound %s media and stores a local URL', async ({ kind, rawKey, caption, mimetype, extension, fileLength }) => {
    const now = new Date('2024-03-25T09:00:00.000Z');
    const instanceRecord = {
      id: 'instance-1',
      tenantId: 'tenant-1',
      brokerId: 'broker-1',
      name: 'WhatsApp Principal',
    } as const;

    findFirstMock.mockResolvedValueOnce({ id: 'queue-media', tenantId: 'tenant-1' });
    campaignFindManyMock.mockResolvedValueOnce([{ id: 'campaign-1' }]);
    createTicketMock.mockResolvedValueOnce({ id: 'ticket-media' });
    ticketFindUniqueMock.mockResolvedValueOnce({ id: 'ticket-media', status: 'OPEN', updatedAt: now });

    contactFindUniqueMock.mockResolvedValueOnce(null);
    contactFindFirstMock.mockResolvedValueOnce(null);
    contactCreateMock.mockResolvedValueOnce({
      id: 'contact-media',
      tenantId: 'tenant-1',
      phone: '+5511999999999',
      name: 'Cliente Mídia',
    });
    contactFindUniqueOrThrowMock.mockResolvedValueOnce({
      id: 'contact-media',
      tenantId: 'tenant-1',
      displayName: 'Cliente Mídia',
      fullName: 'Cliente Mídia',
      primaryPhone: '+5511999999999',
      phones: [],
      tags: [],
    });
    contactPhoneUpsertMock.mockResolvedValueOnce({ id: 'phone-1' });
    contactPhoneUpdateManyMock.mockResolvedValueOnce({ count: 0 });
    tagFindManyMock.mockResolvedValueOnce([]);
    tagCreateMock.mockImplementation(async ({ data }) => ({ id: `${String(data?.name)}-id`, name: String(data?.name) }));
    contactTagDeleteManyMock.mockResolvedValueOnce({ count: 0 });
    contactTagUpsertMock.mockResolvedValue({});

    downloadViaBaileysMock.mockResolvedValueOnce(null);
    downloadViaBrokerMock.mockResolvedValueOnce({
      buffer: Buffer.from(`media-${kind.toLowerCase()}`),
      mimeType: mimetype,
      fileName: `${kind.toLowerCase()}-broker.${extension}`,
      size: 111,
    });
    saveWhatsAppMediaMock.mockResolvedValueOnce({
      mediaUrl: `https://cdn.example.com/${kind.toLowerCase()}-stored.${extension}?X-Amz-Signature=test`,
      expiresInSeconds: 600,
    });

    sendMessageMock.mockResolvedValueOnce({
      id: 'timeline-media',
      createdAt: now,
      metadata: { eventMetadata: { requestId: 'req-media' } },
      content: 'Mensagem com mídia',
    });

    const messagePayload: Record<string, unknown> = {
      id: `wamid-${kind.toLowerCase()}`,
      type: kind.toLowerCase(),
      text: 'Mensagem com mídia',
      metadata: {
        directPath: `/direct/${kind.toLowerCase()}`,
        mediaKey: `${kind.toLowerCase()}-key`,
      },
    };
    messagePayload[rawKey] = {
      mimetype,
      fileLength,
      fileName: `${kind.toLowerCase()}-file.${extension}`,
      mediaKey: `${kind.toLowerCase()}-key`,
      directPath: `/direct/${kind.toLowerCase()}`,
      ...(caption ? { caption } : {}),
    };

    const event: InboundEvent = {
      id: `event-${kind.toLowerCase()}`,
      instanceId: 'instance-1',
      tenantId: 'tenant-1',
      direction: 'INBOUND',
      contact: { phone: '+5511999999999', name: 'Cliente Mídia' },
      message: messagePayload as InboundEvent['message'],
      timestamp: now.toISOString(),
      metadata: {
        requestId: 'req-media',
        brokerId: 'broker-1',
        broker: { id: 'broker-1', messageId: `wamid-${kind.toLowerCase()}` },
      },
      chatId: '5511999999999@s.whatsapp.net',
      externalId: `ext-${kind.toLowerCase()}`,
      sessionId: 'session-1',
    } as unknown as InboundEvent;

    await testing.processStandardInboundEvent(event, now.getTime(), {
      preloadedInstance: instanceRecord as unknown as Parameters<TestingHelpers['processStandardInboundEvent']>[2]['preloadedInstance'],
    });

    expect(downloadViaBaileysMock).toHaveBeenCalledTimes(1);
    expect(downloadViaBrokerMock).toHaveBeenCalledTimes(1);
    expect(downloadViaBrokerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        brokerId: 'broker-1',
        instanceId: 'instance-1',
        tenantId: 'tenant-1',
        mediaType: kind,
        directPath: `/direct/${kind.toLowerCase()}`,
        mediaKey: `${kind.toLowerCase()}-key`,
        messageId: `ext-${kind.toLowerCase()}`,
      })
    );

    expect(saveWhatsAppMediaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        originalName: `${kind.toLowerCase()}-file.${extension}`,
        mimeType: mimetype,
      })
    );

    const [, , payload] = sendMessageMock.mock.calls[0];
    expect(payload.mediaUrl).toBe(
      `https://cdn.example.com/${kind.toLowerCase()}-stored.${extension}?X-Amz-Signature=test`
    );
    const mediaMetadata = payload.metadata?.media as Record<string, unknown> | undefined;
    expect(mediaMetadata).toMatchObject({
      url: `https://cdn.example.com/${kind.toLowerCase()}-stored.${extension}?X-Amz-Signature=test`,
      mimetype,
      size: fileLength,
      urlExpiresInSeconds: 600,
    });
    if (caption) {
      expect(mediaMetadata).toMatchObject({ caption });
    }
    expect(payload.metadata?.media_pending).toBeUndefined();
    expect(enqueueInboundMediaJobMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      scenario: 'null',
      downloadResult: null,
    },
    {
      scenario: 'an empty buffer',
      downloadResult: {
        buffer: Buffer.alloc(0),
        mimeType: 'image/jpeg',
        fileName: 'image-empty.jpg',
        size: 0,
      },
    },
  ])(
    'does not persist directPath references when media download returns $scenario payload',
    async ({ downloadResult, scenario }) => {
      const now = new Date('2024-03-26T10:30:00.000Z');
      const instanceRecord = {
        id: 'instance-direct-path',
        tenantId: 'tenant-direct-path',
        brokerId: 'broker-direct-path',
        name: 'WhatsApp Direct Path',
      } as const;

      const messageExternalId = `ext-direct-path-${scenario.replace(/\s+/g, '-')}`;

      findFirstMock.mockResolvedValueOnce({ id: 'queue-direct-path', tenantId: 'tenant-direct-path' });
      campaignFindManyMock.mockResolvedValueOnce([{ id: 'campaign-direct-path' }]);
      createTicketMock.mockResolvedValueOnce({ id: 'ticket-direct-path' });
      ticketFindUniqueMock.mockResolvedValueOnce({ id: 'ticket-direct-path', status: 'OPEN', updatedAt: now });

      contactFindUniqueMock.mockResolvedValueOnce(null);
      contactFindFirstMock.mockResolvedValueOnce(null);
      contactCreateMock.mockResolvedValueOnce({
        id: 'contact-direct-path',
        tenantId: 'tenant-direct-path',
        phone: '+5511888888888',
        name: 'Cliente Direto',
      });
      contactFindUniqueOrThrowMock.mockResolvedValueOnce({
        id: 'contact-direct-path',
        tenantId: 'tenant-direct-path',
        displayName: 'Cliente Direto',
        fullName: 'Cliente Direto',
        primaryPhone: '+5511888888888',
        phones: [],
        tags: [],
      });
      contactPhoneUpsertMock.mockResolvedValueOnce({ id: 'phone-direct-path' });
      contactPhoneUpdateManyMock.mockResolvedValueOnce({ count: 0 });
      tagFindManyMock.mockResolvedValueOnce([]);
      tagCreateMock.mockImplementation(async ({ data }) => ({ id: `${String(data?.name)}-id`, name: String(data?.name) }));
      contactTagDeleteManyMock.mockResolvedValueOnce({ count: 0 });
      contactTagUpsertMock.mockResolvedValue({});

      downloadViaBaileysMock.mockResolvedValueOnce(null);
      downloadViaBrokerMock.mockResolvedValueOnce(downloadResult as unknown as Awaited<
        ReturnType<typeof downloadViaBrokerMock>
      >);

      sendMessageMock.mockResolvedValueOnce({
        id: 'timeline-direct-path',
        createdAt: now,
        metadata: { eventMetadata: { requestId: 'req-direct-path' } },
        content: 'Mensagem direta',
      });

      const event: InboundEvent = {
        id: 'event-direct-path',
        instanceId: instanceRecord.id,
        tenantId: instanceRecord.tenantId,
        direction: 'INBOUND',
        contact: { phone: '+5511888888888', name: 'Cliente Direto' },
        message: {
          id: 'wamid-direct-path',
          type: 'image',
          metadata: {
            directPath: '/direct/image',
            mediaKey: 'image-key',
          },
          imageMessage: {
            directPath: '/direct/image',
            mediaKey: 'image-key',
            mimetype: 'image/jpeg',
            fileName: 'image-original.jpg',
          },
        },
        timestamp: now.toISOString(),
        metadata: {
          requestId: 'req-direct-path',
          brokerId: instanceRecord.brokerId,
          broker: { id: instanceRecord.brokerId, messageId: messageExternalId },
        },
        chatId: '5511888888888@s.whatsapp.net',
        externalId: messageExternalId,
        sessionId: 'session-direct-path',
      } as unknown as InboundEvent;

      await testing.processStandardInboundEvent(event, now.getTime(), {
        preloadedInstance: instanceRecord as unknown as Parameters<
          TestingHelpers['processStandardInboundEvent']
        >[2]['preloadedInstance'],
      });

      expect(saveWhatsAppMediaMock).not.toHaveBeenCalled();

      expect(sendMessageMock).toHaveBeenCalled();
      const [, , payload] = sendMessageMock.mock.calls[0];
      expect(payload.mediaUrl).toBeUndefined();
      expect(payload.metadata?.media).toBeUndefined();
      expect(payload.metadata?.media_pending).toBe(true);

      expect(enqueueInboundMediaJobMock).toHaveBeenCalledTimes(1);
      expect(enqueueInboundMediaJobMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: instanceRecord.tenantId,
          mediaType: 'IMAGE',
          mediaKey: 'image-key',
          directPath: '/direct/image',
          metadata: expect.objectContaining({
            fileName: 'image-original.jpg',
            mimeType: 'image/jpeg',
          }),
        })
      );
    }
  );
});
