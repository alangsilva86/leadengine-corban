import { ConflictError, NotFoundError, ServiceUnavailableError, ValidationError } from '@ticketz/core';
import type {
  Contact,
  CreateTicketDTO,
  Lead,
  Message,
  Pagination,
  PaginatedResult,
  SendMessageDTO,
  Ticket,
  TicketFilters,
  TicketStatus,
  UpdateTicketDTO,
} from '../types/tickets';
import { Prisma } from '@prisma/client';
import {
  assignTicket as storageAssignTicket,
  closeTicket as storageCloseTicket,
  createMessage as storageCreateMessage,
  createTicket as storageCreateTicket,
  findTicketById as storageFindTicketById,
  findTicketsByContact,
  findMessageByExternalId as storageFindMessageByExternalId,
  listMessages as storageListMessages,
  listTickets as storageListTickets,
  updateMessage as storageUpdateMessage,
  updateTicket as storageUpdateTicket,
} from '@ticketz/storage';
import { emitToAgreement, emitToTenant, emitToTicket, emitToUser } from '../lib/socket-registry';
import { prisma } from '../lib/prisma';
import {
  createTicketNote,
  listTicketNotes,
  type TicketNote,
  type TicketNoteVisibility,
} from '../data/ticket-note-store';
import { logger } from '../config/logger';
import {
  whatsappOutboundMetrics,
  whatsappOutboundDeliverySuccessCounter,
  whatsappSocketReconnectsCounter,
} from '../lib/metrics';
import { WhatsAppBrokerError, translateWhatsAppBrokerError } from './whatsapp-broker-client';
import {
  getWhatsAppTransport,
  type WhatsAppTransport,
  type WhatsAppTransportSendMessagePayload,
} from '../features/whatsapp-transport';
import type { WhatsAppCanonicalError } from '@ticketz/wa-contracts';
import { WhatsAppTransportError } from '@ticketz/wa-contracts';
import { assertWithinRateLimit, RateLimitError } from '../utils/rate-limit';
import { normalizePhoneNumber, PhoneNormalizationError } from '../utils/phone';
import {
  getIdempotentValue,
  hashIdempotentPayload,
  rememberIdempotency,
} from '../utils/idempotency';
import {
  normalizeContactsPayload,
  normalizeLocationPayload,
  normalizeTemplatePayload,
} from '../utils/message-normalizers';
import {
  assertCircuitClosed,
  buildCircuitBreakerKey,
  getCircuitBreakerConfig,
  recordCircuitFailure,
  recordCircuitSuccess,
} from '../utils/circuit-breaker';
import type {
  NormalizedMessagePayload,
  OutboundMessageError,
  OutboundMessageResponse,
} from '@ticketz/contracts';

const OPEN_STATUSES = new Set(['OPEN', 'PENDING', 'ASSIGNED']);

const normalizeNullableString = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const ENRICHMENT_METADATA_KEYS = [
  'sourceInstance',
  'campaignId',
  'campaignName',
  'productType',
  'strategy',
] as const;

const normalizeEnrichmentValue = (
  value: unknown
): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
};

const mergeEnrichmentMetadata = (
  target: Record<string, unknown>,
  ...sources: Array<Record<string, unknown> | null | undefined>
): void => {
  for (const key of ENRICHMENT_METADATA_KEYS) {
    if (target[key] !== undefined) {
      const normalized = normalizeEnrichmentValue(target[key]);
      if (normalized === undefined) {
        delete target[key];
      } else {
        target[key] = normalized;
      }
      continue;
    }

    for (const source of sources) {
      if (!source || !(key in source)) {
        continue;
      }
      const normalized = normalizeEnrichmentValue(source[key]);
      if (normalized === undefined) {
        continue;
      }
      target[key] = normalized;
      break;
    }
  }
};

const syncContactPrimaryPhone = async (
  tenantId: string,
  contactId: string,
  phone: string | null | undefined
): Promise<void> => {
  const normalized = normalizeNullableString(phone);

  await prisma.contactPhone.updateMany({
    where: { tenantId, contactId, isPrimary: true },
    data: { isPrimary: false },
  });

  if (!normalized) {
    return;
  }

  await prisma.contactPhone.upsert({
    where: {
      tenantId_phoneNumber: {
        tenantId,
        phoneNumber: normalized,
      },
    },
    update: {
      contactId,
      isPrimary: true,
    },
    create: {
      tenantId,
      contactId,
      phoneNumber: normalized,
      type: 'MOBILE',
      label: 'Principal',
      isPrimary: true,
    },
  });
};

type WhatsAppTransportDependencies = {
  transport?: WhatsAppTransport;
  emitMessageUpdatedEvents?: typeof emitMessageUpdatedEvents;
};

type WhatsAppInstanceForDispatch = {
  id: string;
  brokerId: string | null;
};

type DispatchInstanceResolution = {
  dispatchInstanceId: string | null;
  brokerId: string | null;
};

export const resolveDispatchInstanceId = async (
  instanceId: string | null | undefined,
  instance?: WhatsAppInstanceForDispatch | null
): Promise<DispatchInstanceResolution> => {
  if (!instanceId) {
    return { dispatchInstanceId: null, brokerId: null };
  }

  const record =
    instance ??
    (await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        brokerId: true,
      },
    }));

  if (!record) {
    throw new NotFoundError('WhatsAppInstance', instanceId);
  }

  return {
    dispatchInstanceId: record.brokerId ?? record.id,
    brokerId: record.brokerId,
  };
};

const OUTBOUND_TPS_DEFAULT = (() => {
  const raw = process.env.OUTBOUND_TPS_DEFAULT;
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
})();

const OUTBOUND_TPS_OVERRIDES = (() => {
  const map = new Map<string, number>();
  const raw = process.env.OUTBOUND_TPS_BY_INSTANCE;
  if (!raw) {
    return map;
  }

  raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .forEach((entry) => {
      const [id, limitRaw] = entry.split(':').map((value) => value.trim());
      const parsed = Number.parseInt(limitRaw ?? '', 10);
      if (id && Number.isFinite(parsed) && parsed > 0) {
        map.set(id, parsed);
      }
    });

  return map;
})();

const IDEMPOTENCY_TTL_MS = (() => {
  const raw = process.env.OUTBOUND_IDEMPOTENCY_TTL_MS;
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 24 * 60 * 60 * 1000;
})();

export const resolveInstanceRateLimit = (instanceId: string | null | undefined): number => {
  if (!instanceId) {
    return OUTBOUND_TPS_DEFAULT;
  }

  return OUTBOUND_TPS_OVERRIDES.get(instanceId) ?? OUTBOUND_TPS_DEFAULT;
};

export const rateKeyForInstance = (tenantId: string, instanceId: string): string =>
  `whatsapp:${tenantId}:${instanceId}`;

const defaultQueueCache = new Map<string, string>();

const resolveDefaultQueueId = async (tenantId: string): Promise<string> => {
  if (defaultQueueCache.has(tenantId)) {
    return defaultQueueCache.get(tenantId) as string;
  }

  const queue = await prisma.queue.findFirst({
    where: { tenantId },
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
  });

  if (!queue) {
    const fallbackName = 'Atendimento Geral';
    const fallbackQueue = await prisma.queue.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: fallbackName,
        },
      },
      update: {},
      create: {
        tenantId,
        name: fallbackName,
        description: 'Fila criada automaticamente para envios de WhatsApp.',
        color: '#3B82F6',
        orderIndex: 0,
      },
    });

    defaultQueueCache.set(tenantId, fallbackQueue.id);
    return fallbackQueue.id;
  }

  defaultQueueCache.set(tenantId, queue.id);
  return queue.id;
};

export const getDefaultQueueIdForTenant = async (tenantId: string): Promise<string> =>
  resolveDefaultQueueId(tenantId);

const buildOutboundResponse = (message: Message): OutboundMessageResponse => {
  const brokerMeta =
    message.metadata && typeof message.metadata === 'object'
      ? ((message.metadata as Record<string, unknown>).broker as Record<string, unknown> | undefined)
      : undefined;

  let error: OutboundMessageError | null = null;

  if (brokerMeta?.error && typeof brokerMeta.error === 'object') {
    const rawError = brokerMeta.error as Record<string, unknown>;
    const normalizedError: OutboundMessageError = {
      message: typeof rawError.message === 'string' ? rawError.message : 'unknown_error',
    };

    if (typeof rawError.code === 'string') {
      normalizedError.code = rawError.code;
    }

    if (typeof rawError.status === 'number') {
      normalizedError.status = rawError.status;
    }

    if (typeof rawError.requestId === 'string') {
      normalizedError.requestId = rawError.requestId;
    }

    error = normalizedError;
  } else if (typeof brokerMeta?.error === 'string' && brokerMeta.error.length > 0) {
    error = { message: brokerMeta.error };
  }

  return {
    queued: true,
    ticketId: message.ticketId,
    messageId: message.id,
    status: message.status,
    externalId: message.externalId ?? null,
    error,
  } satisfies OutboundMessageResponse;
};

const isPrismaKnownError = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError;

