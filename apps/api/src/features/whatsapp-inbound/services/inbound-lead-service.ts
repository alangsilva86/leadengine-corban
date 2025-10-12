import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError } from '@ticketz/core';
import { Prisma } from '@prisma/client';

import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';
import { addAllocations } from '../../../data/lead-allocation-store';
import { maskDocument, maskPhone } from '../../../lib/pii';
import {
  inboundMessagesProcessedCounter,
  leadLastContactGauge,
} from '../../../lib/metrics';
import { createTicket as createTicketService, sendMessage as sendMessageService } from '../../../services/ticket-service';
import { emitToAgreement, emitToTenant, emitToTicket } from '../../../lib/socket-registry';
import { normalizeInboundMessage } from '../utils/normalize';
import { isWhatsappInboundSimpleModeEnabled } from '../../../config/feature-flags';

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_DEDUPE_CACHE_SIZE = 10_000;

const dedupeCache = new Map<string, number>();

const DEFAULT_QUEUE_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_QUEUE_FALLBACK_NAME = 'Atendimento Geral';
const DEFAULT_QUEUE_FALLBACK_DESCRIPTION =
  'Fila criada automaticamente para mensagens inbound do WhatsApp.';

type QueueCacheEntry = {
  id: string;
  expires: number;
};

const queueCacheByTenant = new Map<string, QueueCacheEntry>();

export const resetInboundLeadServiceTestState = (): void => {
  dedupeCache.clear();
  queueCacheByTenant.clear();
};

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readNestedString = (source: Record<string, unknown>, path: string[]): string | null => {
  let current: unknown = source;

  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return readString(current);
};

const pushUnique = (collection: string[], candidate: string | null): void => {
  if (!candidate) {
    return;
  }

  if (!collection.includes(candidate)) {
    collection.push(candidate);
  }
};

const resolveTenantIdentifiersFromMetadata = (metadata: Record<string, unknown>): string[] => {
  const identifiers: string[] = [];

  const directKeys = ['tenantId', 'tenant_id', 'tenantSlug', 'tenant'];
  directKeys.forEach((key) => pushUnique(identifiers, readString(metadata[key])));

  const nestedPaths: string[][] = [
    ['tenant', 'id'],
    ['tenant', 'tenantId'],
    ['tenant', 'slug'],
    ['tenant', 'code'],
    ['tenant', 'slugId'],
    ['context', 'tenantId'],
    ['context', 'tenant', 'id'],
    ['context', 'tenant', 'slug'],
    ['context', 'tenant', 'tenantId'],
    ['context', 'tenantSlug'],
    ['broker', 'tenantId'],
    ['integration', 'tenantId'],
    ['integration', 'tenant', 'id'],
    ['integration', 'tenant', 'slug'],
    ['integration', 'tenant', 'tenantId'],
    ['session', 'tenantId'],
  ];

  nestedPaths.forEach((path) => pushUnique(identifiers, readNestedString(metadata, path)));

  return identifiers;
};

const resolveSessionIdFromMetadata = (metadata: Record<string, unknown>): string | null => {
  const candidates: Array<string | null> = [
    readString(metadata['sessionId']),
    readString(metadata['session_id']),
    readNestedString(metadata, ['session', 'id']),
    readNestedString(metadata, ['session', 'sessionId']),
    readNestedString(metadata, ['connection', 'sessionId']),
    readNestedString(metadata, ['broker', 'sessionId']),
  ];

  return candidates.find((candidate) => Boolean(candidate)) ?? null;
};

const resolveBrokerIdFromMetadata = (metadata: Record<string, unknown>): string | null => {
  const candidates: Array<string | null> = [
    readString(metadata['brokerId']),
    readString(metadata['broker_id']),
    readNestedString(metadata, ['broker', 'id']),
    readNestedString(metadata, ['broker', 'sessionId']),
    resolveSessionIdFromMetadata(metadata),
  ];

  return candidates.find((candidate) => Boolean(candidate)) ?? null;
};

const resolveInstanceDisplayNameFromMetadata = (
  metadata: Record<string, unknown>,
  tenantName: string | null | undefined,
  instanceId: string
): string => {
  const candidates: Array<string | null> = [
    readString(metadata['instanceName']),
    readString(metadata['instanceFriendlyName']),
    readString(metadata['instanceDisplayName']),
    readNestedString(metadata, ['instance', 'name']),
    readNestedString(metadata, ['instance', 'displayName']),
    readNestedString(metadata, ['instance', 'friendlyName']),
    readNestedString(metadata, ['connection', 'name']),
    readNestedString(metadata, ['session', 'name']),
    readString(metadata['connectionName']),
    tenantName ? `WhatsApp • ${tenantName}` : null,
    `WhatsApp • ${instanceId}`,
  ];

  return candidates.find((candidate) => Boolean(candidate)) ?? `WhatsApp • ${instanceId}`;
};

