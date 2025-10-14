import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError } from '@ticketz/core';
import { Prisma } from '@prisma/client';

import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';
import { addAllocations } from '../../../data/lead-allocation-store';
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
  findOrCreateOpenTicketByChat,
  upsertMessageByExternalId,
  type PassthroughMessage,
} from '@ticketz/storage';
import {
  emitToAgreement,
  emitToTenant,
  emitToTicket,
  getSocketServer,
} from '../../../lib/socket-registry';
import { normalizeInboundMessage } from '../utils/normalize';

const DEFAULT_DEDUPE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_DEDUPE_CACHE_SIZE = 10_000;

type DedupeCacheEntry = {
  expiresAt: number;
};

const dedupeCache = new Map<string, DedupeCacheEntry>();

export interface InboundDedupeBackend {
  has(key: string): Promise<boolean>;
  set(key: string, ttlMs: number): Promise<void>;
}

let dedupeBackend: InboundDedupeBackend | null = null;

export const configureInboundDedupeBackend = (backend: InboundDedupeBackend | null): void => {
  dedupeBackend = backend;
};

const DEFAULT_QUEUE_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_QUEUE_FALLBACK_NAME = 'Atendimento Geral';
const DEFAULT_QUEUE_FALLBACK_DESCRIPTION =
  'Fila criada automaticamente para mensagens inbound do WhatsApp.';

const DEFAULT_CAMPAIGN_FALLBACK_NAME = 'WhatsApp • Inbound';
const DEFAULT_CAMPAIGN_FALLBACK_AGREEMENT_PREFIX = 'whatsapp-instance-fallback';

const DEFAULT_TENANT_ID = (() => {
  const envValue = process.env.AUTH_MVP_TENANT_ID;
  if (typeof envValue === 'string' && envValue.trim().length > 0) {
    return envValue.trim();
  }
  return 'demo-tenant';
})();

const toRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
};