const extractPrismaFieldNames = (error: Prisma.PrismaClientKnownRequestError): string[] => {
  const raw = error.meta?.field_name;

  if (Array.isArray(raw)) {
    return raw.map((value) => String(value));
  }

  if (typeof raw === 'string') {
    return raw
      .replace(/[()"']/g, ' ')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  return [];
};

const isForeignKeyViolation = (error: unknown, field: string): boolean => {
  if (!isPrismaKnownError(error) || error.code !== 'P2003') {
    return false;
  }

  const fieldNames = extractPrismaFieldNames(error).map((name) => name.split('.').pop() ?? name);
  return fieldNames.includes(field);
};

const isUniqueViolation = (error: unknown): boolean => isPrismaKnownError(error) && error.code === 'P2002';

const handleDatabaseError = (error: unknown, context: Record<string, unknown> = {}): never => {
  logger.error('ticketService.databaseError', {
    ...context,
    error:
      error instanceof Error
        ? { message: error.message, name: error.name, code: (error as { code?: unknown }).code ?? null }
        : error,
  });

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    throw new ServiceUnavailableError('Falha de conectividade com o banco de dados.', { cause: error });
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    throw new ValidationError('Parâmetros inválidos para a operação no banco de dados.', { cause: error });
  }

  if (isUniqueViolation(error)) {
    throw new ConflictError('Operação violou uma restrição de unicidade no banco de dados.', { cause: error });
  }

  throw error;
};

export type TicketIncludeOption = 'contact' | 'lead' | 'notes';

export type TicketContactSummary = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  document?: string | null;
  avatar?: string | null;
  consent?: {
    granted: boolean;
    base?: string | null;
    grantedAt?: Date | null;
  } | null;
};

export type TicketLeadSummary = Pick<Lead, 'id' | 'status' | 'value' | 'probability' | 'source' | 'tags'> & {
  expectedCloseDate?: Date | null;
  lastContactAt?: Date | null;
  nextFollowUpAt?: Date | null;
  qualityRating?: number | null;
};

export type TicketWindowSnapshot = {
  expiresAt: Date | null;
  remainingMinutes: number | null;
  isOpen: boolean;
};

export type TicketTimelineSnapshot = {
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
  lastDirection: Message['direction'] | null;
  messageCount: number;
  inboundCount: number;
  outboundCount: number;
  unreadInboundCount: number;
  firstInboundAt: Date | null;
  firstOutboundAt: Date | null;
  firstResponseMinutes: number | null;
};

export type TicketHydrated = Ticket & {
  contact?: TicketContactSummary | null;
  lead?: TicketLeadSummary | null;
  notes?: TicketNote[];
  window?: TicketWindowSnapshot;
  timeline?: TicketTimelineSnapshot;
  pipelineStep?: string | null;
  qualityScore?: number | null;
};

export type InboxHealthMetrics = {
  firstResponse: {
    medianMinutes: number | null;
    p90Minutes: number | null;
    underFiveMinutesRate: number | null;
  };
  statusEntropy: number | null;
  proposalToCcbRate: number | null;
  handleTimeByStage: Record<string, number>;
  whatsappQuality: {
    errorRatePerThousand: number | null;
    qualityTier: 'high' | 'medium' | 'low' | null;
    throughputLimit: number | null;
  };
};

export type TicketListResult = PaginatedResult<TicketHydrated> & {
  metrics?: InboxHealthMetrics;
};

export type CreateTicketNoteInput = {
  body: string;
  visibility?: TicketNoteVisibility;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

type TicketNoteAuthor = {
  id: string;
  name?: string | null;
  avatar?: string | null;
};

const emitTicketEvent = (
  tenantId: string,
  ticketId: string,
  event: string,
  payload: unknown,
  userId?: string | null,
  agreementId?: string | null
) => {
  emitToTenant(tenantId, event, payload);
  emitToTicket(ticketId, event, payload);
  if (agreementId) {
    emitToAgreement(agreementId, event, payload);
  }
  if (userId) {
    emitToUser(userId, event, payload);
  }
};

type MessageRealtimeEnvelope = {
  tenantId: string;
  ticketId: string;
  agreementId: string | null;
  instanceId: string | null;
  messageId: string;
  providerMessageId: string | null;
  ticketStatus: TicketStatus;
  ticketUpdatedAt: string;
  message: Message;
};

type TicketRealtimeEnvelope = {
  tenantId: string;
  ticketId: string;
  agreementId: string | null;
  instanceId: string | null;
  messageId: string | null;
  providerMessageId: string | null;
  ticketStatus: TicketStatus;
  ticketUpdatedAt: string;
  ticket: Ticket;
};

const resolveTicketAgreementId = (ticket: Ticket): string | null => {
  const agreementId = (ticket as Ticket & { agreementId?: string | null }).agreementId;
  if (typeof agreementId === 'string' && agreementId.trim().length > 0) {
    return agreementId.trim();
  }

  if (ticket.metadata && typeof ticket.metadata === 'object') {
    const metadata = ticket.metadata as Record<string, unknown>;
    const direct = metadata['agreementId'];
    if (typeof direct === 'string' && direct.trim().length > 0) {
      return direct.trim();
    }

    const snakeCase = metadata['agreement_id'];
    if (typeof snakeCase === 'string' && snakeCase.trim().length > 0) {
      return snakeCase.trim();
    }

    const nested = metadata['agreement'];
    if (nested && typeof nested === 'object') {
      const nestedId = (nested as Record<string, unknown>)['id'];
      if (typeof nestedId === 'string' && nestedId.trim().length > 0) {
        return nestedId.trim();
      }

      const nestedAgreementId = (nested as Record<string, unknown>)['agreementId'];
      if (typeof nestedAgreementId === 'string' && nestedAgreementId.trim().length > 0) {
        return nestedAgreementId.trim();
      }
    }
  }

  return null;
};

const buildRealtimeEnvelopeBase = ({
  tenantId,
  ticket,
  message,
  messageId,
  providerMessageId,
  instanceId,
}: {
  tenantId: string;
  ticket: Ticket;
  message?: Message | null;
  messageId?: string | null;
  providerMessageId?: string | null;
  instanceId?: string | null;
}): Omit<TicketRealtimeEnvelope, 'ticket'> => {
  const agreementId = resolveTicketAgreementId(ticket);
  const resolvedMessageId = message?.id ?? messageId ?? null;
  const resolvedProviderMessageId = providerMessageId ?? null;
  const resolvedInstanceId = instanceId ?? message?.instanceId ?? resolveWhatsAppInstanceId(ticket) ?? null;
  const updatedAtIso =
    (ticket.updatedAt instanceof Date ? ticket.updatedAt : null)?.toISOString() ?? new Date().toISOString();

  return {
    tenantId,
    ticketId: ticket.id,
    agreementId,
    instanceId: resolvedInstanceId,
    messageId: resolvedMessageId,
    providerMessageId: resolvedProviderMessageId,
    ticketStatus: ticket.status,
    ticketUpdatedAt: updatedAtIso,
  };
};

const buildMessageRealtimeEnvelope = ({
  tenantId,
  ticket,
  message,
  instanceId,
  providerMessageId,
}: {
  tenantId: string;
  ticket: Ticket;
  message: Message;
  instanceId?: string | null;
  providerMessageId?: string | null;
}): MessageRealtimeEnvelope => {
  const base = buildRealtimeEnvelopeBase({
    tenantId,
    ticket,
    message,
    messageId: message.id,
    providerMessageId: providerMessageId ?? null,
    instanceId: instanceId ?? null,
  });

  return {
    tenantId: base.tenantId,
    ticketId: base.ticketId,
    agreementId: base.agreementId,
    instanceId: base.instanceId,
    messageId: message.id,
    providerMessageId: base.providerMessageId,
    ticketStatus: base.ticketStatus,
    ticketUpdatedAt: base.ticketUpdatedAt,
    message,
  };
};

const buildTicketRealtimeEnvelope = ({
  tenantId,
  ticket,
  message,
  messageId,
  providerMessageId,
  instanceId,
}: {
  tenantId: string;
  ticket: Ticket;
  message?: Message | null;
  messageId?: string | null;
  providerMessageId?: string | null;
  instanceId?: string | null;
}): TicketRealtimeEnvelope => {
  const base = buildRealtimeEnvelopeBase({
    tenantId,
    ticket,
    message: message ?? null,
    messageId: messageId ?? null,
    providerMessageId: providerMessageId ?? null,
    instanceId: instanceId ?? null,
  });

  return {
    ...base,
    ticket,
  };
};

const emitTicketRealtimeEnvelope = (
  tenantId: string,
  ticket: Ticket,
  envelope: TicketRealtimeEnvelope,
  userId?: string | null
) => {
  const agreementId = resolveTicketAgreementId(ticket);
  emitTicketEvent(tenantId, ticket.id, 'tickets.updated', envelope, userId ?? null, agreementId);
};

const emitMessageCreatedEvents = (
  tenantId: string,
  ticket: Ticket,
  message: Message,
  options: {
    userId?: string | null;
    instanceId?: string | null;
    providerMessageId?: string | null;
  } = {}
) => {
  const envelope = buildMessageRealtimeEnvelope({
    tenantId,
    ticket,
    message,
    instanceId: options.instanceId ?? null,
    providerMessageId: options.providerMessageId ?? null,
  });

  emitTicketEvent(
    tenantId,
    ticket.id,
    'messages.new',
    envelope,
    options.userId,
    resolveTicketAgreementId(ticket)
  );

  const ticketEnvelope = buildTicketRealtimeEnvelope({
    tenantId,
    ticket,
    message,
    instanceId: options.instanceId ?? null,
    providerMessageId: options.providerMessageId ?? null,
  });

  emitTicketRealtimeEnvelope(tenantId, ticket, ticketEnvelope, options.userId ?? null);
};

export const emitMessageUpdatedEvents = async (
  tenantId: string,
  ticketId: string,
  message: Message,
  userId?: string | null,
  ticket?: Ticket | null
) => {
  emitTicketEvent(tenantId, ticketId, 'message:updated', message, userId);
  emitTicketEvent(
    tenantId,
    ticketId,
    'message.status.changed',
    {
      ticketId,
      messageId: message.id,
      status: message.status,
    },
    userId
  );

  const resolvedTicket =
    ticket ?? (await storageFindTicketById(tenantId, ticketId).catch(() => Promise.resolve(null)));

  if (resolvedTicket) {
    const providerMessageId = resolveProviderMessageId(message.metadata);
    const messageEnvelope = buildMessageRealtimeEnvelope({
      tenantId,
      ticket: resolvedTicket,
      message,
      instanceId: message.instanceId ?? null,
      providerMessageId,
    });

    emitTicketEvent(
      tenantId,
      ticketId,
      'messages.updated',
      messageEnvelope,
      userId,
      resolveTicketAgreementId(resolvedTicket)
    );

    const ticketEnvelope = buildTicketRealtimeEnvelope({
      tenantId,
      ticket: resolvedTicket,
      message,
      instanceId: message.instanceId ?? null,
      providerMessageId,
    });

    emitTicketRealtimeEnvelope(tenantId, resolvedTicket, ticketEnvelope, userId ?? null);
  }
};

const resolveWhatsAppInstanceId = (ticket: Ticket | null | undefined): string | null => {
  if (!ticket || !ticket.metadata || typeof ticket.metadata !== 'object') {
    return null;
  }

  const metadata = ticket.metadata as Record<string, unknown>;
  const directCandidates = [
    metadata['whatsappInstanceId'],
    metadata['instanceId'],
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  const whatsappRecord = metadata['whatsapp'];
  if (whatsappRecord && typeof whatsappRecord === 'object') {
    const instanceId = (whatsappRecord as Record<string, unknown>)['instanceId'];
    if (typeof instanceId === 'string' && instanceId.trim().length > 0) {
      return instanceId.trim();
    }
  }

  return null;
};

export const normalizeBrokerStatus = (status: string | undefined): Message['status'] => {
  const normalized = (status || '').trim().toUpperCase();
  switch (normalized) {
    case 'DELIVERED':
      return 'DELIVERED';
    case 'READ':
    case 'SEEN':
      return 'READ';
    case 'FAILED':
    case 'ERROR':
      return 'FAILED';
    case 'PENDING':
      return 'PENDING';
    default:
      return 'SENT';
  }
};

const resolveProviderMessageId = (metadata: unknown): string | null => {
  const readCandidate = (value: unknown): string | null => {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const metadataRecord = metadata as Record<string, unknown>;
  const broker = metadataRecord.broker as Record<string, unknown> | undefined;
  const candidates: (string | null | undefined)[] = [
    readCandidate(metadataRecord.providerMessageId),
    readCandidate(metadataRecord.providerId),
    readCandidate(metadataRecord.externalId),
    readCandidate(metadataRecord.messageId),
  ];

  if (broker && typeof broker === 'object') {
    candidates.push(
      readCandidate(broker.providerMessageId),
      readCandidate(broker.messageId),
      readCandidate(broker.wamid),
      readCandidate(broker.id)
    );
  }

  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }

  return null;
};

type ConversationComputation = {
  timeline: TicketTimelineSnapshot;
  window: TicketWindowSnapshot;
  failedCount: number;
  durationMinutes: number | null;
  totalMessages: number;
};

const MINUTES_IN_MS = 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * MINUTES_IN_MS;

const computeConversationStats = (messages: Message[]): ConversationComputation => {
  if (messages.length === 0) {
    return {
      timeline: {
        lastInboundAt: null,
        lastOutboundAt: null,
        lastDirection: null,
        messageCount: 0,
        inboundCount: 0,
        outboundCount: 0,
        unreadInboundCount: 0,
        firstInboundAt: null,
        firstOutboundAt: null,
        firstResponseMinutes: null,
      },
      window: {
        expiresAt: null,
        remainingMinutes: null,
        isOpen: false,
      },
      failedCount: 0,
      durationMinutes: null,
      totalMessages: 0,
    };
  }

  const sorted = [...messages].sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));

  let lastInboundAt: Date | null = null;
  let lastOutboundAt: Date | null = null;
  let lastDirection: Message['direction'] | null = null;
  let inboundCount = 0;
  let outboundCount = 0;
  let unreadInboundCount = 0;
  let pendingResponseSince: Date | null = null;
  let firstInboundAt: Date | null = null;
  let firstOutboundAt: Date | null = null;
  let firstResponseMinutes: number | null = null;
  let failedCount = 0;

  for (const entry of sorted) {
    lastDirection = entry.direction;

    if (entry.direction === 'INBOUND') {
      inboundCount += 1;
      lastInboundAt = entry.createdAt;
      pendingResponseSince = entry.createdAt;
      unreadInboundCount += 1;

      if (!firstInboundAt) {
        firstInboundAt = entry.createdAt;
      }
    } else {
      outboundCount += 1;
      lastOutboundAt = entry.createdAt;
      if (!firstOutboundAt) {
        firstOutboundAt = entry.createdAt;
      }

      if (pendingResponseSince && firstResponseMinutes === null) {
        const diffMinutes = (entry.createdAt.getTime() - pendingResponseSince.getTime()) / MINUTES_IN_MS;
        firstResponseMinutes = diffMinutes >= 0 ? Math.round(diffMinutes * 100) / 100 : 0;
      }

      pendingResponseSince = null;
      unreadInboundCount = 0;
    }

    if (entry.status === 'FAILED') {
      failedCount += 1;
    }
  }

  const firstMessageAt = sorted[0]?.createdAt ?? null;
  const lastMessageAt = sorted[sorted.length - 1]?.createdAt ?? null;
  const durationMinutes =
    firstMessageAt && lastMessageAt
      ? Math.max(0, Math.round(((lastMessageAt.getTime() - firstMessageAt.getTime()) / MINUTES_IN_MS) * 100) / 100)
      : null;

  const now = new Date();
  const expiresAt = lastInboundAt ? new Date(lastInboundAt.getTime() + TWENTY_FOUR_HOURS_MS) : null;
  const remainingMinutes = expiresAt ? Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / MINUTES_IN_MS)) : null;
  const isOpen = expiresAt ? expiresAt.getTime() > now.getTime() : false;

  return {
    timeline: {
      lastInboundAt,
      lastOutboundAt,
      lastDirection,
      messageCount: sorted.length,
      inboundCount,
      outboundCount,
      unreadInboundCount,
      firstInboundAt,
      firstOutboundAt,
      firstResponseMinutes,
    },
    window: {
      expiresAt,
      remainingMinutes,
      isOpen,
    },
    failedCount,
    durationMinutes,
    totalMessages: sorted.length,
  };
};