type WhatsAppInstanceRecord = Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>;

const attemptAutoProvisionWhatsAppInstance = async ({
  instanceId,
  metadata,
  requestId,
  simpleMode,
}: {
  instanceId: string;
  metadata: Record<string, unknown>;
  requestId: string | null;
  simpleMode: boolean;
}): Promise<WhatsAppInstanceRecord | null> => {
  if (!simpleMode) {
    return null;
  }

  const tenantIdentifiers = resolveTenantIdentifiersFromMetadata(metadata);

  if (tenantIdentifiers.length === 0) {
    logger.warn('🎯 LeadEngine • WhatsApp :: 🔍 Instância inbound sem tenant identificável', {
      instanceId,
      requestId,
    });
    return null;
  }

  const tenant = await prisma.tenant.findFirst({
    where: {
      OR: tenantIdentifiers.flatMap((identifier) => [
        { id: identifier },
        { slug: identifier },
      ]),
    },
  });

  if (!tenant) {
    logger.warn('🎯 LeadEngine • WhatsApp :: 🔍 Tenant não localizado para autoprov de instância', {
      instanceId,
      requestId,
      tenantIdentifiers,
    });
    return null;
  }

  const brokerId = resolveBrokerIdFromMetadata(metadata) ?? instanceId;
  const sessionId = resolveSessionIdFromMetadata(metadata);
  const displayName = resolveInstanceDisplayNameFromMetadata(metadata, tenant.name, instanceId);

  try {
    const created = await prisma.whatsAppInstance.create({
      data: {
        id: instanceId,
        tenantId: tenant.id,
        name: displayName,
        brokerId,
        status: 'connected',
        connected: true,
        metadata: {
          autopProvisionedAt: new Date().toISOString(),
          autopProvisionSource: 'inbound-simple-mode',
          autopProvisionRequestId: requestId ?? null,
          autopProvisionTenantIdentifiers: tenantIdentifiers,
          autopProvisionSessionId: sessionId ?? null,
          autopProvisionBrokerId: brokerId,
        },
      },
    });

    logger.info('🎯 LeadEngine • WhatsApp :: 🆕 Instância provisionada automaticamente', {
      instanceId,
      tenantId: tenant.id,
      brokerId,
      requestId,
    });

    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await prisma.whatsAppInstance.findFirst({ where: { brokerId } });
      if (existing) {
        logger.warn('🎯 LeadEngine • WhatsApp :: 🔁 Reutilizando instância existente após colisão de broker', {
          instanceId,
          tenantId: existing.tenantId,
          brokerId,
          requestId,
        });
        return existing;
      }
    }

    logger.error('🎯 LeadEngine • WhatsApp :: ❌ Falha ao autoprov instância', {
      error: mapErrorForLog(error),
      instanceId,
      tenantId: tenant.id,
      brokerId,
      requestId,
    });
    return null;
  }
};

const pruneDedupeCache = (now: number): void => {
  if (dedupeCache.size === 0) {
    return;
  }

  let removedExpiredEntries = 0;

  for (const [key, storedAt] of dedupeCache.entries()) {
    if (now - storedAt >= DEDUPE_WINDOW_MS) {
      dedupeCache.delete(key);
      removedExpiredEntries += 1;
    }
  }

  if (dedupeCache.size > MAX_DEDUPE_CACHE_SIZE) {
    const sizeBefore = dedupeCache.size;
    dedupeCache.clear();
    logger.warn('whatsappInbound.dedupeCache.massivePurge', {
      maxSize: MAX_DEDUPE_CACHE_SIZE,
      removedExpiredEntries,
      sizeBefore,
    });
  }
};

interface InboundContactDetails {
  phone?: string | null;
  name?: string | null;
  document?: string | null;
  registrations?: string[] | null;
  avatarUrl?: string | null;
  pushName?: string | null;
}

interface InboundMessageDetails {
  id?: string | null;
  type?: string | null;
  text?: unknown;
  metadata?: Record<string, unknown> | null;
  conversation?: unknown;
  extendedTextMessage?: unknown;
  imageMessage?: unknown;
  videoMessage?: unknown;
  audioMessage?: unknown;
  documentMessage?: unknown;
  contactsArrayMessage?: unknown;
  locationMessage?: unknown;
  templateButtonReplyMessage?: unknown;
  buttonsResponseMessage?: unknown;
  stickerMessage?: unknown;
  key?: {
    id?: string | null;
    remoteJid?: string | null;
  } | null;
  messageTimestamp?: number | null;
}

export interface InboundWhatsAppEvent {
  id: string;
  instanceId: string;
  timestamp: string | null;
  contact: InboundContactDetails;
  message: InboundMessageDetails;
  metadata?: Record<string, unknown> | null;
}

