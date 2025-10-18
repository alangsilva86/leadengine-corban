import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError } from '@ticketz/core';
import { Prisma } from '@prisma/client';

import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';
import { addAllocations } from '../../../data/lead-allocation-store';
import type { BrokerLeadRecord } from '../../../config/lead-engine';
import { maskDocument, maskPhone } from '../../../lib/pii';
import {
  isWhatsappInboundSimpleModeEnabled,
  isWhatsappPassthroughModeEnabled,
} from '../../../config/feature-flags';
import {
  inboundMessagesProcessedCounter,
  leadLastContactGauge,
} from '../../../lib/metrics';
import {
  createTicket as createTicketService,
  sendMessage as sendMessageService,
} from '../../../services/ticket-service';
import {
  emitToAgreement,
  emitToTenant,
  emitToTicket,
} from '../../../lib/socket-registry';
import { normalizeInboundMessage } from '../utils/normalize';
import { emitWhatsAppDebugPhase } from '../../debug/services/whatsapp-debug-emitter';
import {
  DEFAULT_CAMPAIGN_FALLBACK_AGREEMENT_PREFIX,
  DEFAULT_CAMPAIGN_FALLBACK_NAME,
  DEFAULT_DEDUPE_TTL_MS,
  DEFAULT_QUEUE_CACHE_TTL_MS,
  DEFAULT_QUEUE_FALLBACK_DESCRIPTION,
  DEFAULT_QUEUE_FALLBACK_NAME,
  DEFAULT_TENANT_ID,
  MAX_DEDUPE_CACHE_SIZE,
} from './constants';
import {
  dedupeCache,
  configureInboundDedupeBackend,
  registerDedupeKey,
  resetDedupeState,
  shouldSkipByDedupe,
} from './dedupe';
import { mapErrorForLog } from './logging';
import {
  pickPreferredName,
  readNestedString,
  readString,
  resolveBrokerIdFromMetadata,
  resolveDeterministicContactIdentifier,
  resolveInstanceDisplayNameFromMetadata,
  resolveSessionIdFromMetadata,
  resolveTenantIdentifiersFromMetadata,
  sanitizeDocument,
  sanitizePhone,
  uniqueStringList,
} from './identifiers';
import {
  emitPassthroughRealtimeUpdates,
  handlePassthroughIngest,
} from './passthrough';
import { resolveTicketAgreementId } from './ticket-utils';
import {
  attemptAutoProvisionWhatsAppInstance,
  ensureInboundQueueForInboundMessage,
  getDefaultQueueId,
  isForeignKeyError,
  isUniqueViolation,
  provisionDefaultQueueForTenant,
  queueCacheByTenant,
  QueueFallbackProvisionError,
  __testing as provisioningTesting,
} from './provisioning';
import {
  type InboundContactDetails,
  type InboundMessageDetails,
  type InboundWhatsAppEnvelope,
  type InboundWhatsAppEnvelopeMessage,
  type InboundWhatsAppEvent,
} from './types';

const toRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
};

export const resetInboundLeadServiceTestState = (): void => {
  resetDedupeState();
  queueCacheByTenant.clear();
};



const isMessageEnvelope = (
  envelope: InboundWhatsAppEnvelope
): envelope is InboundWhatsAppEnvelopeMessage => envelope.message.kind === 'message';

// Passthrough handlers are provided by ./passthrough

// Queue provisioning helpers provided by ./provisioning

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

// Default queue resolution provided by ./provisioning