const fetchAllMessagesForTicket = async (tenantId: string, ticketId: string): Promise<Message[]> => {
  const accumulated: Message[] = [];
  let page = 1;
  const limit = 200;

  while (page <= 10) {
    const pageResult = await storageListMessages(tenantId, { ticketId }, {
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });

    accumulated.push(...pageResult.items);

    if (!pageResult.hasNext) {
      break;
    }

    page += 1;
  }

  return accumulated;
};

const fetchConversationStatsForTickets = async (
  tenantId: string,
  tickets: Ticket[]
): Promise<Map<string, ConversationComputation>> => {
  const statsEntries = await Promise.all(
    tickets.map(async (ticket) => {
      const messages = await fetchAllMessagesForTicket(tenantId, ticket.id);
      const stats = computeConversationStats(messages);
      return [ticket.id, stats] as const;
    })
  );

  return new Map(statsEntries);
};

const safeResolveContacts = async (
  tenantId: string,
  contactIds: string[]
): Promise<Map<string, TicketContactSummary>> => {
  if (contactIds.length === 0) {
    return new Map();
  }

  try {
    const records = await prisma.contact.findMany({
      where: {
        tenantId,
        id: { in: contactIds },
      },
    });

    return new Map(
      records.map((contact) => {
        const consent =
          contact.customFields && typeof contact.customFields === 'object' && 'consent' in contact.customFields
            ? ((contact.customFields as Record<string, unknown>).consent ?? null)
            : null;

        const normalizedConsent =
          consent && typeof consent === 'object'
            ? {
                granted: Boolean((consent as { granted?: unknown }).granted ?? false),
                base: (consent as { base?: unknown }).base ? String((consent as { base?: unknown }).base) : null,
                grantedAt:
                  (consent as { grantedAt?: unknown }).grantedAt &&
                  typeof (consent as { grantedAt?: unknown }).grantedAt === 'string'
                    ? new Date(String((consent as { grantedAt?: unknown }).grantedAt))
                    : null,
              }
            : null;

        const fullName = typeof contact.fullName === 'string' && contact.fullName.trim().length > 0 ? contact.fullName.trim() : null;
        const displayName = typeof contact.displayName === 'string' && contact.displayName.trim().length > 0 ? contact.displayName.trim() : null;
        const composedName = [contact.firstName, contact.lastName]
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .map((value) => value.trim())
          .join(' ');
        const fallbackName = composedName.length > 0 ? composedName : null;

        const summary: TicketContactSummary = {
          id: contact.id,
          name: fullName ?? displayName ?? fallbackName ?? 'Contato',
          phone: typeof contact.primaryPhone === 'string' && contact.primaryPhone.trim().length > 0 ? contact.primaryPhone.trim() : null,
          email: typeof contact.primaryEmail === 'string' && contact.primaryEmail.trim().length > 0 ? contact.primaryEmail.trim() : null,
          document: contact.document ?? null,
          avatar: contact.avatar ?? null,
          consent: normalizedConsent,
        };

        return [contact.id, summary] as const;
      })
    );
  } catch (error) {
    logger.warn('ticketService.resolveContacts.failed', {
      tenantId,
      contactIds,
      error,
    });
    return new Map();
  }
};