const sanitizePhone = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10) {
    return undefined;
  }
  return `+${digits.replace(/^\+/, '')}`;
};

const sanitizeDocument = (value?: string | null, fallback?: string): string => {
  const candidate = (value ?? '').replace(/\D/g, '');
  if (candidate.length >= 4) {
    return candidate;
  }
  const fallbackDigits = (fallback ?? '').replace(/\D/g, '');
  if (fallbackDigits.length >= 4) {
    return fallbackDigits;
  }
  return fallback ?? `wa-${randomUUID()}`;
};

const uniqueStringList = (values?: string[] | null): string[] => {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalized: string[] = [];
  const seen = new Set<string>();

  values.forEach((entry) => {
    if (typeof entry !== 'string') {
      return;
    }
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  });

  return normalized;
};

const pickPreferredName = (...values: Array<unknown>): string | null => {
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
};

export const shouldSkipByDedupe = (key: string, now: number): boolean => {
  pruneDedupeCache(now);

  const lastSeen = dedupeCache.get(key);
  if (typeof lastSeen === 'number' && now - lastSeen < DEDUPE_WINDOW_MS) {
    return true;
  }
  dedupeCache.set(key, now);
  return false;
};

const mapErrorForLog = (error: unknown) =>
  error instanceof Error ? { message: error.message, stack: error.stack } : error;

const provisionDefaultQueueForTenant = async (tenantId: string): Promise<string | null> => {
  try {
    const queue = await prisma.queue.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: DEFAULT_QUEUE_FALLBACK_NAME,
        },
      },
      update: {
        description: DEFAULT_QUEUE_FALLBACK_DESCRIPTION,
        isActive: true,
      },
      create: {
        tenantId,
        name: DEFAULT_QUEUE_FALLBACK_NAME,
        description: DEFAULT_QUEUE_FALLBACK_DESCRIPTION,
        color: '#2563EB',
        orderIndex: 0,
      },
    });

    queueCacheByTenant.set(tenantId, {
      id: queue.id,
      expires: Date.now() + DEFAULT_QUEUE_CACHE_TTL_MS,
    });

    logger.info('🎯 LeadEngine • WhatsApp :: 🧱 Fila padrão provisionada automaticamente', {
      tenantId,
      queueId: queue.id,
    });

    return queue.id;
  } catch (error) {
    logger.error('🎯 LeadEngine • WhatsApp :: ⚠️ Falha ao provisionar fila padrão', {
      error: mapErrorForLog(error),
      tenantId,
    });
    return null;
  }
};

const isForeignKeyError = (error: unknown): boolean => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
    return true;
  }

  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (code === 'P2003') {
      return true;
    }

    const cause = (error as { cause?: unknown }).cause;
    if (cause && cause !== error && isForeignKeyError(cause)) {
      return true;
    }
  }

  return false;
};

const isUniqueViolation = (error: unknown): boolean => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return true;
  }

  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (code === 'P2002') {
      return true;
    }

    const cause = (error as { cause?: unknown }).cause;
    if (cause && cause !== error && isUniqueViolation(cause)) {
      return true;
    }
  }

  return false;
};

const isMissingQueueError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }

  if (error instanceof NotFoundError) {
    return true;
  }

  if (isForeignKeyError(error)) {
    return true;
  }

  if (typeof error === 'object' && error !== null) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      return true;
    }

    const cause = (error as { cause?: unknown }).cause;
    if (cause && cause !== error) {
      return isMissingQueueError(cause);
    }
  }

  return false;
};

const getDefaultQueueId = async (tenantId: string): Promise<string | null> => {
  const now = Date.now();
  const cached = queueCacheByTenant.get(tenantId);

  if (cached) {
    if (cached.expires <= now) {
      queueCacheByTenant.delete(tenantId);
    } else {
      const existingQueue = await prisma.queue.findUnique({ where: { id: cached.id } });
      if (existingQueue) {
        return cached.id;
      }
      queueCacheByTenant.delete(tenantId);
    }
  }

  const queue = await prisma.queue.findFirst({
    where: { tenantId },
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
  });

  if (!queue) {
    return provisionDefaultQueueForTenant(tenantId);
  }

  queueCacheByTenant.set(tenantId, {
    id: queue.id,
    expires: Date.now() + DEFAULT_QUEUE_CACHE_TTL_MS,
  });
  return queue.id;
};