const handlePassthroughIngest = async (event: InboundWhatsAppEvent): Promise<void> => {
  const toRecord = (value: unknown): Record<string, unknown> => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return { ...(value as Record<string, unknown>) };
    }
    return {};
  };

  const {
    instanceId,
    contact,
    message,
    timestamp,
    direction,
    chatId,
    externalId,
    tenantId: eventTenantId,
  } = event;

  const effectiveTenantId =
    (typeof eventTenantId === 'string' && eventTenantId.trim().length > 0 ? eventTenantId.trim() : null) ??
    DEFAULT_TENANT_ID;
  const metadataRecord = toRecord(event.metadata);
  const metadataContact = toRecord(metadataRecord.contact);
  const messageRecord = toRecord(message);

  const contactPhone = readString(contact.phone);
  const metadataContactPhone = readString(metadataContact.phone);
  const metadataRecordPhone = readString(metadataRecord.phone);
  const normalizedPhone =
    sanitizePhone(contactPhone) ??
    sanitizePhone(metadataContactPhone) ??
    sanitizePhone(metadataRecordPhone);
  const document = sanitizeDocument(readString(contact.document), normalizedPhone);

  const normalizedMessage = normalizeInboundMessage(message as InboundMessageDetails);
  const passthroughDirection =
    typeof direction === 'string' && direction.toUpperCase() === 'OUTBOUND' ? 'outbound' : 'inbound';

  const remoteJidCandidate =
    readString(chatId) ??
    readString(messageRecord.chatId) ??
    readString(metadataRecord.chatId) ??
    readString(metadataRecord.remoteJid) ??
    readString(metadataContact.remoteJid) ??
    readString(contact.phone);

  const resolvedChatId =
    remoteJidCandidate ??
    normalizedPhone ??
    document ??
    readString(externalId) ??
    normalizedMessage.id ??
    event.id ??
    randomUUID();

  const externalIdForUpsert =
    readString(externalId) ??
    readString(messageRecord.id) ??
    normalizedMessage.id ??
    event.id ??
    randomUUID();

  const normalizedType = normalizedMessage.type;
  let passthroughType: 'text' | 'media' | 'unknown' = 'unknown';
  let passthroughText: string | null = null;
  let passthroughMedia: {
    mediaType: string;
    url?: string | null;
    mimeType?: string | null;
    fileName?: string | null;
    size?: number | null;
    caption?: string | null;
  } | null = null;

  if (normalizedType === 'IMAGE' || normalizedType === 'VIDEO' || normalizedType === 'AUDIO' || normalizedType === 'DOCUMENT') {
    passthroughType = 'media';
    const mediaType = normalizedType.toLowerCase();
    passthroughText = normalizedMessage.caption ?? normalizedMessage.text ?? null;
    passthroughMedia = {
      mediaType,
      url: normalizedMessage.mediaUrl ?? null,
      mimeType: normalizedMessage.mimetype ?? null,
      size: normalizedMessage.fileSize ?? null,
      caption: normalizedMessage.caption ?? null,
    };
  } else if (
    normalizedType === 'TEXT' ||
    normalizedType === 'TEMPLATE' ||
    normalizedType === 'CONTACT' ||
    normalizedType === 'LOCATION'
  ) {
    passthroughType = 'text';
    passthroughText = normalizedMessage.text ?? null;
  } else {
    passthroughType = 'unknown';
    passthroughText = normalizedMessage.text ?? null;
  }

  const instanceIdentifier =
    typeof instanceId === 'string' && instanceId.trim().length > 0 ? instanceId.trim() : null;

  const metadataForUpsert = {
    ...metadataRecord,
    tenantId: effectiveTenantId,
    chatId: resolvedChatId,
    direction: passthroughDirection,
    sourceInstance: instanceIdentifier,
    remoteJid: remoteJidCandidate ?? resolvedChatId,
    phoneE164: normalizedPhone ?? null,
  };

  const displayName = pickPreferredName(
    contact.name,
    contact.pushName,
    readString(metadataContact.pushName)
  ) ?? 'Contato WhatsApp';

  const { ticket: passthroughTicket, wasCreated: ticketWasCreated } = await findOrCreateOpenTicketByChat({
    tenantId: effectiveTenantId,
    chatId: resolvedChatId,
    displayName,
    phone: normalizedPhone ?? resolvedChatId,
    instanceId: instanceIdentifier,
  });

  const { message: passthroughMessage, wasCreated: messageWasCreated } = await upsertMessageByExternalId({
    tenantId: effectiveTenantId,
    ticketId: passthroughTicket.id,
    chatId: resolvedChatId,
    direction: passthroughDirection,
    externalId: externalIdForUpsert,
    type: passthroughType,
    text: passthroughText,
    media: passthroughMedia,
    metadata: metadataForUpsert,
    timestamp: (() => {
      if (typeof normalizedMessage.brokerMessageTimestamp === 'number') {
        return normalizedMessage.brokerMessageTimestamp;
      }
      if (typeof timestamp === 'string') {
        const parsed = Date.parse(timestamp);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
      return Date.now();
    })(),
  });

  const socket = getSocketServer();
  if (socket) {
    socket.to(`tenant:${effectiveTenantId}`).emit('messages.new', passthroughMessage);
    socket.to(`ticket:${passthroughTicket.id}`).emit('messages.new', passthroughMessage);
  }

  logger.info('passthrough: persisted + emitted messages.new', {
    tenantId: effectiveTenantId,
    ticketId: passthroughTicket.id,
    direction: passthroughDirection,
    externalId: externalIdForUpsert,
    messageWasCreated,
    ticketWasCreated,
  });

  await emitPassthroughRealtimeUpdates({
    tenantId: effectiveTenantId,
    ticketId: passthroughTicket.id,
    instanceId: instanceIdentifier,
    message: passthroughMessage,
    ticketWasCreated,
  });

  inboundMessagesProcessedCounter.inc({
    origin: 'passthrough',
    tenantId: effectiveTenantId,
    instanceId: instanceIdentifier ?? 'unknown',
  });
};

type QueueCacheEntry = {
  id: string;
  expires: number;
};

const queueCacheByTenant = new Map<string, QueueCacheEntry>();