const safeResolveLeads = async (
  tenantId: string,
  contactIds: string[]
): Promise<Map<string, TicketLeadSummary>> => {
  if (contactIds.length === 0) {
    return new Map();
  }

  try {
    const records = await prisma.lead.findMany({
      where: {
        tenantId,
        contactId: { in: contactIds },
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const leadByContact = new Map<string, TicketLeadSummary>();
    for (const record of records) {
      if (leadByContact.has(record.contactId)) {
        continue;
      }

      leadByContact.set(record.contactId, {
        id: record.id,
        status: record.status,
        value: record.value ?? undefined,
        probability: record.probability ?? undefined,
        source: record.source,
        tags: record.tags ?? [],
        expectedCloseDate: record.expectedCloseDate ?? null,
        lastContactAt: record.lastContactAt ?? null,
        nextFollowUpAt: record.nextFollowUpAt ?? null,
        qualityRating:
          typeof record.customFields === 'object' && record.customFields !== null && 'qualityRating' in record.customFields
            ? Number((record.customFields as Record<string, unknown>).qualityRating)
            : null,
      });
    }

    return leadByContact;
  } catch (error) {
    logger.warn('ticketService.resolveLeads.failed', {
      tenantId,
      contactIds,
      error,
    });
    return new Map();
  }
};

const resolveTicketNotes = async (
  tenantId: string,
  tickets: Ticket[]
): Promise<Map<string, TicketNote[]>> => {
  const entries = await Promise.all(
    tickets.map(async (ticket) => {
      const notes = await listTicketNotes(tenantId, ticket.id);
      return [ticket.id, notes] as const;
    })
  );

  return new Map(entries);
};

const calculateMedian = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    const leftIndex = Math.max(0, middle - 1);
    const rightIndex = Math.min(sorted.length - 1, middle);
    const left = sorted[leftIndex];
    const right = sorted[rightIndex];
    if (left === undefined || right === undefined) {
      return null;
    }
    return Math.round(((left + right) / 2) * 100) / 100;
  }

  const median = sorted[middle];
  return typeof median === 'number' ? Math.round(median * 100) / 100 : null;
};

const calculatePercentile = (values: number[], percentile: number): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1));
  const value = sorted[index];
  return typeof value === 'number' ? Math.round(value * 100) / 100 : null;
};

const calculateStatusEntropy = (tickets: Ticket[]): number | null => {
  if (tickets.length === 0) {
    return null;
  }

  const counts = tickets.reduce<Record<string, number>>((acc, ticket) => {
    acc[ticket.status] = (acc[ticket.status] ?? 0) + 1;
    return acc;
  }, {});

  const total = tickets.length;
  let entropy = 0;

  for (const count of Object.values(counts)) {
    const probability = count / total;
    entropy -= probability * Math.log2(probability);
  }

  return Math.round(entropy * 1000) / 1000;
};

const qualityTierFromErrorRate = (errorRatePerThousand: number | null): 'high' | 'medium' | 'low' | null => {
  if (errorRatePerThousand === null) {
    return null;
  }

  if (errorRatePerThousand < 1) {
    return 'high';
  }

  if (errorRatePerThousand < 5) {
    return 'medium';
  }

  return 'low';
};

const calculateInboxMetrics = (
  tickets: Ticket[],
  conversations: Map<string, ConversationComputation>,
  leads: Map<string, TicketLeadSummary>
): InboxHealthMetrics => {
  const responseTimes: number[] = [];
  let underFiveCount = 0;
  let totalWithResponse = 0;

  let failedMessages = 0;
  let totalMessages = 0;
  let totalOutboundMessages = 0;

  const handleTimeByStageAccumulator = new Map<string, number[]>();

  for (const ticket of tickets) {
    const stats = conversations.get(ticket.id);
    if (!stats) {
      continue;
    }

    if (typeof stats.timeline.firstResponseMinutes === 'number') {
      responseTimes.push(stats.timeline.firstResponseMinutes);
      totalWithResponse += 1;
      if (stats.timeline.firstResponseMinutes <= 5) {
        underFiveCount += 1;
      }
    }

    failedMessages += stats.failedCount;
    totalMessages += stats.totalMessages;
    totalOutboundMessages += stats.timeline.outboundCount;

    const stage = typeof ticket.metadata?.pipelineStep === 'string' ? ticket.metadata?.pipelineStep : 'desconhecido';
    if (stats.durationMinutes !== null) {
      const bucket = handleTimeByStageAccumulator.get(stage) ?? [];
      bucket.push(stats.durationMinutes);
      handleTimeByStageAccumulator.set(stage, bucket);
    }
  }

  const handleTimeByStage: Record<string, number> = {};
  for (const [stage, durations] of handleTimeByStageAccumulator.entries()) {
    if (durations.length === 0) {
      continue;
    }
    const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
    handleTimeByStage[stage] = Math.round(average * 100) / 100;
  }

  const proposals = Array.from(leads.values()).filter((lead) => lead.status === 'PROPOSAL').length;
  const converted = Array.from(leads.values()).filter((lead) => lead.status === 'CONVERTED').length;
  const proposalToCcbRate = proposals > 0 ? Math.round((converted / proposals) * 1000) / 1000 : null;

  const errorRatePerThousand = totalMessages > 0 ? Math.round(((failedMessages / totalMessages) * 1000) * 100) / 100 : null;
  const qualityTier = qualityTierFromErrorRate(errorRatePerThousand);
  const throughputLimit = totalOutboundMessages > 0 ? Math.max(250, 1000 - Math.round(errorRatePerThousand ?? 0)) : null;

  return {
    firstResponse: {
      medianMinutes: calculateMedian(responseTimes),
      p90Minutes: calculatePercentile(responseTimes, 90),
      underFiveMinutesRate: totalWithResponse > 0 ? Math.round((underFiveCount / totalWithResponse) * 1000) / 1000 : null,
    },
    statusEntropy: calculateStatusEntropy(tickets),
    proposalToCcbRate,
    handleTimeByStage,
    whatsappQuality: {
      errorRatePerThousand,
      qualityTier,
      throughputLimit,
    },
  };
};

export type ListTicketsOptions = {
  include?: TicketIncludeOption[];
  includeMetrics?: boolean;
};

export const listTickets = async (
  tenantId: string,
  filters: TicketFilters,
  pagination: Pagination,
  options: ListTicketsOptions = {}
): Promise<TicketListResult> => {
  const includeSet = new Set(options.include ?? []);
  const baseResult = (await storageListTickets(tenantId, filters, pagination)) as PaginatedResult<Ticket>;
  const rawItems = baseResult.items;

  const conversations = await fetchConversationStatsForTickets(tenantId, rawItems);
  const contactIds: string[] = Array.from(new Set(rawItems.map((ticket: Ticket) => ticket.contactId)));

  const [contacts, leads, notes] = await Promise.all([
    includeSet.has('contact') ? safeResolveContacts(tenantId, contactIds) : Promise.resolve(new Map()),
    includeSet.has('lead') || options.includeMetrics
      ? safeResolveLeads(tenantId, contactIds)
      : Promise.resolve(new Map()),
    includeSet.has('notes') ? resolveTicketNotes(tenantId, rawItems) : Promise.resolve(new Map()),
  ]);

  const hydratedItems: TicketHydrated[] = rawItems.map((ticket: Ticket) => {
    const stats = conversations.get(ticket.id);
    const pipelineStep = typeof ticket.metadata?.pipelineStep === 'string' ? ticket.metadata.pipelineStep : null;
    const qualityScore = stats && stats.totalMessages > 0 ? Math.round(((stats.totalMessages - stats.failedCount) / stats.totalMessages) * 100) : null;

    const hydrated: TicketHydrated = {
      ...ticket,
      pipelineStep,
      qualityScore,
      ...(stats?.window ? { window: stats.window } : {}),
      ...(stats?.timeline ? { timeline: stats.timeline } : {}),
    };

    if (includeSet.has('contact')) {
      hydrated.contact = contacts.get(ticket.contactId) ?? null;
    }

    if (includeSet.has('lead')) {
      hydrated.lead = leads.get(ticket.contactId) ?? null;
    }

    if (includeSet.has('notes')) {
      hydrated.notes = notes.get(ticket.id) ?? [];
    }

    return hydrated;
  });

  const metrics = options.includeMetrics ? calculateInboxMetrics(rawItems, conversations, leads) : undefined;

  const response: TicketListResult = {
    ...baseResult,
    items: hydratedItems,
  };

  if (metrics !== undefined) {
    response.metrics = metrics;
  }

  return response;
};