const ensureContact = async (
  tenantId: string,
  {
    phone,
    name,
    document,
    registrations,
    timestamp,
    avatar,
  }: {
    phone?: string;
    name?: string | null;
    document?: string;
    registrations?: string[];
    timestamp?: string | null;
    avatar?: string | null;
  }
) => {
  const interactionDate = timestamp ? new Date(timestamp) : new Date();
  const interactionTimestamp = interactionDate.getTime();
  const interactionIso = interactionDate.toISOString();

  let contact = null;

  if (phone) {
    contact = await prisma.contact.findUnique({
      where: {
        tenantId_phone: {
          tenantId,
          phone,
        },
      },
    });
  }

  if (!contact && document) {
    contact = await prisma.contact.findFirst({
      where: {
        tenantId,
        document,
      },
    });
  }

  const tags = Array.from(
    new Set([...(contact?.tags ?? []), 'whatsapp', 'inbound'])
  );

  const customFieldsSource =
    typeof contact?.customFields === 'object' && contact?.customFields !== null
      ? (contact.customFields as Record<string, unknown>)
      : {};

  const customFieldsRecord: Record<string, unknown> = {
    ...customFieldsSource,
    source: 'whatsapp',
    lastInboundChannel: 'whatsapp',
  };

  if (registrations && registrations.length > 0) {
    customFieldsRecord.registrations = registrations;
  } else if (!('registrations' in customFieldsRecord)) {
    customFieldsRecord.registrations = [];
  }

  if (!('consent' in customFieldsRecord)) {
    customFieldsRecord.consent = {
      granted: true,
      base: 'legitimate_interest',
      grantedAt: interactionDate.toISOString(),
    };
  }

  const parseTimestamp = (value: unknown): number | null => {
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? null : parsed;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    return null;
  };

  const currentFirstInbound = parseTimestamp(customFieldsRecord['firstInboundAt']);
  if (currentFirstInbound === null || interactionTimestamp < currentFirstInbound) {
    customFieldsRecord['firstInboundAt'] = interactionIso;
  }

  const currentLastInbound = parseTimestamp(customFieldsRecord['lastInboundAt']);
  if (currentLastInbound === null || interactionTimestamp >= currentLastInbound) {
    customFieldsRecord['lastInboundAt'] = interactionIso;
  }

  const contactData = {
    name: name && name.trim().length > 0 ? name.trim() : contact?.name ?? 'Contato WhatsApp',
    phone: phone ?? contact?.phone ?? null,
    document: document ?? contact?.document ?? null,
    avatar: avatar ?? contact?.avatar ?? null,
    tags,
    customFields: customFieldsRecord as Prisma.InputJsonValue,
    lastInteractionAt: interactionDate,
  };

  if (contact) {
    contact = await prisma.contact.update({
      where: { id: contact.id },
      data: contactData,
    });
  } else {
    contact = await prisma.contact.create({
      data: {
        tenantId,
        ...contactData,
      },
    });
  }

  return contact;
};

const ensureTicketForContact = async (
  tenantId: string,
  contactId: string,
  queueId: string,
  subject: string,
  metadata: Record<string, unknown>
): Promise<string | null> => {
  const createTicketWithQueue = async (targetQueueId: string) =>
    createTicketService({
      tenantId,
      contactId,
      queueId: targetQueueId,
      channel: 'WHATSAPP',
      priority: 'NORMAL',
      subject,
      tags: ['whatsapp', 'inbound'],
      metadata,
    });

  try {
    const ticket = await createTicketWithQueue(queueId);
    return ticket.id;
  } catch (error: unknown) {
    if (error instanceof ConflictError) {
      const conflict = error as ConflictError;
      const details = (conflict.details ?? {}) as Record<string, unknown>;
      const existingTicketId =
        typeof details.existingTicketId === 'string'
          ? details.existingTicketId
          : undefined;
      if (existingTicketId) {
        return existingTicketId;
      }
    }

    if (isMissingQueueError(error)) {
      queueCacheByTenant.delete(tenantId);
      const refreshedQueueId = await getDefaultQueueId(tenantId);

      if (refreshedQueueId) {
        try {
          const ticket = await createTicketWithQueue(refreshedQueueId);
          return ticket.id;
        } catch (retryError) {
          if (retryError instanceof ConflictError) {
            const conflict = retryError as ConflictError;
            const details = (conflict.details ?? {}) as Record<string, unknown>;
            const existingTicketId =
              typeof details.existingTicketId === 'string'
                ? details.existingTicketId
                : undefined;
            if (existingTicketId) {
              return existingTicketId;
            }
          }

          logger.error('Failed to ensure WhatsApp ticket for contact after queue refresh', {
            error: mapErrorForLog(retryError),
            tenantId,
            contactId,
          });
          return null;
        }
      }
    }

    logger.error('Failed to ensure WhatsApp ticket for contact', {
      error: mapErrorForLog(error),
      tenantId,
      contactId,
    });
    return null;
  }
};