// Queue ensuring handled by ./provisioning

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
    phone?: string | null | undefined;
    name?: string | null | undefined;
    document?: string | null | undefined;
    registrations?: string[] | null | undefined;
    timestamp?: string | null | undefined;
    avatar?: string | null | undefined;
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
      let refreshedQueueId: string | null = null;

      try {
        refreshedQueueId = await getDefaultQueueId(tenantId, { provisionIfMissing: false });
      } catch (refreshError) {
        logger.warn('Failed to refresh WhatsApp queue after missing queue error', {
          error: mapErrorForLog(refreshError),
          tenantId,
          contactId,
        });
      }

      if (!refreshedQueueId) {
        try {
          refreshedQueueId = await provisionDefaultQueueForTenant(tenantId);
        } catch (provisionError) {
          logger.error('Failed to ensure WhatsApp ticket for contact after queue refresh', {
            error: mapErrorForLog(provisionError),
            tenantId,
            contactId,
          });
          return null;
        }
      }

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

    if (!ticket) {
      logger.warn('Inbound realtime event skipped: ticket record missing', {
        tenantId,
        ticketId,
        messageId: message.id,
      });
      return;
    }

    const agreementId = resolveTicketAgreementId(ticket);

    const ticketPayload = {
      tenantId,
      ticketId,
      agreementId,
      instanceId,
      messageId: message.id,
      providerMessageId,
      ticketStatus: ticket.status,
      ticketUpdatedAt: ticket.updatedAt?.toISOString?.() ?? new Date().toISOString(),
      ticket,
    };

    emitToTicket(ticketId, 'tickets.updated', ticketPayload);
    emitToTenant(tenantId, 'tickets.updated', ticketPayload);
    if (agreementId) {
      emitToAgreement(agreementId, 'tickets.updated', ticketPayload);
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
      agreementId,
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

  const existingLead = await prisma.lead.findFirst({
    where: {
      tenantId,
      contactId,
    },
  });

  const lead = existingLead
    ? await prisma.lead.update({
        where: { id: existingLead.id },
        data: { lastContactAt },
      })
    : await prisma.lead.create({
        data: {
          tenantId,
          contactId,
          status: 'NEW',
          source: 'WHATSAPP',
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

const resolveEnvelopeChatId = (
  envelope: InboundWhatsAppEnvelopeMessage
): string | null => {
  const provided = readString(envelope.chatId);
  if (provided) {
    return provided;
  }

  const payloadRecord = toRecord(envelope.message.payload);
  if (payloadRecord.chatId) {
    const candidate = readString(payloadRecord.chatId);
    if (candidate) {
      return candidate;
    }
  }

  const keyRecord = toRecord(payloadRecord.key);
  return readString(keyRecord.remoteJid) ?? readString(keyRecord.jid) ?? null;
};

const resolveEnvelopeMessageId = (
  envelope: InboundWhatsAppEnvelopeMessage
): string | null => {
  const payloadRecord = toRecord(envelope.message.payload);
  const keyRecord = toRecord(payloadRecord.key);

  return (
    readString(envelope.message.externalId) ??
    readString(envelope.message.brokerMessageId) ??
    readString(envelope.message.id) ??
    readString(payloadRecord.id) ??
    readString(keyRecord.id)
  );
};

const mergeEnvelopeMetadata = (
  envelope: InboundWhatsAppEnvelopeMessage,
  chatId: string | null
): Record<string, unknown> => {
  const base = toRecord(envelope.message.metadata);
  const payloadRecord = toRecord(envelope.message.payload);

  if (!base.chatId && chatId) {
    base.chatId = chatId;
  }
  if (!base.tenantId) {
    const payloadTenantId = readString(payloadRecord.tenantId);
    if (payloadTenantId) {
      base.tenantId = payloadTenantId;
    } else if (envelope.tenantId) {
      base.tenantId = envelope.tenantId;
    }
  }

  if (!base.tenant) {
    const payloadTenant = toRecord(payloadRecord.tenant);
    if (Object.keys(payloadTenant).length > 0) {
      base.tenant = payloadTenant;
    }
  }

  if (!base.context) {
    const payloadContext = toRecord(payloadRecord.context);
    if (Object.keys(payloadContext).length > 0) {
      base.context = payloadContext;
    }
  }

  if (!base.integration) {
    const payloadIntegration = toRecord(payloadRecord.integration);
    if (Object.keys(payloadIntegration).length > 0) {
      base.integration = payloadIntegration;
    }
  }

  if (!base.sessionId) {
    const payloadSessionId = readString(payloadRecord.sessionId);
    if (payloadSessionId) {
      base.sessionId = payloadSessionId;
    }
  }

  if (!base.instanceId) {
    base.instanceId = envelope.instanceId;
  }
  if (envelope.raw && !base.rawEnvelope) {
    base.rawEnvelope = envelope.raw;
  }

  return base;
};

export const ingestInboundWhatsAppMessage = async (
  envelope: InboundWhatsAppEnvelope
): Promise<boolean> => {
  if (!isMessageEnvelope(envelope)) {
    logger.debug('whatsappInbound.ingest.skipUpdateEvent', {
      origin: envelope.origin,
      instanceId: envelope.instanceId,
      updateId: envelope.message.id,
    });
    return false;
  }

  const messageEnvelope: InboundWhatsAppEnvelopeMessage = envelope;

  const chatId = resolveEnvelopeChatId(messageEnvelope);
  const messageId = resolveEnvelopeMessageId(messageEnvelope) ?? randomUUID();
  const payloadRecord = toRecord(messageEnvelope.message.payload);
  const envelopeTenantId = readString(messageEnvelope.tenantId);
  const payloadTenantId = readString(payloadRecord.tenantId);
  const metadata = mergeEnvelopeMetadata(messageEnvelope, chatId);
  let tenantId =
    readString(metadata.tenantId) ?? payloadTenantId ?? envelopeTenantId ?? DEFAULT_TENANT_ID;

  if (!metadata.tenantId && tenantId) {
    metadata.tenantId = tenantId;
  }

  const now = Date.now();
  const dedupeTtlMs = messageEnvelope.dedupeTtlMs ?? DEFAULT_DEDUPE_TTL_MS;
  const keyChatId = chatId ?? '__unknown__';
  const dedupeKey = `${tenantId}:${messageEnvelope.instanceId}:${keyChatId}:${messageId}`;

  emitWhatsAppDebugPhase({
    phase: 'ingest:received',
    correlationId: messageId,
    tenantId: tenantId ?? null,
    instanceId: messageEnvelope.instanceId ?? null,
    chatId,
    tags: ['ingest'],
    context: {
      origin: messageEnvelope.origin,
      dedupeKey,
      dedupeTtlMs,
    },
    payload: {
      message: messageEnvelope.message.payload,
      metadata,
    },
  });

  if (await shouldSkipByDedupe(dedupeKey, now, dedupeTtlMs)) {
    logger.info('whatsappInbound.ingest.dedupeSkip', {
      origin: messageEnvelope.origin,
      instanceId: messageEnvelope.instanceId,
      tenantId,
      chatId: keyChatId,
      messageId,
      dedupeKey,
      dedupeTtlMs,
    });
    emitWhatsAppDebugPhase({
      phase: 'ingest:dedupe-skipped',
      correlationId: messageId,
      tenantId: tenantId ?? null,
      instanceId: messageEnvelope.instanceId ?? null,
      chatId,
      tags: ['ingest'],
      context: {
        origin: messageEnvelope.origin,
        dedupeKey,
        dedupeTtlMs,
      },
    });
    return false;
  }

  const event: InboundWhatsAppEvent = {
    id: messageEnvelope.message.id ?? messageId,
    instanceId: messageEnvelope.instanceId,
    direction: messageEnvelope.message.direction,
    chatId,
    externalId: messageEnvelope.message.externalId ?? messageId,
    timestamp: messageEnvelope.message.timestamp ?? null,
    contact: messageEnvelope.message.contact ?? {},
    message: messageEnvelope.message.payload,
    metadata,
    tenantId,
    sessionId: readString(metadata.sessionId),
  };

  const passthroughMode = isWhatsappPassthroughModeEnabled();
  const simpleMode = passthroughMode || isWhatsappInboundSimpleModeEnabled();
  let preloadedInstance: WhatsAppInstanceRecord | null = null;

  if (!passthroughMode) {
    if (!metadata.tenantId && tenantId) {
      metadata.tenantId = tenantId;
    }

    const tenantIdentifiers = resolveTenantIdentifiersFromMetadata(metadata);

    if (tenantIdentifiers.length > 0) {
      const requestIdForProvision = readString(metadata.requestId);
      const autoProvisionResult = await attemptAutoProvisionWhatsAppInstance({
        instanceId: messageEnvelope.instanceId,
        metadata,
        requestId: requestIdForProvision,
        simpleMode,
      });

      if (autoProvisionResult) {
        preloadedInstance = autoProvisionResult.instance;

        if (!metadata.brokerId) {
          metadata.brokerId = autoProvisionResult.brokerId;
        }

        if (
          autoProvisionResult.instance?.tenantId &&
          (!event.tenantId || event.tenantId !== autoProvisionResult.instance.tenantId)
        ) {
          event.tenantId = autoProvisionResult.instance.tenantId;
        }
      }
    }
  }

  let messagePersisted = false;

  if (passthroughMode) {
    await handlePassthroughIngest(event);
    messagePersisted = true;
  } else {
    messagePersisted = await processStandardInboundEvent(event, now, {
      passthroughMode,
      simpleMode,
      preloadedInstance,
    });
  }

  if (messagePersisted) {
    await registerDedupeKey(dedupeKey, now, dedupeTtlMs);
  }

  logger.info('🎯 LeadEngine • WhatsApp :: 🤹 Resultado final da ingestão', {
    origin: messageEnvelope.origin,
    instanceId: messageEnvelope.instanceId,
    tenantId: tenantId ?? 'unknown',
    chatId: keyChatId,
    messageId,
    persisted: messagePersisted,
  });

  emitWhatsAppDebugPhase({
    phase: messagePersisted ? 'ingest:completed' : 'ingest:failed',
    correlationId: messageId,
    tenantId: tenantId ?? null,
    instanceId: messageEnvelope.instanceId ?? null,
    chatId,
    tags: ['ingest'],
    context: {
      origin: messageEnvelope.origin,
      dedupeKey,
      dedupeTtlMs,
      passthroughMode,
      simpleMode,
      persisted: messagePersisted,
    },
    payload: {
      event,
    },
  });

  return messagePersisted;
};

const processStandardInboundEvent = async (
  event: InboundWhatsAppEvent,
  now: number,
  {
    passthroughMode,
    simpleMode,
    preloadedInstance,
  }: {
    passthroughMode: boolean;
    simpleMode: boolean;
    preloadedInstance?: WhatsAppInstanceRecord | null;
  }
): Promise<boolean> => {
  const {
    instanceId,
    contact,
    message,
    timestamp,
    direction,
    chatId,
    externalId,
    tenantId: eventTenantId,
    sessionId: eventSessionId,
  } = event;

  const instanceIdentifier =
    typeof instanceId === 'string' && instanceId.trim().length > 0 ? instanceId.trim() : null;
  const normalizedPhone = sanitizePhone(contact.phone);
  const metadataRecord = toRecord(event.metadata);
  const metadataContact = toRecord(metadataRecord.contact);
  const deterministicIdentifiers = resolveDeterministicContactIdentifier({
    instanceId: instanceIdentifier,
    metadataRecord,
    metadataContact,
    sessionId:
      readString(eventSessionId) ?? readString(metadataRecord.sessionId) ?? readString(metadataRecord.session_id),
    externalId,
  });
  const document = sanitizeDocument(contact.document, [
    normalizedPhone,
    deterministicIdentifiers.deterministicId,
    deterministicIdentifiers.contactId,
    deterministicIdentifiers.sessionId,
    instanceIdentifier,
  ]);
  const requestId = readString(metadataRecord['requestId']);
  const resolvedBrokerId = resolveBrokerIdFromMetadata(metadataRecord);
  const metadataTenantRecord = toRecord(metadataRecord.tenant);
  const metadataPushName = readString(metadataContact['pushName']) ?? readString(metadataRecord['pushName']);
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

  const normalizedEventTenantId =
    typeof eventTenantId === 'string' && eventTenantId.trim().length > 0 ? eventTenantId.trim() : null;
  let metadataTenantId = readString(metadataRecord['tenantId']);

  if (normalizedEventTenantId) {
    if (!metadataTenantId || metadataTenantId !== normalizedEventTenantId) {
      metadataRecord.tenantId = normalizedEventTenantId;
      metadataTenantId = normalizedEventTenantId;
    }
  } else if (eventTenantId && !metadataTenantId) {
    metadataRecord.tenantId = eventTenantId;
    metadataTenantId = eventTenantId;
  }

  if (metadataTenantId) {
    let tenantRecordUpdated = false;
    const tenantRecordId = readString(metadataTenantRecord['id']);
    if (!tenantRecordId || tenantRecordId !== metadataTenantId) {
      metadataTenantRecord['id'] = metadataTenantId;
      tenantRecordUpdated = true;
    }
    const tenantRecordTenantId = readString(metadataTenantRecord['tenantId']);
    if (!tenantRecordTenantId || tenantRecordTenantId !== metadataTenantId) {
      metadataTenantRecord['tenantId'] = metadataTenantId;
      tenantRecordUpdated = true;
    }

    if (tenantRecordUpdated || (!metadataRecord.tenant && Object.keys(metadataTenantRecord).length > 0)) {
      metadataRecord.tenant = metadataTenantRecord;
    }
  }

  const tenantIdForBrokerLookup = normalizedEventTenantId ?? metadataTenantId ?? null;

  metadataRecord.direction = direction;
  if (chatId && !metadataRecord.chatId) {
    metadataRecord.chatId = chatId;
  }
  if (eventSessionId && !metadataRecord.sessionId) {
    metadataRecord.sessionId = eventSessionId;
  }

  const metadataBroker =
    metadataRecord.broker && typeof metadataRecord.broker === 'object'
      ? (metadataRecord.broker as Record<string, unknown>)
      : null;
  if (metadataBroker) {
    metadataBroker.direction = direction;
    metadataBroker.instanceId = metadataBroker.instanceId ?? instanceId;
    if (resolvedBrokerId && (!metadataBroker.id || metadataBroker.id !== resolvedBrokerId)) {
      metadataBroker.id = resolvedBrokerId;
    }
  } else {
    metadataRecord.broker = {
      direction,
      instanceId,
      ...(resolvedBrokerId ? { id: resolvedBrokerId } : {}),
    };
  }

  if (resolvedBrokerId && (!metadataRecord.brokerId || metadataRecord.brokerId !== resolvedBrokerId)) {
    metadataRecord.brokerId = resolvedBrokerId;
  }

  logger.info('🎯 LeadEngine • WhatsApp :: ✉️ Processando mensagem WhatsApp fresquinha', {
    requestId,
    instanceId,
    messageId: message.id ?? null,
    timestamp,
    direction,
    phone: maskPhone(normalizedPhone ?? null),
    document: maskDocument(document),
  });

  let instance: WhatsAppInstanceRecord | null = preloadedInstance ?? null;

  if (resolvedBrokerId) {
    const brokerLookupWhere: Prisma.WhatsAppInstanceWhereInput = { brokerId: resolvedBrokerId };

    if (tenantIdForBrokerLookup) {
      brokerLookupWhere.tenantId = tenantIdForBrokerLookup;
    }

    if (!instance) {
      instance = await prisma.whatsAppInstance.findFirst({ where: brokerLookupWhere });
    }
  }

  if (!instance) {
    instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });
  }

  if (!instance) {
    const tenantIdentifiersForAutoProvision = resolveTenantIdentifiersFromMetadata(metadataRecord);
    const autoProvisionResult = await attemptAutoProvisionWhatsAppInstance({
      instanceId,
      metadata: metadataRecord,
      requestId,
      simpleMode,
    });

    if (autoProvisionResult) {
      instance = autoProvisionResult.instance;

      metadataTenantId = instance?.tenantId ?? metadataTenantId;

      if (instance?.tenantId) {
        metadataRecord.tenantId = instance.tenantId;
        metadataTenantRecord['id'] = instance.tenantId;
        metadataTenantRecord['tenantId'] = instance.tenantId;
        metadataRecord.tenant = metadataTenantRecord;
      }

      if (!metadataRecord.brokerId) {
        metadataRecord.brokerId = autoProvisionResult.brokerId;
      }

      if (metadataBroker) {
        if (!metadataBroker.id || metadataBroker.id !== autoProvisionResult.brokerId) {
          metadataBroker.id = autoProvisionResult.brokerId;
        }
      } else {
        metadataRecord.broker = {
          direction,
          instanceId,
          id: autoProvisionResult.brokerId,
        };
      }

      const logContext = {
        requestId,
        instanceId,
        tenantId: instance?.tenantId ?? null,
        tenantIdentifiers: tenantIdentifiersForAutoProvision,
        brokerId: autoProvisionResult.brokerId,
      };

      if (autoProvisionResult.wasCreated) {
        logger.info('🎯 LeadEngine • WhatsApp :: 🆕 Instância autoprov criada durante ingestão padrão', logContext);
      } else {
        logger.info('🎯 LeadEngine • WhatsApp :: ♻️ Instância autoprov reutilizada durante ingestão padrão', logContext);
      }
    } else {
      logger.warn('🎯 LeadEngine • WhatsApp :: ⚠️ Autoprovisionamento não realizado durante ingestão padrão', {
        requestId,
        instanceId,
        tenantIdentifiers: tenantIdentifiersForAutoProvision,
      });
    }
  }

  event.metadata = metadataRecord;

  if (!instance) {
    logger.warn('🎯 LeadEngine • WhatsApp :: 🔍 Instância não encontrada — mensagem inbound estacionada', {
      requestId,
      instanceId,
      messageId: message.id ?? null,
    });
    return;
  }

  const tenantId = instance.tenantId;

  const campaigns = simpleMode
    ? []
    : await prisma.campaign.findMany({
        where: {
          tenantId,
          whatsappInstanceId: instanceId,
          status: 'active',
        },
      });

  if (!campaigns.length && !simpleMode && !passthroughMode) {
    const fallbackCampaign = await provisionFallbackCampaignForInstance(tenantId, instanceId);

    if (fallbackCampaign) {
      campaigns.push(fallbackCampaign);
      logger.warn('🎯 LeadEngine • WhatsApp :: 💤 Nenhuma campanha ativa — fallback provisionado', {
        requestId,
        tenantId,
        instanceId,
        fallbackCampaignId: fallbackCampaign.id,
        messageId: message.id ?? null,
      });
    } else {
      logger.warn('🎯 LeadEngine • WhatsApp :: 💤 Nenhuma campanha ativa para a instância — seguindo mesmo assim', {
        requestId,
        tenantId,
        instanceId,
        messageId: message.id ?? null,
      });
    }
  }

  const leadName = resolvedName ?? 'Contato WhatsApp';
  const registrations = uniqueStringList(contact.registrations || null);
  const leadIdBase = message.id || `${instanceId}:${normalizedPhone ?? document}:${timestamp ?? now}`;

  const queueResolution = await ensureInboundQueueForInboundMessage({
    tenantId,
    requestId: requestId ?? null,
    instanceId: instanceId ?? null,
    simpleMode,
  });

  if (!queueResolution.queueId) {
    if (queueResolution.error) {
      logger.warn('🎯 LeadEngine • WhatsApp :: 🧱 Mensagem estacionada por ausência de fila padrão', {
        requestId,
        tenantId,
        instanceId,
        reason: queueResolution.error.reason,
        recoverable: queueResolution.error.recoverable,
      });
    }

    return false;
  }

  const queueId = queueResolution.queueId;

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
  const ticketId = await ensureTicketForContact(
    tenantId,
    contactRecord.id,
    queueId,
    ticketSubject,
    ticketMetadata
  );

  if (!ticketId) {
    logger.error('🎯 LeadEngine • WhatsApp :: 🚧 Não consegui garantir o ticket para a mensagem inbound', {
      requestId,
      tenantId,
      instanceId,
      messageId: message.id ?? null,
    });
    return false;
  }

  const normalizedMessage = normalizeInboundMessage(message as InboundMessageDetails);
  const messageKeyRecord =
    message && typeof message === 'object' && 'key' in message && message.key && typeof message.key === 'object'
      ? (message.key as { id?: string | null })
      : null;
  const messageExternalId =
    readString(externalId) ??
    readString(normalizedMessage.id) ??
    readString((message as InboundMessageDetails).id) ??
    readString(messageKeyRecord?.id) ??
    event.id;

  if (messageExternalId && !metadataRecord.externalId) {
    metadataRecord.externalId = messageExternalId;
  }

  const metadataBrokerRecord =
    metadataRecord.broker && typeof metadataRecord.broker === 'object'
      ? (metadataRecord.broker as Record<string, unknown>)
      : null;
  if (metadataBrokerRecord) {
    if (messageExternalId && !metadataBrokerRecord.messageId) {
      metadataBrokerRecord.messageId = messageExternalId;
    }
    metadataBrokerRecord.direction = direction;
    metadataBrokerRecord.instanceId = metadataBrokerRecord.instanceId ?? instanceId;
  } else if (messageExternalId) {
    metadataRecord.broker = {
      direction,
      instanceId,
      messageId: messageExternalId,
    };
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

  const dedupeKey = `${tenantId}:${messageExternalId ?? normalizedMessage.id}`;
  if (
    !simpleMode &&
    !passthroughMode &&
    direction === 'INBOUND' &&
    (await shouldSkipByDedupe(dedupeKey, now))
  ) {
    logger.info('🎯 LeadEngine • WhatsApp :: ♻️ Mensagem ignorada (janela de dedupe em ação)', {
      requestId,
      tenantId,
      ticketId,
      brokerMessageId: normalizedMessage.id,
      dedupeKey,
    });
    return true;
  }

    let persistedMessage: Awaited<ReturnType<typeof sendMessageService>> | null = null;

    const timelineMessageType = (() => {
      switch (normalizedMessage.type) {
        case 'IMAGE':
        case 'VIDEO':
        case 'AUDIO':
        case 'DOCUMENT':
        case 'LOCATION':
        case 'CONTACT':
        case 'TEMPLATE':
          return normalizedMessage.type;
        case 'TEXT':
        default:
          return 'TEXT';
      }
    })();

  try {
    persistedMessage = await sendMessageService(tenantId, undefined, {
      ticketId,
      content: normalizedMessage.text ?? '[Mensagem]',
      type: timelineMessageType,
      direction,
      externalId: messageExternalId ?? undefined,
      mediaUrl: normalizedMessage.mediaUrl ?? undefined,
      metadata: {
        broker: {
          messageId: messageExternalId ?? normalizedMessage.id,
          clientMessageId: normalizedMessage.clientMessageId,
          conversationId: normalizedMessage.conversationId,
          instanceId,
          campaignIds: campaigns.map((campaign) => campaign.id),
        },
        externalId: messageExternalId ?? undefined,
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
    await registerDedupeKey(dedupeKey, now, DEFAULT_DEDUPE_TTL_MS);

    const providerMessageId = normalizedMessage.id ?? null;
    await emitRealtimeUpdatesForInbound({
      tenantId,
      ticketId,
      instanceId,
      message: persistedMessage,
      providerMessageId,
    });

    let inboundLeadId: string | null = null;

    if (!simpleMode && !passthroughMode && direction === 'INBOUND') {
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

    inboundMessagesProcessedCounter.inc({
      origin: 'legacy',
      tenantId,
      instanceId: instanceId ?? 'unknown',
    });

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

  if (!simpleMode && !passthroughMode) {
    const allocationTargets = campaigns.length
      ? campaigns.map((campaign) => ({
          campaign,
          target: { campaignId: campaign.id, instanceId },
        }))
      : [{ campaign: null as const, target: { instanceId } }];

    for (const { campaign, target } of allocationTargets) {
      const campaignId = campaign?.id ?? null;
      const agreementId = campaign?.agreementId || 'unknown';
      const allocationDedupeKey = campaignId
        ? `${tenantId}:${campaignId}:${document || normalizedPhone || leadIdBase}`
        : `${tenantId}:${instanceId}:${document || normalizedPhone || leadIdBase}`;

      if (campaignId && (await shouldSkipByDedupe(allocationDedupeKey, now))) {
        logger.info('🎯 LeadEngine • WhatsApp :: ⏱️ Mensagem já tratada nas últimas 24h — evitando duplicidade', {
          requestId,
          tenantId,
          campaignId,
          instanceId,
          messageId: message.id ?? null,
          phone: maskPhone(normalizedPhone ?? null),
          dedupeKey: allocationDedupeKey,
        });
        continue;
      }

        const brokerLead: BrokerLeadRecord = {
          id: campaignId ? `${leadIdBase}:${campaignId}` : `${leadIdBase}:instance:${instanceId}`,
          fullName: leadName,
          document,
          registrations,
          agreementId,
          tags: ['inbound-whatsapp'],
          raw: {
            from: contact,
            message,
            metadata: event.metadata ?? {},
            receivedAt: timestamp ?? new Date(now).toISOString(),
          },
        };

        if (normalizedPhone) {
          brokerLead.phone = normalizedPhone;
        }

      try {
        const { newlyAllocated, summary } = await addAllocations(tenantId, target, [brokerLead]);
        await registerDedupeKey(allocationDedupeKey, now, DEFAULT_DEDUPE_TTL_MS);
        if (newlyAllocated.length > 0) {
          const allocation = newlyAllocated[0];
          logger.info('🎯 LeadEngine • WhatsApp :: 🎯 Lead inbound alocado com sucesso', {
            tenantId,
            campaignId: allocation.campaignId ?? campaignId,
            instanceId,
            allocationId: allocation.allocationId,
            phone: maskPhone(normalizedPhone ?? null),
            leadId: allocation.leadId,
          });

          const realtimePayload = {
            tenantId,
            campaignId: allocation.campaignId ?? null,
            agreementId: allocation.agreementId ?? null,
            instanceId: allocation.instanceId,
            allocation,
            summary,
          };

          emitToTenant(tenantId, 'leadAllocations.new', realtimePayload);
          if (allocation.agreementId && allocation.agreementId !== 'unknown') {
            emitToAgreement(allocation.agreementId, 'leadAllocations.new', realtimePayload);
          }
        }
      } catch (error) {
        if (isUniqueViolation(error)) {
          logger.debug('🎯 LeadEngine • WhatsApp :: ⛔ Lead inbound já alocado recentemente — ignorando duplicidade', {
            tenantId,
            campaignId: campaignId ?? undefined,
            instanceId,
            phone: maskPhone(normalizedPhone ?? null),
          });
          await registerDedupeKey(allocationDedupeKey, now, DEFAULT_DEDUPE_TTL_MS);
          continue;
        }

        logger.error('🎯 LeadEngine • WhatsApp :: 🚨 Falha ao alocar lead inbound', {
          error: mapErrorForLog(error),
          tenantId,
          campaignId: campaignId ?? undefined,
          instanceId,
          phone: maskPhone(normalizedPhone ?? null),
        });
      }
    }
  }
  return !!persistedMessage;
};

export const __testing = {
  DEFAULT_DEDUPE_TTL_MS,
  MAX_DEDUPE_CACHE_SIZE,
  DEFAULT_QUEUE_CACHE_TTL_MS,
  dedupeCache,
  configureInboundDedupeBackend,
  queueCacheByTenant,
  resolveTenantIdentifiersFromMetadata,
  resolveBrokerIdFromMetadata,
  resolveSessionIdFromMetadata,
  resolveInstanceDisplayNameFromMetadata,
  resolveDeterministicContactIdentifier,
  attemptAutoProvisionWhatsAppInstance,
  getDefaultQueueId,
  ensureTicketForContact,
  upsertLeadFromInbound,
  emitPassthroughRealtimeUpdates,
  emitRealtimeUpdatesForInbound,
  provisionFallbackCampaignForInstance,
  ensureInboundQueueForInboundMessage,
  handlePassthroughIngest,
  processStandardInboundEvent,
};