export const resetInboundLeadServiceTestState = (): void => {
  dedupeCache.clear();
  queueCacheByTenant.clear();
  dedupeBackend = null;
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

const resolveTicketAgreementId = (ticket: unknown): string | null => {
  if (!ticket || typeof ticket !== 'object') {
    return null;
  }

  const ticketRecord = ticket as Record<string, unknown> & {
    metadata?: Prisma.JsonValue | null;
  };

  const directAgreement = readString(ticketRecord['agreementId']);
  if (directAgreement) {
    return directAgreement;
  }

  const metadataRecord = toRecord(ticketRecord.metadata);
  return (
    readString(metadataRecord.agreementId) ??
    readString(metadataRecord.agreement_id) ??
    readNestedString(metadataRecord, ['agreement', 'id']) ??
    readNestedString(metadataRecord, ['agreement', 'agreementId']) ??
    null
  );
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
    readString(metadata['instanceId']),
    readString(metadata['instance_id']),
    readNestedString(metadata, ['broker', 'instanceId']),
    readNestedString(metadata, ['instance', 'id']),
    readNestedString(metadata, ['instance', 'instanceId']),
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

  const brokerLookupWhere: Prisma.WhatsAppInstanceWhereInput = { brokerId };

  if (tenant.id) {
    brokerLookupWhere.tenantId = tenant.id;
  }

  const existingByBroker = await prisma.whatsAppInstance.findFirst({ where: brokerLookupWhere });

  if (existingByBroker) {
    logger.warn('🎯 LeadEngine • WhatsApp :: 🔁 Reutilizando instância existente localizada por broker', {
      instanceId,
      tenantId: existingByBroker.tenantId,
      brokerId,
      requestId,
    });
    return existingByBroker;
  }

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
      const existingById = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });
      if (existingById) {
        logger.warn('🎯 LeadEngine • WhatsApp :: 🔁 Reutilizando instância existente após colisão de id', {
          instanceId,
          tenantId: existingById.tenantId,
          brokerId,
          requestId,
        });
        return existingById;
      }

      const existing =
        (await prisma.whatsAppInstance.findUnique({
          where: {
            tenantId_brokerId: {
              tenantId: tenant.id,
              brokerId,
            },
          },
        })) ??
        (await prisma.whatsAppInstance.findUnique({ where: { brokerId } })) ??
        (await prisma.whatsAppInstance.findFirst({ where: brokerLookupWhere }));
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
    if (storedAt.expiresAt <= now) {
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
  direction: 'INBOUND' | 'OUTBOUND';
  chatId: string | null;
  externalId?: string | null;
  timestamp: string | null;
  contact: InboundContactDetails;
  message: InboundMessageDetails;
  metadata?: Record<string, unknown> | null;
  tenantId?: string | null;
  sessionId?: string | null;
}

export interface InboundWhatsAppEnvelopeBase {
  origin: string;
  instanceId: string;
  chatId: string | null;
  tenantId: string | null;
  dedupeTtlMs?: number;
  raw?: Record<string, unknown> | null;
}

export interface InboundWhatsAppEnvelopeMessage extends InboundWhatsAppEnvelopeBase {
  message: {
    kind: 'message';
    id: string | null;
    externalId?: string | null;
    brokerMessageId?: string | null;
    timestamp: string | null;
    direction: 'INBOUND' | 'OUTBOUND';
    contact: InboundContactDetails;
    payload: InboundMessageDetails;
    metadata?: Record<string, unknown> | null;
  };
}

export interface InboundWhatsAppEnvelopeUpdate extends InboundWhatsAppEnvelopeBase {
  message: {
    kind: 'update';
    id: string;
    status?: string | null;
    timestamp?: string | null;
    metadata?: Record<string, unknown> | null;
  };
}

export type InboundWhatsAppEnvelope = InboundWhatsAppEnvelopeMessage | InboundWhatsAppEnvelopeUpdate;

const isMessageEnvelope = (
  envelope: InboundWhatsAppEnvelope
): envelope is InboundWhatsAppEnvelopeMessage => envelope.message.kind === 'message';

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

const shouldSkipByLocalDedupe = (key: string, now: number, ttlMs: number): boolean => {
  pruneDedupeCache(now);

  const entry = dedupeCache.get(key);
  if (entry && entry.expiresAt > now) {
    return true;
  }

  const expiresAt = now + ttlMs;
  dedupeCache.set(key, { expiresAt });
  return false;
};