const emitRealtimeUpdatesForInbound = async ({
  tenantId,
  ticketId,
  instanceId,
  message,
  providerMessageId,
}: {
  tenantId: string;
  ticketId: string;
  instanceId: string;
  message: Awaited<ReturnType<typeof sendMessageService>>;
  providerMessageId: string | null;
}) => {
  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

    if (!ticket || ticket.tenantId !== tenantId) {
      logger.warn('Inbound realtime event skipped: ticket not found', {
        tenantId,
        ticketId,
        messageId: message.id,
      });
      return;
    }

    const ticketPayload = {
      tenantId,
      ticketId,
      agreementId: ticket.agreementId ?? null,
      instanceId,
      messageId: message.id,
      providerMessageId,
      ticketStatus: ticket.status,
      ticketUpdatedAt: ticket.updatedAt?.toISOString?.() ?? new Date().toISOString(),
      ticket,
    };

    emitToTicket(ticketId, 'tickets.updated', ticketPayload);
    emitToTenant(tenantId, 'tickets.updated', ticketPayload);
    if (ticket.agreementId) {
      emitToAgreement(ticket.agreementId, 'tickets.updated', ticketPayload);
    }

    const messageMetadata =
      message.metadata && typeof message.metadata === 'object'
        ? (message.metadata as Record<string, unknown>)
        : {};
    const eventMetadata =
      messageMetadata.eventMetadata && typeof messageMetadata.eventMetadata === 'object'
        ? (messageMetadata.eventMetadata as Record<string, unknown>)
        : {};
    const requestId =
      typeof eventMetadata.requestId === 'string' && eventMetadata.requestId.trim().length > 0
        ? eventMetadata.requestId
        : null;

    logger.info('🎯 LeadEngine • WhatsApp :: 🔔 Eventos realtime propagados', {
      requestId,
      tenantId,
      ticketId,
      messageId: message.id,
      providerMessageId,
      agreementId: ticket.agreementId ?? null,
    });
  } catch (error) {
    logger.error('Failed to emit realtime updates for inbound WhatsApp message', {
      error: mapErrorForLog(error),
      tenantId,
      ticketId,
      messageId: message.id,
    });
  }
};

const upsertLeadFromInbound = async ({
  tenantId,
  contactId,
  ticketId,
  instanceId,
  providerMessageId,
  message,
}: {
  tenantId: string;
  contactId: string;
  ticketId: string;
  instanceId: string;
  providerMessageId: string | null;
  message: Awaited<ReturnType<typeof sendMessageService>>;
}) => {
  const lastContactAt =
    message.createdAt instanceof Date ? message.createdAt : new Date();

  const messageMetadata =
    message.metadata && typeof message.metadata === 'object'
      ? (message.metadata as Record<string, unknown>)
      : {};
  const eventMetadata =
    messageMetadata.eventMetadata && typeof messageMetadata.eventMetadata === 'object'
      ? (messageMetadata.eventMetadata as Record<string, unknown>)
      : {};
  const messageRequestId =
    typeof eventMetadata.requestId === 'string' && eventMetadata.requestId.trim().length > 0
      ? eventMetadata.requestId
      : null;
  const preview =
    typeof message.content === 'string' && message.content.trim().length > 0
      ? message.content.trim().slice(0, 140)
      : null;

  const lead = await prisma.lead.upsert({
    where: {
      tenantId_contactId: {
        tenantId,
        contactId,
      },
    },
    create: {
      tenantId,
      contactId,
      status: 'NEW',
      source: 'WHATSAPP',
      lastContactAt,
    },
    update: {
      lastContactAt,
    },
  });

  leadLastContactGauge.set(
    { tenantId, leadId: lead.id },
    lastContactAt.getTime()
  );

  const metadata: Record<string, unknown> = {
    ticketId,
    instanceId,
    providerMessageId,
    messageId: message.id,
    contactId,
    direction: message.direction,
  };

  if (preview) {
    metadata.preview = preview;
  }

  if (messageRequestId) {
    metadata.requestId = messageRequestId;
  }

  const existingLeadActivity = await prisma.leadActivity.findFirst({
    where: {
      tenantId,
      leadId: lead.id,
      type: 'WHATSAPP_REPLIED',
      metadata: {
        path: ['messageId'],
        equals: message.id,
      },
    },
  });

  if (existingLeadActivity) {
    logger.info('🎯 LeadEngine • WhatsApp :: ♻️ Lead activity reaproveitada', {
      tenantId,
      leadId: lead.id,
      ticketId,
      messageId: message.id,
    });
    return { lead, leadActivity: existingLeadActivity };
  }

  const leadActivity = await prisma.leadActivity.create({
    data: {
      tenantId,
      leadId: lead.id,
      type: 'WHATSAPP_REPLIED',
      title: 'Mensagem recebida pelo WhatsApp',
      metadata: metadata as Prisma.InputJsonValue,
      occurredAt: lastContactAt,
    },
  });

  const realtimeEnvelope = {
    tenantId,
    ticketId,
    instanceId,
    providerMessageId,
    message,
    lead,
    leadActivity,
  };

  try {
    emitToTenant(tenantId, 'leads.updated', realtimeEnvelope);
    emitToTicket(ticketId, 'leads.updated', realtimeEnvelope);
  } catch (error) {
    logger.error('Failed to emit lead realtime updates for inbound WhatsApp message', {
      error: mapErrorForLog(error),
      tenantId,
      ticketId,
      leadId: lead.id,
      messageId: message.id,
    });
  }

  try {
    emitToTenant(tenantId, 'leadActivities.new', realtimeEnvelope);
    emitToTicket(ticketId, 'leadActivities.new', realtimeEnvelope);
  } catch (error) {
    logger.error('Failed to emit lead activity realtime updates for inbound WhatsApp message', {
      error: mapErrorForLog(error),
      tenantId,
      ticketId,
      leadId: lead.id,
      messageId: message.id,
    });
  }

  return { lead, leadActivity };
};