export const getTicketById = async (
  tenantId: string,
  ticketId: string,
  options: ListTicketsOptions = {}
): Promise<TicketHydrated> => {
  const ticket = await storageFindTicketById(tenantId, ticketId);
  if (!ticket) {
    throw new NotFoundError('Ticket', ticketId);
  }

  const includeSet = new Set(options.include ?? []);
  const conversations = await fetchConversationStatsForTickets(tenantId, [ticket]);
  const stats = conversations.get(ticketId);

  const [contacts, leads, notes] = await Promise.all([
    includeSet.has('contact') ? safeResolveContacts(tenantId, [ticket.contactId]) : Promise.resolve(new Map()),
    includeSet.has('lead') ? safeResolveLeads(tenantId, [ticket.contactId]) : Promise.resolve(new Map()),
    includeSet.has('notes') ? resolveTicketNotes(tenantId, [ticket]) : Promise.resolve(new Map()),
  ]);

  const pipelineStep = typeof ticket.metadata?.pipelineStep === 'string' ? ticket.metadata.pipelineStep : null;
  const qualityScore = stats && stats.totalMessages > 0 ? Math.round(((stats.totalMessages - stats.failedCount) / stats.totalMessages) * 100) : null;

  const hydrated: TicketHydrated = {
    ...ticket,
    pipelineStep,
    qualityScore,
    ...(stats?.window ? { window: stats.window } : {}),
    ...(stats?.timeline ? { timeline: stats.timeline } : {}),
  };

  if (includeSet.has('contact')) {
    hydrated.contact = contacts.get(ticket.contactId) ?? null;
  }

  if (includeSet.has('lead')) {
    hydrated.lead = leads.get(ticket.contactId) ?? null;
  }

  if (includeSet.has('notes')) {
    hydrated.notes = notes.get(ticket.id) ?? [];
  }

  return hydrated;
};

export const createTicket = async (input: CreateTicketDTO): Promise<Ticket> => {
  const existingTickets = await findTicketsByContact(input.tenantId, input.contactId);
  const openTicket = existingTickets.find((ticket) => OPEN_STATUSES.has(ticket.status));

  if (openTicket) {
    throw new ConflictError('Contact already has an open ticket', {
      existingTicketId: openTicket.id,
    });
  }

  try {
    const ticket = await storageCreateTicket(input);
    emitTicketEvent(input.tenantId, ticket.id, 'ticket.created', ticket, ticket.userId ?? null);

    const ticketEnvelope = buildTicketRealtimeEnvelope({
      tenantId: input.tenantId,
      ticket,
      instanceId: resolveWhatsAppInstanceId(ticket),
    });

    emitTicketRealtimeEnvelope(input.tenantId, ticket, ticketEnvelope, ticket.userId ?? null);
    return ticket;
  } catch (error) {
    if (isForeignKeyViolation(error, 'contactId')) {
      throw new NotFoundError('Contact', input.contactId);
    }

    if (isForeignKeyViolation(error, 'queueId')) {
      throw new NotFoundError('Queue', input.queueId);
    }

    handleDatabaseError(error, {
      action: 'createTicket',
      tenantId: input.tenantId,
      contactId: input.contactId,
      queueId: input.queueId,
    });
    throw error;
  }
};

export const updateTicket = async (
  tenantId: string,
  ticketId: string,
  input: UpdateTicketDTO
): Promise<Ticket> => {
  let updated: Ticket | null = null;

  try {
    updated = await storageUpdateTicket(tenantId, ticketId, input);
  } catch (error) {
    if (input.queueId && isForeignKeyViolation(error, 'queueId')) {
      throw new NotFoundError('Queue', input.queueId);
    }

    handleDatabaseError(error, {
      action: 'updateTicket',
      tenantId,
      ticketId,
    });
    throw error;
  }
  if (!updated) {
    throw new NotFoundError('Ticket', ticketId);
  }

  const ticketEnvelope = buildTicketRealtimeEnvelope({
    tenantId,
    ticket: updated,
    instanceId: resolveWhatsAppInstanceId(updated),
  });

  emitTicketRealtimeEnvelope(tenantId, updated, ticketEnvelope, updated.userId ?? null);
  return updated;
};

export const assignTicket = async (
  tenantId: string,
  ticketId: string,
  userId: string
): Promise<Ticket> => {
  let updated: Ticket | null = null;

  try {
    updated = await storageAssignTicket(tenantId, ticketId, userId);
  } catch (error) {
    handleDatabaseError(error, {
      action: 'assignTicket',
      tenantId,
      ticketId,
      userId,
    });
    throw error;
  }
  if (!updated) {
    throw new NotFoundError('Ticket', ticketId);
  }

  const ticketEnvelope = buildTicketRealtimeEnvelope({
    tenantId,
    ticket: updated,
    instanceId: resolveWhatsAppInstanceId(updated),
  });

  emitTicketRealtimeEnvelope(tenantId, updated, ticketEnvelope, userId ?? null);
  return updated;
};

export const closeTicket = async (
  tenantId: string,
  ticketId: string,
  reason: string | undefined,
  userId: string | undefined
): Promise<Ticket> => {
  let updated: Ticket | null = null;

  try {
    updated = await storageCloseTicket(tenantId, ticketId, reason, userId);
  } catch (error) {
    handleDatabaseError(error, {
      action: 'closeTicket',
      tenantId,
      ticketId,
    });
    throw error;
  }
  if (!updated) {
    throw new NotFoundError('Ticket', ticketId);
  }

  const actorId = userId ?? updated.userId ?? null;
  const ticketEnvelope = buildTicketRealtimeEnvelope({
    tenantId,
    ticket: updated,
    instanceId: resolveWhatsAppInstanceId(updated),
  });

  emitTicketRealtimeEnvelope(tenantId, updated, ticketEnvelope, actorId);
  return updated;
};