export const shouldSkipByDedupe = async (key: string, now: number, ttlMs = DEFAULT_DEDUPE_TTL_MS): Promise<boolean> => {
  if (ttlMs <= 0) {
    return false;
  }

  if (dedupeBackend) {
    if (await dedupeBackend.has(key)) {
      return true;
    }

    try {
      await dedupeBackend.set(key, ttlMs);
    } catch (error) {
      logger.warn('whatsappInbound.dedupeCache.redisFallback', {
        key,
        ttlMs,
        error: mapErrorForLog(error),
      });
      return shouldSkipByLocalDedupe(key, now, ttlMs);
    }

    return false;
  }

  return shouldSkipByLocalDedupe(key, now, ttlMs);
};

const mapErrorForLog = (error: unknown) =>
  error instanceof Error ? { message: error.message, stack: error.stack } : error;

const emitPassthroughRealtimeUpdates = async ({
  tenantId,
  ticketId,
  instanceId,
  message,
  ticketWasCreated,
}: {
  tenantId: string;
  ticketId: string;
  instanceId: string | null;
  message: PassthroughMessage;
  ticketWasCreated: boolean;
}) => {
  try {
    const ticketRecord = await prisma.ticket.findUnique({ where: { id: ticketId } });

    if (!ticketRecord) {
      logger.warn('passthrough: skipped realtime updates due to missing ticket record', {
        tenantId,
        ticketId,
      });
      return;
    }

    const agreementId = resolveTicketAgreementId(ticketRecord);

    const ticketPayload = {
      tenantId,
      ticketId: ticketRecord.id,
      agreementId,
      instanceId: instanceId ?? null,
      messageId: message.id,
      providerMessageId: message.externalId ?? null,
      ticketStatus: ticketRecord.status,
      ticketUpdatedAt: ticketRecord.updatedAt?.toISOString?.() ?? new Date().toISOString(),
      ticket: ticketRecord,
    };

    emitToTicket(ticketRecord.id, 'tickets.updated', ticketPayload);
    emitToTenant(tenantId, 'tickets.updated', ticketPayload);
    if (agreementId) {
      emitToAgreement(agreementId, 'tickets.updated', ticketPayload);
    }

    if (ticketWasCreated) {
      emitToTicket(ticketRecord.id, 'tickets.new', ticketPayload);
      emitToTenant(tenantId, 'tickets.new', ticketPayload);
      if (agreementId) {
        emitToAgreement(agreementId, 'tickets.new', ticketPayload);
      }
    }
  } catch (error) {
    logger.error('passthrough: failed to emit ticket realtime events', {
      error: mapErrorForLog(error),
      tenantId,
      ticketId,
    });
  }
};

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

