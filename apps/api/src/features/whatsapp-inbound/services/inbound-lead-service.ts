import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError } from '@ticketz/core';
import { Prisma } from '@prisma/client';

import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';
import { addAllocations } from '../../../data/lead-allocation-store';
import { maskDocument, maskPhone } from '../../../lib/pii';
import { createTicket as createTicketService, sendMessage as sendMessageService } from '../../../services/ticket-service';
import { emitToAgreement, emitToTenant, emitToTicket } from '../../../lib/socket-registry';
import { normalizeInboundMessage } from '../utils/normalize';

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_DEDUPE_CACHE_SIZE = 10_000;

const dedupeCache = new Map<string, number>();

const DEFAULT_QUEUE_CACHE_TTL_MS = 5 * 60 * 1000;

type QueueCacheEntry = {
  id: string;
  expires: number;
};

const queueCacheByTenant = new Map<string, QueueCacheEntry>();

export const resetInboundLeadServiceTestState = (): void => {
  dedupeCache.clear();
  queueCacheByTenant.clear();
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
    return null;
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

export const __testing = {
  DEDUPE_WINDOW_MS,
  MAX_DEDUPE_CACHE_SIZE,
  DEFAULT_QUEUE_CACHE_TTL_MS,
  dedupeCache,
  queueCacheByTenant,
  pruneDedupeCache,
  getDefaultQueueId,
  ensureTicketForContact,
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
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        tenantId: true,
        agreementId: true,
        status: true,
        queueId: true,
        subject: true,
        updatedAt: true,
        metadata: true,
      },
    });

    if (!ticket) {
      logger.warn('Inbound realtime event skipped: ticket not found', {
        tenantId,
        ticketId,
        messageId: message.id,
      });
      return;
    }

    const envelopeBase = {
      tenantId,
      ticketId,
      agreementId: ticket.agreementId ?? null,
      instanceId,
      messageId: message.id,
      providerMessageId,
      ticketStatus: ticket.status,
      ticketUpdatedAt: ticket.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    };

    const messagePayload = {
      ...envelopeBase,
      message,
    };

    emitToTicket(ticketId, 'messages.new', messagePayload);
    emitToTenant(tenantId, 'messages.new', messagePayload);
    if (ticket.agreementId) {
      emitToAgreement(ticket.agreementId, 'messages.new', messagePayload);
    }

    const ticketPayload = {
      ...envelopeBase,
      ticket,
    };

    emitToTicket(ticketId, 'tickets.updated', ticketPayload);
    emitToTenant(tenantId, 'tickets.updated', ticketPayload);
    if (ticket.agreementId) {
      emitToAgreement(ticket.agreementId, 'tickets.updated', ticketPayload);
    }
  } catch (error) {
    logger.error('🎯 LeadEngine • WhatsApp :: 📡 Falha ao emitir eventos em tempo real para a mensagem inbound', {
      error,
      tenantId,
      ticketId,
      messageId: message.id,
    });
  }
};

export const ingestInboundWhatsAppMessage = async (event: InboundWhatsAppEvent) => {
  const { instanceId, contact, message, timestamp } = event;
  const normalizedPhone = sanitizePhone(contact.phone);
  const document = sanitizeDocument(contact.document, normalizedPhone);
  const now = Date.now();
  const metadataRecord = (event.metadata && typeof event.metadata === 'object'
    ? (event.metadata as Record<string, unknown>)
    : {}) as Record<string, unknown>;
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
    instanceId,
    messageId: message.id ?? null,
    timestamp,
    phone: maskPhone(normalizedPhone ?? null),
    document: maskDocument(document),
  });

  const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

  if (!instance) {
    logger.warn('🎯 LeadEngine • WhatsApp :: 🔍 Instância não encontrada — mensagem inbound estacionada', {
      instanceId,
      messageId: message.id ?? null,
    });
    return;
  }

  const tenantId = instance.tenantId;

  const campaigns = await prisma.campaign.findMany({
    where: {
      tenantId,
      whatsappInstanceId: instanceId,
      status: 'active',
    },
  });

  if (!campaigns.length) {
    logger.warn('🎯 LeadEngine • WhatsApp :: 💤 Nenhuma campanha ativa para a instância — seguindo mesmo assim', {
      tenantId,
      instanceId,
      messageId: message.id ?? null,
    });
  }

  const leadName = resolvedName ?? 'Contato WhatsApp';
  const registrations = uniqueStringList(contact.registrations || null);
  const leadIdBase = message.id || `${instanceId}:${normalizedPhone ?? document}:${timestamp ?? now}`;

  const queueId = await getDefaultQueueId(tenantId);
  if (!queueId) {
    logger.warn('🎯 LeadEngine • WhatsApp :: 🛎️ Fila padrão ausente — configure uma fila em Configurações → Filas para liberar o atendimento.', {
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
      tenantId,
      instanceId,
      messageId: message.id ?? null,
    });
    return;
  }

  const normalizedMessage = normalizeInboundMessage(message as InboundMessageDetails);

  const dedupeKey = `${tenantId}:${normalizedMessage.id}`;
  if (shouldSkipByDedupe(dedupeKey, now)) {
    logger.info('🎯 LeadEngine • WhatsApp :: ♻️ Mensagem ignorada (janela de dedupe em ação)', {
      tenantId,
      ticketId,
      brokerMessageId: normalizedMessage.id,
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
      error,
      tenantId,
      ticketId,
      messageId: message.id ?? null,
    });
  }

  if (persistedMessage) {
    await emitRealtimeUpdatesForInbound({
      tenantId,
      ticketId,
      instanceId,
      message: persistedMessage,
      providerMessageId: normalizedMessage.id ?? null,
    });
  }

  if (campaigns.length > 0) {
    for (const campaign of campaigns) {
      const agreementId = campaign.agreementId || 'unknown';
      const dedupeKey = `${tenantId}:${campaign.id}:${document || normalizedPhone || leadIdBase}`;

      if (shouldSkipByDedupe(dedupeKey, now)) {
        logger.info('🎯 LeadEngine • WhatsApp :: ⏱️ Mensagem já tratada nas últimas 24h — evitando duplicidade', {
          tenantId,
          campaignId: campaign.id,
          instanceId,
          messageId: message.id ?? null,
          phone: maskPhone(normalizedPhone ?? null),
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
        logger.error('🎯 LeadEngine • WhatsApp :: 🚨 Falha ao alocar lead inbound', {
          error,
          tenantId,
          campaignId: campaign.id,
          instanceId,
          phone: maskPhone(normalizedPhone ?? null),
        });
      }
    }
  }
};