export const listMessages = async (
  tenantId: string,
  ticketId: string,
  pagination: Pagination
): Promise<PaginatedResult<Message>> => {
  await getTicketById(tenantId, ticketId);
  const result = await storageListMessages(tenantId, { ticketId }, pagination);

  const normalizeMetadata = (
    metadata: Record<string, unknown> | null | undefined,
    providerMessageId: string | null
  ): Record<string, unknown> => {
    const base =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? { ...(metadata as Record<string, unknown>) }
        : {};

    if (!providerMessageId) {
      return base;
    }

    const readCandidate = (value: unknown): string | null => {
      if (typeof value !== 'string') {
        return null;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    if (!readCandidate(base.providerMessageId)) {
      base.providerMessageId = providerMessageId;
    }

    const brokerSource =
      base.broker && typeof base.broker === 'object' && !Array.isArray(base.broker)
        ? (base.broker as Record<string, unknown>)
        : {};

    const broker = { ...brokerSource };

    if (!readCandidate(broker.providerMessageId)) {
      broker.providerMessageId = providerMessageId;
    }
    if (!readCandidate(broker.messageId)) {
      broker.messageId = providerMessageId;
    }
    if (!readCandidate(broker.id)) {
      broker.id = providerMessageId;
    }
    if (!readCandidate(broker.wamid)) {
      broker.wamid = providerMessageId;
    }

    base.broker = broker;
    return base;
  };

  const items = result.items.map((message) => {
    const existingProviderId =
      'providerMessageId' in message &&
      typeof (message as { providerMessageId?: unknown }).providerMessageId === 'string' &&
      ((message as { providerMessageId: string }).providerMessageId.trim().length > 0)
        ? (message as { providerMessageId: string }).providerMessageId.trim()
        : null;

    const providerMessageId =
      existingProviderId ??
      resolveProviderMessageId(message.metadata) ??
      (typeof message.externalId === 'string' && message.externalId.trim().length > 0
        ? message.externalId.trim()
        : null);

    return {
      ...message,
      providerMessageId: providerMessageId ?? null,
      metadata: normalizeMetadata(message.metadata, providerMessageId ?? null),
    };
  });

  return {
    ...result,
    items,
  };
};

export const sendMessage = async (
  tenantId: string,
  userId: string | undefined,
  input: SendMessageDTO,
  dependencies: WhatsAppTransportDependencies = {}
): Promise<Message> => {
  const ticket = await storageFindTicketById(tenantId, input.ticketId);

  if (!ticket) {
    throw new NotFoundError('Ticket', input.ticketId);
  }

  const inferredInstanceId = resolveWhatsAppInstanceId(ticket);
  const requestedInstanceIdRaw = typeof input.instanceId === 'string' ? input.instanceId.trim() : '';
  const requestedInstanceId = requestedInstanceIdRaw.length > 0 ? requestedInstanceIdRaw : null;

  let effectiveInstanceId = requestedInstanceId ?? inferredInstanceId;
  let overrideRecord: { id: string; brokerId: string | null } | null = null;

  if (requestedInstanceId && requestedInstanceId !== inferredInstanceId) {
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: requestedInstanceId },
      select: {
        id: true,
        tenantId: true,
        brokerId: true,
        connected: true,
        status: true,
      },
    });

    if (!instance || instance.tenantId !== tenantId) {
      throw new NotFoundError('WhatsAppInstance', requestedInstanceId);
    }

    const isConnected = instance.connected === true || instance.status === 'connected';
    if (!isConnected) {
      throw new ServiceUnavailableError('A instância selecionada está desconectada no momento.');
    }

    overrideRecord = { id: instance.id, brokerId: instance.brokerId };
    effectiveInstanceId = instance.id;

    logger.info('crm.whatsapp.manual_send.instance_override', {
      tenantId,
      ticketId: ticket.id,
      contactId: ticket.contactId,
      requestedInstanceId,
      defaultInstanceId: inferredInstanceId ?? null,
      userId: userId ?? null,
    });
  }
  const circuitKey =
    effectiveInstanceId && tenantId ? buildCircuitBreakerKey(tenantId, effectiveInstanceId) : null;
  const circuitConfig = getCircuitBreakerConfig();

  let messageRecord: Message | null = null;
  let wasDuplicate = false;
  const direction = input.direction;
  const inferredStatus = direction === 'INBOUND' ? 'SENT' : userId ? 'PENDING' : 'SENT';
  const messageMetadata = {
    ...(input.metadata ?? {}),
  } as Record<string, unknown>;
  mergeEnrichmentMetadata(messageMetadata, input.metadata ?? null, ticket.metadata ?? null);

  if (effectiveInstanceId) {
    const whatsappMetadataSource =
      messageMetadata.whatsapp && typeof messageMetadata.whatsapp === 'object'
        ? (messageMetadata.whatsapp as Record<string, unknown>)
        : {};
    const whatsappMetadata: Record<string, unknown> = { ...whatsappMetadataSource };

    whatsappMetadata.instanceId = effectiveInstanceId;

    if (requestedInstanceId && requestedInstanceId !== inferredInstanceId) {
      whatsappMetadata.instanceOverride = effectiveInstanceId;
      whatsappMetadata.defaultInstanceId = inferredInstanceId ?? null;
      whatsappMetadata.overrideUserId = userId ?? null;
      whatsappMetadata.overrideAt = new Date().toISOString();
    } else if (whatsappMetadata.defaultInstanceId === undefined && inferredInstanceId) {
      whatsappMetadata.defaultInstanceId = inferredInstanceId;
    }

    messageMetadata.whatsapp = whatsappMetadata;
    messageMetadata.sourceInstance = effectiveInstanceId;
  }

  mergeEnrichmentMetadata(messageMetadata);

  try {
    type StorageCreateMessageInput = Parameters<typeof storageCreateMessage>[2];
    const createPayload: StorageCreateMessageInput = {
      ticketId: input.ticketId,
      direction,
      content: input.content ?? input.caption ?? '',
      status: inferredStatus,
      metadata: messageMetadata,
    };

    if (effectiveInstanceId) {
      createPayload.instanceId = effectiveInstanceId;
    }

    if (input.idempotencyKey) {
      createPayload.idempotencyKey = input.idempotencyKey;
    }

    if (typeof input.externalId === 'string' && input.externalId.trim().length > 0) {
      createPayload.externalId = input.externalId.trim();
    }

    if (typeof userId === 'string' && userId.trim().length > 0) {
      createPayload.userId = userId.trim();
    }

    if (input.type !== undefined) {
      createPayload.type = input.type;
    }

    if (input.caption !== undefined) {
      createPayload.caption = input.caption;
    }

    if (input.mediaUrl !== undefined) {
      createPayload.mediaUrl = input.mediaUrl;
    }

    if (input.mediaFileName !== undefined) {
      createPayload.mediaFileName = input.mediaFileName;
    }

    if (input.mediaMimeType !== undefined) {
      createPayload.mediaMimeType = input.mediaMimeType;
    }

    if (input.quotedMessageId !== undefined) {
      createPayload.quotedMessageId = input.quotedMessageId;
    }

    messageRecord = await storageCreateMessage(tenantId, input.ticketId, createPayload);
  } catch (error) {
    if (isUniqueViolation(error) && input.externalId) {
      const existing = await storageFindMessageByExternalId(tenantId, input.externalId);
      if (existing) {
        const merged = await storageUpdateMessage(tenantId, existing.id, {
          metadata: messageMetadata,
          ...(effectiveInstanceId ? { instanceId: effectiveInstanceId } : {}),
        });
        messageRecord = merged ?? existing;
        wasDuplicate = true;
      } else {
        throw new ConflictError('Mensagem duplicada detectada para este ticket.', { cause: error });
      }
    } else {
      handleDatabaseError(error, {
        action: 'createMessage',
        tenantId,
        ticketId: input.ticketId,
      });
      throw error;
    }
  }

  if (!messageRecord) {
    throw new NotFoundError('Ticket', input.ticketId);
  }

  let message = messageRecord;
  let statusChanged = false;

  const emitMessageUpdate =
    dependencies.emitMessageUpdatedEvents ?? emitMessageUpdatedEvents;

  const emitUpdatesIfNeeded = async (): Promise<void> => {
    if (!statusChanged) {
      return;
    }

    statusChanged = false;
    await emitMessageUpdate(tenantId, input.ticketId, message, userId ?? null);
  };

  const ticketSnapshot: Ticket = {
    ...ticket,
    updatedAt: message.updatedAt ?? ticket.updatedAt,
    lastMessageAt: message.createdAt ?? ticket.lastMessageAt,
    lastMessagePreview:
      message.content && message.content.trim().length > 0
        ? message.content.slice(0, 280)
        : ticket.lastMessagePreview,
  };

  const providerMessageId = resolveProviderMessageId(message.metadata);

  if (!wasDuplicate) {
    emitMessageCreatedEvents(tenantId, ticketSnapshot, message, {
      userId: userId ?? null,
      instanceId: effectiveInstanceId ?? null,
      providerMessageId,
    });
  }

  const markAsFailed = async (errorDetails: {
    message: string;
    code?: string;
    status?: number;
    requestId?: string;
    normalized?: WhatsAppCanonicalError | null;
    raw?: { code?: string | null; message?: string | null };
  }) => {
    const currentMetadata = (message.metadata ?? {}) as Record<string, unknown>;
    const previousBroker =
      currentMetadata?.broker && typeof currentMetadata.broker === 'object'
        ? (currentMetadata.broker as Record<string, unknown>)
        : {};

    const errorMetadata: Record<string, unknown> = {
      message: errorDetails.message,
    };

    if (errorDetails.code !== undefined) {
      errorMetadata.code = errorDetails.code;
    }

    if (errorDetails.status !== undefined) {
      errorMetadata.status = errorDetails.status;
    }

    if (errorDetails.requestId !== undefined) {
      errorMetadata.requestId = errorDetails.requestId;
    }

    const metadata = {
      ...currentMetadata,
      broker: {
        ...previousBroker,
        provider: 'whatsapp',
        instanceId: effectiveInstanceId,
        error: errorMetadata,
        failedAt: new Date().toISOString(),
      },
    } as Record<string, unknown>;

    if (errorDetails.normalized) {
      (metadata.broker as Record<string, unknown>).normalizedError = errorDetails.normalized;
    }

    if (errorDetails.raw) {
      (metadata.broker as Record<string, unknown>).rawError = errorDetails.raw;
    }

    let failed: Message | null = null;

    try {
      failed = await storageUpdateMessage(tenantId, message.id, {
        status: 'FAILED',
        metadata,
        ...(effectiveInstanceId ? { instanceId: effectiveInstanceId } : {}),
      });
    } catch (error) {
      handleDatabaseError(error, {
        action: 'markMessageFailed',
        tenantId,
        messageId: message.id,
      });
      throw error;
    }

    if (failed) {
      message = failed;
      statusChanged = true;
    }

    return failed;
  };

  if (ticket.channel === 'WHATSAPP' && direction === 'OUTBOUND') {
    const instanceId = effectiveInstanceId;

    if (!instanceId) {
      logger.warn('whatsapp.outbound.instanceIdMissing', {
        tenantId,
        ticketId: ticket.id,
      });
      await markAsFailed({ message: 'whatsapp_instance_missing' });
    } else {
      const contact = await prisma.contact.findUnique({ where: { id: ticket.contactId } });
      const phone = (contact?.primaryPhone ?? '').trim();

      if (!phone) {
        logger.warn('whatsapp.outbound.contactPhoneMissing', {
          tenantId,
          ticketId: ticket.id,
          contactId: ticket.contactId,
        });
        await markAsFailed({ message: 'contact_phone_missing' });
      } else {
        const transport = dependencies.transport ?? getWhatsAppTransport();
        const requestedInstanceId = instanceId;
        let dispatchInstanceId: string | null = null;
        let dispatchBrokerId: string | null = null;
        try {
          const dispatchResolution = await resolveDispatchInstanceId(instanceId, overrideRecord ?? undefined);
          dispatchInstanceId = dispatchResolution.dispatchInstanceId;
          dispatchBrokerId = dispatchResolution.brokerId;
          if (!dispatchInstanceId) {
            throw new NotFoundError('WhatsAppInstance', instanceId ?? 'unknown');
          }
          logger.info('whatsapp.outbound.dispatch.attempt', {
            tenantId,
            ticketId: ticket.id,
            messageId: message.id,
            requestedInstanceId: instanceId,
            resolvedDispatchId: dispatchInstanceId,
            brokerId: dispatchBrokerId,
          });
         const locationMetadata = normalizeLocationPayload(messageMetadata.location);
         const templateMetadata = normalizeTemplatePayload(messageMetadata.template);
         const contactsMetadata = normalizeContactsPayload(messageMetadata.contacts);
          const transportPayload: WhatsAppTransportSendMessagePayload = {
            to: phone,
            content: input.content ?? input.caption ?? '',
            externalId: message.id,
            metadata: messageMetadata,
          };

          if (typeof input.caption === 'string' && input.caption.trim().length > 0) {
            transportPayload.caption = input.caption;
          }

          if (input.type) {
            transportPayload.type = input.type;
          }

          if (typeof input.mediaUrl === 'string' && input.mediaUrl.trim().length > 0) {
            transportPayload.mediaUrl = input.mediaUrl;
          }

          if (typeof input.mediaMimeType === 'string' && input.mediaMimeType.trim().length > 0) {
            transportPayload.mediaMimeType = input.mediaMimeType;
          }

          if (typeof input.mediaFileName === 'string' && input.mediaFileName.trim().length > 0) {
            transportPayload.mediaFileName = input.mediaFileName;
          }

          if (typeof messageMetadata.previewUrl === 'boolean') {
            transportPayload.previewUrl = messageMetadata.previewUrl;
          }

          if (locationMetadata) {
            transportPayload.location = locationMetadata;
          }

          if (templateMetadata) {
            transportPayload.template = templateMetadata;
          }

          if (contactsMetadata) {
            transportPayload.contacts = contactsMetadata;
          }

          const dispatchResult = await transport.sendMessage(
            dispatchInstanceId,
            transportPayload,
            { idempotencyKey: message.id }
          );

          const brokerMetadata: Record<string, unknown> = {
            provider: 'whatsapp',
            instanceId,
            externalId: dispatchResult.externalId,
            status: dispatchResult.status,
            dispatchedAt: dispatchResult.timestamp,
          };

          if (dispatchResult.raw) {
            brokerMetadata.raw = dispatchResult.raw;
          }

          const metadata: Record<string, unknown> = {
            ...(message.metadata ?? {}),
            broker: brokerMetadata,
          };

          let updated: Message | null = null;

          try {
            updated = await storageUpdateMessage(tenantId, message.id, {
              status: normalizeBrokerStatus(dispatchResult.status),
              externalId: dispatchResult.externalId,
              metadata,
              ...(instanceId ? { instanceId } : {}),
            });
          } catch (error) {
            handleDatabaseError(error, {
              action: 'applyBrokerAck',
              tenantId,
              messageId: message.id,
            });
            throw error;
          }

          if (updated) {
            message = updated;
            statusChanged = true;
          }

          if (circuitKey) {
            const wasOpen = recordCircuitSuccess(circuitKey);
            if (wasOpen) {
              logger.info('whatsapp.outbound.circuit.closed', {
                tenantId,
                ticketId: ticket.id,
                instanceId,
                requestedInstanceId,
                resolvedDispatchId: dispatchInstanceId,
                brokerId: dispatchBrokerId,
              });
              emitToTenant(tenantId, 'whatsapp.circuit_breaker.closed', {
                instanceId,
                timestamp: new Date().toISOString(),
              });
            }
          }
        } catch (error) {
          const transportError = error instanceof WhatsAppTransportError ? error : null;
          const brokerError = error instanceof WhatsAppBrokerError ? error : null;
          const normalizedBrokerError = translateWhatsAppBrokerError(brokerError);
          const normalizedTransportError = transportError?.canonical ?? normalizedBrokerError;
          const reason =
            normalizedTransportError?.message ??
            (error instanceof Error ? error.message : 'unknown_error');
          const status =
            typeof transportError?.status === 'number'
              ? transportError.status
              : typeof brokerError?.brokerStatus === 'number'
              ? brokerError.brokerStatus
              : undefined;
          const rawErrorCode = transportError?.code ?? brokerError?.code;
          const canonicalCode =
            normalizedTransportError?.code ??
            (typeof rawErrorCode === 'string' ? rawErrorCode.toUpperCase() : null);
          const code = canonicalCode ?? rawErrorCode;
          const requestId = transportError?.requestId ?? brokerError?.requestId;
          const normalizedCode = typeof code === 'string' ? code.toUpperCase() : null;

          logger.error('whatsapp.outbound.dispatch.failed', {
            tenantId,
            ticketId: ticket.id,
            messageId: message.id,
            error: reason,
            errorCode: code,
            status,
            requestId,
            rawErrorCode,
            requestedInstanceId,
            resolvedDispatchId: dispatchInstanceId,
            brokerId: dispatchBrokerId,
          });
          if (normalizedCode === 'INSTANCE_NOT_CONNECTED') {
            whatsappSocketReconnectsCounter.inc({
              origin: 'ticket-service',
              tenantId,
              instanceId: instanceId ?? 'unknown',
              reason: 'INSTANCE_NOT_CONNECTED',
            });
          }
          const failurePayload: Parameters<typeof markAsFailed>[0] = {
            message: reason,
          };

          if (typeof code === 'string') {
            failurePayload.code = code;
          }

          if (typeof status === 'number') {
            failurePayload.status = status;
          }

          if (requestId) {
            failurePayload.requestId = requestId;
          }

          if (normalizedTransportError) {
            failurePayload.normalized = normalizedTransportError;
          }

          if (transportError) {
            failurePayload.raw = {
              code: transportError.code,
              message: error instanceof Error ? error.message : null,
            };
          } else if (brokerError) {
            failurePayload.raw = {
              code: brokerError.code ?? null,
              message: error instanceof Error ? error.message : null,
            };
          }

          await markAsFailed(failurePayload);

          if (circuitKey) {
            const result = recordCircuitFailure(circuitKey);
            if (result.opened) {
              const retryAtIso = result.retryAt ? new Date(result.retryAt).toISOString() : null;
              logger.warn('whatsapp.outbound.circuit.opened', {
                tenantId,
                ticketId: ticket.id,
                instanceId,
                failureCount: result.failureCount,
                retryAt: retryAtIso,
              });
              emitToTenant(tenantId, 'whatsapp.circuit_breaker.open', {
                instanceId,
                failureCount: result.failureCount,
                windowMs: circuitConfig.windowMs,
                cooldownMs: circuitConfig.cooldownMs,
                retryAt: retryAtIso,
              });
            }
          }

          await emitUpdatesIfNeeded();
          throw error;
        }
      }
    }
  }

  await emitUpdatesIfNeeded();

  return message;
};