const provisionFallbackCampaignForInstance = async (
  tenantId: string,
  instanceId: string
) => {
  try {
    const campaign = await prisma.campaign.upsert({
      where: {
        tenantId_agreementId_whatsappInstanceId: {
          tenantId,
          agreementId: `${DEFAULT_CAMPAIGN_FALLBACK_AGREEMENT_PREFIX}:${instanceId}`,
          whatsappInstanceId: instanceId,
        },
      },
      update: {
        status: 'active',
        name: DEFAULT_CAMPAIGN_FALLBACK_NAME,
        agreementName: DEFAULT_CAMPAIGN_FALLBACK_NAME,
        metadata: {
          fallback: true,
          source: 'whatsapp-inbound',
        } as Prisma.InputJsonValue,
      },
      create: {
        tenantId,
        name: DEFAULT_CAMPAIGN_FALLBACK_NAME,
        agreementId: `${DEFAULT_CAMPAIGN_FALLBACK_AGREEMENT_PREFIX}:${instanceId}`,
        agreementName: DEFAULT_CAMPAIGN_FALLBACK_NAME,
        whatsappInstanceId: instanceId,
        status: 'active',
        metadata: {
          fallback: true,
          source: 'whatsapp-inbound',
        } as Prisma.InputJsonValue,
      },
    });

    logger.info('🎯 LeadEngine • WhatsApp :: 🧱 Campanha fallback provisionada automaticamente', {
      tenantId,
      instanceId,
      campaignId: campaign.id,
    });

    return campaign;
  } catch (error) {
    logger.error('🎯 LeadEngine • WhatsApp :: ⚠️ Falha ao provisionar campanha fallback', {
      error: mapErrorForLog(error),
      tenantId,
      instanceId,
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
  attemptAutoProvisionWhatsAppInstance,
  pruneDedupeCache,
  getDefaultQueueId,
  ensureTicketForContact,
  upsertLeadFromInbound,
  emitPassthroughRealtimeUpdates,
  emitRealtimeUpdatesForInbound,
  provisionFallbackCampaignForInstance,
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

  if (!base.chatId && chatId) {
    base.chatId = chatId;
  }
  if (!base.tenantId && envelope.tenantId) {
    base.tenantId = envelope.tenantId;
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

  const tenantId = messageEnvelope.tenantId ?? DEFAULT_TENANT_ID;
  const chatId = resolveEnvelopeChatId(messageEnvelope);
  const messageId = resolveEnvelopeMessageId(messageEnvelope) ?? randomUUID();
  const now = Date.now();
  const dedupeTtlMs = messageEnvelope.dedupeTtlMs ?? DEFAULT_DEDUPE_TTL_MS;
  const keyChatId = chatId ?? '__unknown__';
  const dedupeKey = `${tenantId}:${messageEnvelope.instanceId}:${keyChatId}:${messageId}`;

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
    return false;
  }

  const metadata = mergeEnvelopeMetadata(messageEnvelope, chatId);

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

  if (passthroughMode) {
    await handlePassthroughIngest(event);
    return true;
  }

  await processStandardInboundEvent(event, now, { passthroughMode, simpleMode });
  return true;
};

const processStandardInboundEvent = async (
  event: InboundWhatsAppEvent,
  now: number,
  {
    passthroughMode,
    simpleMode,
  }: {
    passthroughMode: boolean;
    simpleMode: boolean;
  }
): Promise<void> => {
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

  const normalizedPhone = sanitizePhone(contact.phone);
  const document = sanitizeDocument(contact.document, normalizedPhone);
  const metadataRecord = toRecord(event.metadata);
  const requestId = readString(metadataRecord['requestId']);
  const resolvedBrokerId = resolveBrokerIdFromMetadata(metadataRecord);
  const metadataContact = toRecord(metadataRecord.contact);
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
  const metadataTenantId = readString(metadataRecord['tenantId']);
  const tenantIdForBrokerLookup = normalizedEventTenantId ?? metadataTenantId ?? null;

  metadataRecord.direction = direction;
  if (chatId && !metadataRecord.chatId) {
    metadataRecord.chatId = chatId;
  }
  if (eventTenantId && !metadataRecord.tenantId) {
    metadataRecord.tenantId = eventTenantId;
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
  } else {
    metadataRecord.broker = {
      direction,
      instanceId,
    };
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

  let instance: WhatsAppInstanceRecord | null = null;

  if (resolvedBrokerId) {
    const brokerLookupWhere: Prisma.WhatsAppInstanceWhereInput = { brokerId: resolvedBrokerId };

    if (tenantIdForBrokerLookup) {
      brokerLookupWhere.tenantId = tenantIdForBrokerLookup;
    }

    instance = await prisma.whatsAppInstance.findFirst({ where: brokerLookupWhere });
  }

  if (!instance) {
    instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });
  }

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
    return;
  }

  let persistedMessage: Awaited<ReturnType<typeof sendMessageService>> | null = null;

  const normalizedMessageMedia =
    normalizedMessage.media && typeof normalizedMessage.media === 'object'
      ? (normalizedMessage.media as Record<string, unknown>)
      : null;
  const timelineMessageType = (() => {
    if (normalizedMessage.type === 'media') {
      const mediaType = readString(normalizedMessageMedia?.mediaType) ?? '';
      if (mediaType === 'image' || mediaType === 'sticker') {
        return 'IMAGE';
      }
      if (mediaType === 'video') {
        return 'VIDEO';
      }
      if (mediaType === 'audio') {
        return 'AUDIO';
      }
      return 'DOCUMENT';
    }

    if (normalizedMessage.type === 'text') {
      return 'TEXT';
    }

    if (normalizedMessage.type === 'unknown') {
      return 'TEXT';
    }

    return normalizedMessage.type;
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

      const brokerLead = {
        id: campaignId ? `${leadIdBase}:${campaignId}` : `${leadIdBase}:instance:${instanceId}`,
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
        const { newlyAllocated, summary } = await addAllocations(tenantId, target, [brokerLead]);
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
};