export const __testing = {
  DEDUPE_WINDOW_MS,
  MAX_DEDUPE_CACHE_SIZE,
  DEFAULT_QUEUE_CACHE_TTL_MS,
  dedupeCache,
  queueCacheByTenant,
  resolveTenantIdentifiersFromMetadata,
  resolveBrokerIdFromMetadata,
  resolveSessionIdFromMetadata,
  resolveInstanceDisplayNameFromMetadata,
  attemptAutoProvisionWhatsAppInstance,
  pruneDedupeCache,
  getDefaultQueueId,
  ensureTicketForContact,
  upsertLeadFromInbound,
};

export const ingestInboundWhatsAppMessage = async (event: InboundWhatsAppEvent) => {
  const { instanceId, contact, message, timestamp } = event;
  const normalizedPhone = sanitizePhone(contact.phone);
  const document = sanitizeDocument(contact.document, normalizedPhone);
  const now = Date.now();
  const simpleMode = isWhatsappInboundSimpleModeEnabled();
  const metadataRecord = (event.metadata && typeof event.metadata === 'object'
    ? (event.metadata as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const requestId =
    typeof metadataRecord['requestId'] === 'string'
      ? metadataRecord['requestId']
      : null;
  const metadataContact = (metadataRecord.contact && typeof metadataRecord.contact === 'object'
    ? (metadataRecord.contact as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const metadataPushName = (() => {
    const direct = metadataContact['pushName'];
    if (typeof direct === 'string') {
      const trimmed = direct.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    const fallback = metadataRecord['pushName'];
    if (typeof fallback === 'string') {
      const trimmed = fallback.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    return null;
  })();
  const resolvedAvatar = [
    contact.avatarUrl,
    metadataContact.avatarUrl,
    metadataContact.profilePicUrl,
    metadataContact.profilePicture,
  ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  const resolvedName = pickPreferredName(
    contact.name,
    contact.pushName,
    metadataPushName
  );

  logger.info('🎯 LeadEngine • WhatsApp :: ✉️ Processando mensagem inbound fresquinha', {
    requestId,
    instanceId,
    messageId: message.id ?? null,
    timestamp,
    phone: maskPhone(normalizedPhone ?? null),
    document: maskDocument(document),
  });

  let instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

  if (!instance) {
    instance = await attemptAutoProvisionWhatsAppInstance({
      instanceId,
      metadata: metadataRecord,
      requestId,
      simpleMode,
    });
  }

  if (!instance) {
    logger.warn('🎯 LeadEngine • WhatsApp :: 🔍 Instância não encontrada — mensagem inbound estacionada', {
      requestId,
      instanceId,
      messageId: message.id ?? null,
    });
    return;
  }

  const tenantId = instance.tenantId;

  const campaigns =
    simpleMode
      ? []
      : await prisma.campaign.findMany({
          where: {
            tenantId,
            whatsappInstanceId: instanceId,
            status: 'active',
          },
        });

  if (!campaigns.length && !simpleMode) {
    logger.warn('🎯 LeadEngine • WhatsApp :: 💤 Nenhuma campanha ativa para a instância — seguindo mesmo assim', {
      requestId,
      tenantId,
      instanceId,
      messageId: message.id ?? null,
    });
  }

  const leadName = resolvedName ?? 'Contato WhatsApp';
  const registrations = uniqueStringList(contact.registrations || null);
  const leadIdBase = message.id || `${instanceId}:${normalizedPhone ?? document}:${timestamp ?? now}`;

  let queueId = await getDefaultQueueId(tenantId);
  if (!queueId) {
    if (simpleMode) {
      try {
        const fallbackQueue = await prisma.queue.upsert({
          where: {
            tenantId_name: {
              tenantId,
              name: 'WhatsApp • Fallback',
            },
          },
          update: {
            description: 'Fila criada automaticamente em modo simples.',
            isActive: true,
          },
          create: {
            tenantId,
            name: 'WhatsApp • Fallback',
            description: 'Fila criada automaticamente em modo simples.',
            color: '#22C55E',
            orderIndex: 0,
          },
        });
        queueCacheByTenant.set(tenantId, {
          id: fallbackQueue.id,
          expires: Date.now() + DEFAULT_QUEUE_CACHE_TTL_MS,
        });
        queueId = fallbackQueue.id;
        logger.warn('🎯 LeadEngine • WhatsApp :: ⚙️ Modo simples — fila fallback provisionada', {
          requestId,
          tenantId,
          instanceId,
          queueId,
        });
      } catch (error) {
        logger.error('🎯 LeadEngine • WhatsApp :: ❌ Falha ao provisionar fila fallback em modo simples', {
          error: mapErrorForLog(error),
          requestId,
          tenantId,
          instanceId,
        });
      }
    } else {
      logger.error('🎯 LeadEngine • WhatsApp :: 🛎️ Fila padrão ausente e fallback falhou', {
        requestId,
        tenantId,
        instanceId,
      });
      emitToTenant(tenantId, 'whatsapp.queue.missing', {
        tenantId,
        instanceId,
        message: 'Nenhuma fila padrão configurada para receber mensagens inbound.',
      });
      return;
    }
  }

  const contactRecord = await ensureContact(tenantId, {
    phone: normalizedPhone,
    name: leadName,
    document,
    registrations,
    timestamp,
    avatar: resolvedAvatar ?? null,
  });

  const ticketMetadata: Record<string, unknown> = {
    source: 'WHATSAPP',
    instanceId,
    campaignIds: campaigns.map((campaign) => campaign.id),
    pipelineStep: 'follow-up',
  };

  const ticketSubject = contactRecord.name || contactRecord.phone || 'Contato WhatsApp';
  let ticketId: string | null = null;
  if (queueId) {
    ticketId = await ensureTicketForContact(
      tenantId,
      contactRecord.id,
      queueId,
      ticketSubject,
      ticketMetadata
    );
  } else {
    const existingTicket = await prisma.ticket.findFirst({
      where: {
        tenantId,
        contactId: contactRecord.id,
        channel: 'WHATSAPP',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    if (existingTicket) {
      ticketId = existingTicket.id;
      logger.warn('🎯 LeadEngine • WhatsApp :: ⚠️ Reutilizando ticket existente por ausência de fila', {
        requestId,
        tenantId,
        instanceId,
        ticketId,
      });
    }
  }

  if (!ticketId) {
    logger.error('🎯 LeadEngine • WhatsApp :: 🚧 Não consegui garantir o ticket para a mensagem inbound', {
      requestId,
      tenantId,
      instanceId,
      messageId: message.id ?? null,
    });
    return;
  }

  const normalizedMessage = normalizeInboundMessage(message as InboundMessageDetails);

  const dedupeKey = `${tenantId}:${normalizedMessage.id}`;
  if (!simpleMode && shouldSkipByDedupe(dedupeKey, now)) {
    logger.info('🎯 LeadEngine • WhatsApp :: ♻️ Mensagem ignorada (janela de dedupe em ação)', {
      requestId,
      tenantId,
      ticketId,
      brokerMessageId: normalizedMessage.id,
      dedupeKey,
    });
    return;
  }

  const brokerTimestamp = normalizedMessage.brokerMessageTimestamp;
  const normalizedTimestamp = (() => {
    if (typeof brokerTimestamp === 'number') {
      return brokerTimestamp > 1_000_000_000_000 ? brokerTimestamp : brokerTimestamp * 1000;
    }
    if (timestamp) {
      const parsed = Date.parse(timestamp);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  })();

  let persistedMessage: Awaited<ReturnType<typeof sendMessageService>> | null = null;

  try {
    persistedMessage = await sendMessageService(tenantId, undefined, {
      ticketId,
      content: normalizedMessage.text,
      type: normalizedMessage.type,
      mediaUrl: normalizedMessage.mediaUrl ?? undefined,
      metadata: {
        broker: {
          messageId: normalizedMessage.id,
          clientMessageId: normalizedMessage.clientMessageId,
          conversationId: normalizedMessage.conversationId,
          instanceId,
          campaignIds: campaigns.map((campaign) => campaign.id),
        },
        media: normalizedMessage.mediaUrl
          ? {
              url: normalizedMessage.mediaUrl,
              mimetype: normalizedMessage.mimetype,
              caption: normalizedMessage.caption,
              size: normalizedMessage.fileSize,
            }
          : undefined,
        location: normalizedMessage.latitude || normalizedMessage.longitude
          ? {
              latitude: normalizedMessage.latitude,
              longitude: normalizedMessage.longitude,
              name: normalizedMessage.locationName,
            }
          : undefined,
        contacts: normalizedMessage.contacts ?? undefined,
        raw: normalizedMessage.raw,
        eventMetadata: event.metadata ?? {},
        receivedAt: normalizedMessage.receivedAt,
        brokerMessageTimestamp: normalizedMessage.brokerMessageTimestamp,
        normalizedTimestamp,
      },
    });
  } catch (error) {
    logger.error('🎯 LeadEngine • WhatsApp :: 💾 Falha ao salvar a mensagem inbound na timeline do ticket', {
      error: mapErrorForLog(error),
      requestId,
      tenantId,
      ticketId,
      messageId: message.id ?? null,
    });
  }

  if (persistedMessage) {
    const providerMessageId = normalizedMessage.id ?? null;
    await emitRealtimeUpdatesForInbound({
      tenantId,
      ticketId,
      instanceId,
      message: persistedMessage,
      providerMessageId,
    });

    let inboundLeadId: string | null = null;

    if (!simpleMode) {
      try {
        const { lead } = await upsertLeadFromInbound({
          tenantId,
          contactId: contactRecord.id,
          ticketId,
          instanceId,
          providerMessageId,
          message: persistedMessage,
        });
        inboundLeadId = lead.id;
      } catch (error) {
        logger.error('🎯 LeadEngine • WhatsApp :: ⚠️ Falha ao sincronizar lead inbound', {
          error: mapErrorForLog(error),
          requestId,
          tenantId,
          ticketId,
          instanceId,
          contactId: contactRecord.id,
          messageId: persistedMessage.id,
          providerMessageId,
        });
      }
    } else {
      logger.debug('🎯 LeadEngine • WhatsApp :: ℹ️ Modo simples ativo — pulando sincronização de leads/CRM', {
        requestId,
        tenantId,
        ticketId,
        messageId: persistedMessage.id,
      });
    }

    inboundMessagesProcessedCounter.inc({ tenantId });

    logger.info('🎯 LeadEngine • WhatsApp :: ✅ Mensagem inbound processada', {
      requestId,
      tenantId,
      ticketId,
      contactId: contactRecord.id,
      instanceId,
      messageId: persistedMessage.id,
      providerMessageId,
      leadId: inboundLeadId,
    });
  }

  if (!simpleMode && campaigns.length > 0) {
    for (const campaign of campaigns) {
      const agreementId = campaign.agreementId || 'unknown';
      const dedupeKey = `${tenantId}:${campaign.id}:${document || normalizedPhone || leadIdBase}`;

      if (shouldSkipByDedupe(dedupeKey, now)) {
        logger.info('🎯 LeadEngine • WhatsApp :: ⏱️ Mensagem já tratada nas últimas 24h — evitando duplicidade', {
          requestId,
          tenantId,
          campaignId: campaign.id,
          instanceId,
          messageId: message.id ?? null,
          phone: maskPhone(normalizedPhone ?? null),
          dedupeKey,
        });
        continue;
      }

      const brokerLead = {
        id: `${leadIdBase}:${campaign.id}`,
        fullName: leadName,
        document,
        registrations,
        agreementId,
        phone: normalizedPhone,
        margin: undefined,
        netMargin: undefined,
        score: undefined,
        tags: ['inbound-whatsapp'],
        raw: {
          from: contact,
          message,
          metadata: event.metadata ?? {},
          receivedAt: timestamp ?? new Date(now).toISOString(),
        },
      };

      try {
        const { newlyAllocated } = await addAllocations(tenantId, campaign.id, [brokerLead]);
        if (newlyAllocated.length > 0) {
          logger.info('🎯 LeadEngine • WhatsApp :: 🎯 Lead inbound alocado com sucesso', {
            tenantId,
            campaignId: campaign.id,
            instanceId,
            allocationId: newlyAllocated[0].allocationId,
            phone: maskPhone(normalizedPhone ?? null),
            leadId: newlyAllocated[0].leadId,
          });
        }
      } catch (error) {
        if (isUniqueViolation(error)) {
          logger.debug('🎯 LeadEngine • WhatsApp :: ⛔ Lead inbound já alocado recentemente — ignorando duplicidade', {
            tenantId,
            campaignId: campaign.id,
            instanceId,
            phone: maskPhone(normalizedPhone ?? null),
          });
          continue;
        }

        logger.error('🎯 LeadEngine • WhatsApp :: 🚨 Falha ao alocar lead inbound', {
          error: mapErrorForLog(error),
          tenantId,
          campaignId: campaign.id,
          instanceId,
          phone: maskPhone(normalizedPhone ?? null),
        });
      }
    }
  }
};