type SendOnTicketParams = {
  tenantId?: string;
  operatorId?: string;
  ticketId: string;
  payload: NormalizedMessagePayload;
  instanceId?: string;
  idempotencyKey?: string;
  rateLimitConsumed?: boolean;
};

const toMessageType = (type: NormalizedMessagePayload['type']): Message['type'] => {
  switch (type) {
    case 'image':
      return 'IMAGE';
    case 'audio':
      return 'AUDIO';
    case 'video':
      return 'VIDEO';
    case 'document':
      return 'DOCUMENT';
    case 'location':
      return 'LOCATION';
    case 'contact':
      return 'CONTACT';
    case 'template':
      return 'TEMPLATE';
    case 'poll':
      return 'TEXT';
    default:
      return 'TEXT';
  }
};

export const sendOnTicket = async (
  {
    tenantId,
    operatorId,
    ticketId,
    payload,
    instanceId,
    idempotencyKey,
    rateLimitConsumed = false,
  }: SendOnTicketParams,
  dependencies: WhatsAppTransportDependencies = {}
): Promise<OutboundMessageResponse> => {
  let resolvedTenantId = tenantId ?? null;
  let ticket: Ticket | null = null;

  if (resolvedTenantId) {
    ticket = await storageFindTicketById(resolvedTenantId, ticketId);
  } else {
    const ticketRecord = await prisma.ticket.findUnique({ where: { id: ticketId } });

    if (!ticketRecord) {
      throw new NotFoundError('Ticket', ticketId);
    }

    resolvedTenantId = ticketRecord.tenantId;
    ticket = await storageFindTicketById(resolvedTenantId, ticketId);
  }

  if (!ticket) {
    throw new NotFoundError('Ticket', ticketId);
  }

  const contact = await prisma.contact.findUnique({ where: { id: ticket.contactId } });

  if (!contact) {
    throw new NotFoundError('Contact', ticket.contactId);
  }

  const phone = (contact.primaryPhone ?? '').trim();

  if (!phone) {
    throw new PhoneNormalizationError('Contato não possui telefone cadastrado.');
  }

  const targetInstanceId = instanceId ?? resolveWhatsAppInstanceId(ticket);

  if (!targetInstanceId) {
    throw new Error('WHATSAPP_INSTANCE_REQUIRED');
  }

  const instance = await prisma.whatsAppInstance.findUnique({ where: { id: targetInstanceId } });

  if (!instance) {
    throw new NotFoundError('WhatsAppInstance', targetInstanceId);
  }

  if (!resolvedTenantId) {
    throw new NotFoundError('Ticket', ticketId);
  }

  const tenantForOperations = resolvedTenantId;
  let payloadHash: string | null = null;
  if (idempotencyKey) {
    payloadHash = hashIdempotentPayload({
      tenantId: tenantForOperations,
      ticketId,
      instanceId: targetInstanceId,
      payload,
    });

    const cached = getIdempotentValue<OutboundMessageResponse>(tenantForOperations, idempotencyKey);
    if (cached && cached.payloadHash === payloadHash) {
      return cached.value;
    }
  }

  const circuitKey = buildCircuitBreakerKey(tenantForOperations, targetInstanceId);
  assertCircuitClosed(circuitKey);

  if (!rateLimitConsumed) {
    const rateLimit = resolveInstanceRateLimit(targetInstanceId);
    assertWithinRateLimit(rateKeyForInstance(tenantForOperations, targetInstanceId), rateLimit);
  }

  const metadata: Record<string, unknown> = {};
  if (typeof payload.previewUrl === 'boolean') {
    metadata.previewUrl = payload.previewUrl;
  }
  if (payload.location) {
    metadata.location = payload.location;
  }
  if (payload.contact) {
    metadata.contact = payload.contact;
  }
  if (payload.template) {
    metadata.template = payload.template;
  }
  if (payload.poll) {
    metadata.poll = payload.poll;
  }
  if (idempotencyKey) {
    metadata.idempotencyKey = idempotencyKey;
  }

  const messageInput: SendMessageDTO = {
    ticketId,
    type: toMessageType(payload.type),
    instanceId: targetInstanceId,
    direction: 'OUTBOUND',
    content: payload.content,
    caption: payload.caption,
    mediaUrl: payload.mediaUrl,
    mediaFileName: payload.mediaFileName,
    mediaMimeType: payload.mediaMimeType,
    metadata,
    idempotencyKey,
  };

  const startedAt = Date.now();
  const message = await sendMessage(tenantForOperations, operatorId, messageInput, dependencies);
  const latencyMs = Date.now() - startedAt;
  const metricsInstanceId = (message.instanceId ?? targetInstanceId) ?? 'unknown';
  const outboundMetricBase = {
    origin: 'ticket-service',
    tenantId: tenantForOperations,
    instanceId: metricsInstanceId,
  } as const;

  whatsappOutboundMetrics.incTotal({
    ...outboundMetricBase,
    status: message.status,
  });
  whatsappOutboundMetrics.observeLatency(outboundMetricBase, latencyMs);

  if (message.status === 'DELIVERED' || message.status === 'READ') {
    const normalizedType =
      typeof message.type === 'string' && message.type.trim().length > 0
        ? message.type.trim().toLowerCase()
        : 'unknown';
    whatsappOutboundDeliverySuccessCounter.inc({
      ...outboundMetricBase,
      status: message.status,
      messageType: normalizedType,
    });
  }

  const response = buildOutboundResponse(message);

  if (idempotencyKey && payloadHash) {
    rememberIdempotency(tenantForOperations, idempotencyKey, payloadHash, response, IDEMPOTENCY_TTL_MS);
  }

  return response;
};

type SendToContactParams = {
  tenantId?: string;
  operatorId?: string;
  contactId: string;
  payload: NormalizedMessagePayload;
  instanceId?: string;
  to?: string;
  idempotencyKey?: string;
  rateLimitConsumed?: boolean;
};

export const sendToContact = async (
  {
    tenantId,
    operatorId,
    contactId,
    payload,
    instanceId,
    to,
    idempotencyKey,
    rateLimitConsumed = false,
  }: SendToContactParams,
  dependencies: WhatsAppTransportDependencies = {}
): Promise<OutboundMessageResponse> => {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });

  if (!contact) {
    throw new NotFoundError('Contact', contactId);
  }

  const resolvedTenantId = tenantId ?? contact.tenantId;

  if (!resolvedTenantId) {
    throw new NotFoundError('Contact', contactId);
  }

  if (instanceId) {
    await resolveDispatchInstanceId(instanceId);
  }

  let normalizedPhone = contact.primaryPhone?.trim() ?? null;

  if (to) {
    const normalized = normalizePhoneNumber(to);
    normalizedPhone = normalized.e164;

    if ((contact.primaryPhone ?? null) !== normalizedPhone) {
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          primaryPhone: normalizedPhone,
          lastInteractionAt: new Date(),
        },
      });
      await syncContactPrimaryPhone(resolvedTenantId, contactId, normalizedPhone);
    }
  }

  if (!normalizedPhone) {
    throw new PhoneNormalizationError('Contato sem telefone válido para envio.');
  }

  const existingTickets = await findTicketsByContact(resolvedTenantId, contactId);
  let activeTicket = existingTickets.find((ticket) => OPEN_STATUSES.has(ticket.status));

  if (!activeTicket) {
    const queueId = await resolveDefaultQueueId(resolvedTenantId);
    activeTicket = await createTicket({
      tenantId: resolvedTenantId,
      contactId,
      queueId,
      channel: 'WHATSAPP',
      metadata: {
        whatsappInstanceId: instanceId ?? null,
        phone: normalizedPhone,
      },
    });
  }

  const sendParams: SendOnTicketParams = {
    tenantId: resolvedTenantId,
    ticketId: activeTicket.id,
    payload,
    rateLimitConsumed,
  };

  if (instanceId) {
    sendParams.instanceId = instanceId;
  }

  if (idempotencyKey) {
    sendParams.idempotencyKey = idempotencyKey;
  }

  if (operatorId) {
    sendParams.operatorId = operatorId;
  }

  return sendOnTicket(sendParams, dependencies);
};

type SendAdHocParams = {
  operatorId?: string;
  instanceId: string;
  tenantId?: string;
  to: string;
  payload: NormalizedMessagePayload;
  idempotencyKey?: string;
  rateLimitConsumed?: boolean;
};

export const sendAdHoc = async (
  {
    operatorId,
    instanceId,
    tenantId: callerTenantId,
    to,
    payload,
    idempotencyKey,
    rateLimitConsumed = false,
  }: SendAdHocParams,
  dependencies: WhatsAppTransportDependencies = {}
): Promise<OutboundMessageResponse> => {
  const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

  if (!instance) {
    throw new NotFoundError('WhatsAppInstance', instanceId);
  }

  if (callerTenantId && callerTenantId !== instance.tenantId) {
    throw new NotFoundError('WhatsAppInstance', instanceId);
  }

  await resolveDispatchInstanceId(instanceId, instance);

  const tenantId = instance.tenantId;

  const normalized = normalizePhoneNumber(to);

  let contact = await prisma.contact.findUnique({
    where: {
      tenantId_primaryPhone: {
        tenantId,
        primaryPhone: normalized.e164,
      },
    },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        tenantId,
        fullName: normalized.e164,
        displayName: normalized.e164,
        primaryPhone: normalized.e164,
        lastInteractionAt: new Date(),
      },
    });
    await syncContactPrimaryPhone(tenantId, contact.id, normalized.e164);
  } else {
    contact = await prisma.contact.update({
      where: { id: contact.id },
      data: {
        lastInteractionAt: new Date(),
        primaryPhone: normalized.e164,
      },
    });
    await syncContactPrimaryPhone(tenantId, contact.id, normalized.e164);
  }

  const sendParams: SendToContactParams = {
    tenantId,
    contactId: contact.id,
    payload,
    to: normalized.e164,
    rateLimitConsumed,
  };

  if (instanceId) {
    sendParams.instanceId = instanceId;
  }

  if (idempotencyKey) {
    sendParams.idempotencyKey = idempotencyKey;
  }

  if (operatorId) {
    sendParams.operatorId = operatorId;
  }

  return sendToContact(sendParams, dependencies);
};

export const addTicketNote = async (
  tenantId: string,
  ticketId: string,
  author: TicketNoteAuthor,
  input: CreateTicketNoteInput
): Promise<TicketNote> => {
  await getTicketById(tenantId, ticketId);

  const notePayload: Parameters<typeof createTicketNote>[0] = {
    tenantId,
    ticketId,
    authorId: author.id,
    authorName: author.name ?? null,
    authorAvatar: author.avatar ?? null,
    body: input.body,
  };

  if (input.visibility) {
    notePayload.visibility = input.visibility;
  }

  if (Array.isArray(input.tags)) {
    notePayload.tags = input.tags;
  }

  if (input.metadata) {
    notePayload.metadata = input.metadata;
  }

  const note = await createTicketNote(notePayload);

  emitTicketEvent(tenantId, ticketId, 'ticket.note.created', note, author.id);

  const ticket = await storageFindTicketById(tenantId, ticketId);
  if (ticket) {
    const ticketEnvelope = buildTicketRealtimeEnvelope({
      tenantId,
      ticket,
      instanceId: resolveWhatsAppInstanceId(ticket),
    });

    emitTicketRealtimeEnvelope(tenantId, ticket, ticketEnvelope, author.id);
  }

  return note;
};
