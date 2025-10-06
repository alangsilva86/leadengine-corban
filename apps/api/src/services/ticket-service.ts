import {
  ConflictError,
  Contact,
  CreateTicketDTO,
  ForbiddenError,
  Lead,
  Message,
  Pagination,
  PaginatedResult,
  SendMessageDTO,
  Ticket,
  TicketFilters,
  UpdateTicketDTO,
  NotFoundError,
} from '@ticketz/core';
import {
  assignTicket as storageAssignTicket,
  closeTicket as storageCloseTicket,
  createMessage as storageCreateMessage,
  createTicket as storageCreateTicket,
  findTicketById as storageFindTicketById,
  findTicketsByContact,
  listMessages as storageListMessages,
  listTickets as storageListTickets,
  updateMessage as storageUpdateMessage,
  updateTicket as storageUpdateTicket,
} from '@ticketz/storage';
import { emitToTenant, emitToTicket, emitToUser } from '../lib/socket-registry';
import { prisma } from '../lib/prisma';
import {
  createTicketNote,
  listTicketNotes,
  type TicketNote,
  type TicketNoteVisibility,
} from '../data/ticket-note-store';
import { logger } from '../config/logger';
import { whatsappOutboundMetrics } from '../lib/metrics';
import {
  whatsappBrokerClient,
  WhatsAppBrokerError,
  translateWhatsAppBrokerError,
  type NormalizedWhatsAppBrokerError,
} from './whatsapp-broker-client';
import { assertWithinRateLimit, RateLimitError } from '../utils/rate-limit';
import { normalizePhoneNumber, PhoneNormalizationError } from '../utils/phone';
import {
  getIdempotentValue,
  hashIdempotentPayload,
  rememberIdempotency,
} from '../utils/idempotency';
import type { NormalizedMessagePayload } from '../dtos/message-schemas';

const OPEN_STATUSES = new Set(['OPEN', 'PENDING', 'ASSIGNED']);

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

const resolveInstanceRateLimit = (instanceId: string | null | undefined): number => {
  if (!instanceId) {
    return OUTBOUND_TPS_DEFAULT;
  }

  return OUTBOUND_TPS_OVERRIDES.get(instanceId) ?? OUTBOUND_TPS_DEFAULT;
};

const rateKeyForInstance = (tenantId: string, instanceId: string): string => `outbound:${tenantId}:${instanceId}`;

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
    throw new Error('DEFAULT_QUEUE_NOT_FOUND');
  }

  defaultQueueCache.set(tenantId, queue.id);
  return queue.id;
};

const ensureWhatsAppInstanceAccessible = async (tenantId: string, instanceId: string): Promise<void> => {
  const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

  if (!instance) {
    throw new NotFoundError('WhatsAppInstance', instanceId);
  }

  if (instance.tenantId !== tenantId) {
    throw new ForbiddenError('Você não tem acesso a esta instância de WhatsApp.');
  }
};

export type OutboundMessageError = {
  message: string;
  code?: string;
  status?: number;
  requestId?: string;
};

export type OutboundMessageResponse = {
  queued: true;
  ticketId: string;
  messageId: string;
  status: Message['status'];
  externalId: string | null;
  error: OutboundMessageError | null;
};

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

export type TicketIncludeOption = 'contact' | 'lead' | 'notes';

export type TicketContactSummary = Pick<Contact, 'id' | 'name' | 'phone' | 'email' | 'document' | 'avatar'> & {
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
  userId?: string | null
) => {
  emitToTenant(tenantId, event, payload);
  emitToTicket(ticketId, event, payload);
  if (userId) {
    emitToUser(userId, event, payload);
  }
};

const emitMessageCreatedEvents = (
  tenantId: string,
  ticketId: string,
  message: Message,
  userId?: string | null
) => {
  emitTicketEvent(tenantId, ticketId, 'message:created', message, userId);
  emitTicketEvent(tenantId, ticketId, 'ticket.message.created', message, userId);
  emitTicketEvent(tenantId, ticketId, 'ticket.message', message, userId);
};

const emitMessageUpdatedEvents = (
  tenantId: string,
  ticketId: string,
  message: Message,
  userId?: string | null
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
  emitTicketEvent(tenantId, ticketId, 'ticket.message', message, userId);
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

const normalizeBrokerStatus = (status: string | undefined): Message['status'] => {
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

        const summary: TicketContactSummary = {
          id: contact.id,
          name: contact.name,
          phone: contact.phone ?? undefined,
          email: contact.email ?? undefined,
          document: contact.document ?? undefined,
          avatar: contact.avatar ?? undefined,
          consent: normalizedConsent,
        };

        return [contact.id, summary] as const;
      })
    );
  } catch (error) {
    logger.warn('[ticket-service] Failed to resolve contacts for tickets', {
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
        expectedCloseDate: record.expectedCloseDate ?? undefined,
        lastContactAt: record.lastContactAt ?? undefined,
        nextFollowUpAt: record.nextFollowUpAt ?? undefined,
        qualityRating:
          typeof record.customFields === 'object' && record.customFields !== null && 'qualityRating' in record.customFields
            ? Number((record.customFields as Record<string, unknown>).qualityRating)
            : null,
      });
    }

    return leadByContact;
  } catch (error) {
    logger.warn('[ticket-service] Failed to resolve leads for tickets', {
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
    return Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 100) / 100;
  }

  return Math.round(sorted[middle] * 100) / 100;
};

const calculatePercentile = (values: number[], percentile: number): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1));
  return Math.round(sorted[index] * 100) / 100;
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
      window: stats?.window,
      timeline: stats?.timeline,
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

  return {
    ...baseResult,
    items: hydratedItems,
    metrics,
  };
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
    window: stats?.window,
    timeline: stats?.timeline,
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

  const ticket = await storageCreateTicket(input);
  emitTicketEvent(input.tenantId, ticket.id, 'ticket.created', ticket, ticket.userId ?? null);
  emitTicketEvent(
    input.tenantId,
    ticket.id,
    'ticket.status.changed',
    {
      ticketId: ticket.id,
      status: ticket.status,
      previousStatus: null,
    },
    ticket.userId ?? null
  );
  return ticket;
};

export const updateTicket = async (
  tenantId: string,
  ticketId: string,
  input: UpdateTicketDTO
): Promise<Ticket> => {
  const previous = await storageFindTicketById(tenantId, ticketId);
  const updated = await storageUpdateTicket(tenantId, ticketId, input);
  if (!updated) {
    throw new NotFoundError('Ticket', ticketId);
  }

  emitTicketEvent(tenantId, ticketId, 'ticket.updated', updated, updated.userId ?? null);

  if (previous && previous.status !== updated.status) {
    emitTicketEvent(
      tenantId,
      ticketId,
      'ticket.status.changed',
      {
        ticketId,
        status: updated.status,
        previousStatus: previous.status,
      },
      updated.userId ?? null
    );
  }
  return updated;
};

export const assignTicket = async (
  tenantId: string,
  ticketId: string,
  userId: string
): Promise<Ticket> => {
  const previous = await storageFindTicketById(tenantId, ticketId);
  const updated = await storageAssignTicket(tenantId, ticketId, userId);
  if (!updated) {
    throw new NotFoundError('Ticket', ticketId);
  }

  emitTicketEvent(tenantId, ticketId, 'ticket.assigned', updated, userId);

  if (previous && previous.status !== updated.status) {
    emitTicketEvent(
      tenantId,
      ticketId,
      'ticket.status.changed',
      {
        ticketId,
        status: updated.status,
        previousStatus: previous.status,
      },
      userId
    );
  }
  return updated;
};

export const closeTicket = async (
  tenantId: string,
  ticketId: string,
  reason: string | undefined,
  userId: string | undefined
): Promise<Ticket> => {
  const previous = await storageFindTicketById(tenantId, ticketId);
  const updated = await storageCloseTicket(tenantId, ticketId, reason, userId);
  if (!updated) {
    throw new NotFoundError('Ticket', ticketId);
  }

  const actorId = userId ?? updated.userId ?? null;
  emitTicketEvent(tenantId, ticketId, 'ticket.closed', updated, actorId);

  if (previous && previous.status !== updated.status) {
    emitTicketEvent(
      tenantId,
      ticketId,
      'ticket.status.changed',
      {
        ticketId,
        status: updated.status,
        previousStatus: previous.status,
      },
      actorId
    );
  }
  return updated;
};

export const listMessages = async (
  tenantId: string,
  ticketId: string,
  pagination: Pagination
): Promise<PaginatedResult<Message>> => {
  await getTicketById(tenantId, ticketId);
  return storageListMessages(tenantId, { ticketId }, pagination);
};

export const sendMessage = async (
  tenantId: string,
  userId: string | undefined,
  input: SendMessageDTO
): Promise<Message> => {
  const ticket = await storageFindTicketById(tenantId, input.ticketId);

  if (!ticket) {
    throw new NotFoundError('Ticket', input.ticketId);
  }

  const inferredInstanceId = resolveWhatsAppInstanceId(ticket);
  const effectiveInstanceId = input.instanceId ?? inferredInstanceId;

  const messageRecord = await storageCreateMessage(tenantId, input.ticketId, {
    ...input,
    content: input.content ?? input.caption ?? '',
    direction: userId ? 'OUTBOUND' : 'INBOUND',
    userId,
    status: userId ? 'PENDING' : 'SENT',
    instanceId: effectiveInstanceId ?? undefined,
    idempotencyKey: input.idempotencyKey ?? undefined,
  });

  if (!messageRecord) {
    throw new NotFoundError('Ticket', input.ticketId);
  }

  let message = messageRecord;
  let statusChanged = false;

  emitMessageCreatedEvents(tenantId, input.ticketId, message, userId ?? null);

  const markAsFailed = async (errorDetails: {
    message: string;
    code?: string;
    status?: number;
    requestId?: string;
    normalized?: NormalizedWhatsAppBrokerError | null;
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

    const failed = await storageUpdateMessage(tenantId, message.id, {
      status: 'FAILED',
      metadata,
      instanceId: effectiveInstanceId ?? undefined,
    });

    if (failed) {
      message = failed;
      statusChanged = true;
    }

    return failed;
  };

  if (userId && ticket.channel === 'WHATSAPP') {
    const instanceId = effectiveInstanceId;

    if (!instanceId) {
      logger.warn('Unable to send WhatsApp message: instanceId missing from ticket metadata', {
        tenantId,
        ticketId: ticket.id,
      });
      await markAsFailed({ message: 'whatsapp_instance_missing' });
    } else {
      const contact = await prisma.contact.findUnique({ where: { id: ticket.contactId } });
      const phone = (contact?.phone ?? '').trim();

      if (!phone) {
        logger.warn('Unable to send WhatsApp message: contact phone missing', {
          tenantId,
          ticketId: ticket.id,
          contactId: ticket.contactId,
        });
        await markAsFailed({ message: 'contact_phone_missing' });
      } else {
        try {
          const brokerResult = await whatsappBrokerClient.sendMessage(instanceId, {
            to: phone,
            content: input.content ?? input.caption ?? '',
            caption: input.caption,
            type: input.type,
            externalId: message.id,
            mediaUrl: input.mediaUrl,
            mediaMimeType: input.mediaMimeType,
            mediaFileName: input.mediaFileName,
            previewUrl: Boolean(input.metadata?.previewUrl),
          });

          const metadata = {
            ...(message.metadata ?? {}),
            broker: {
              provider: 'whatsapp',
              instanceId,
              externalId: brokerResult.externalId,
              status: brokerResult.status,
              dispatchedAt: brokerResult.timestamp,
              raw: brokerResult.raw ?? undefined,
            },
          } as Record<string, unknown>;

          const updated = await storageUpdateMessage(tenantId, message.id, {
            status: normalizeBrokerStatus(brokerResult.status),
            externalId: brokerResult.externalId,
            metadata,
            instanceId,
          });

          if (updated) {
            message = updated;
            statusChanged = true;
          }
        } catch (error) {
          const brokerError = error instanceof WhatsAppBrokerError ? error : null;
          const normalizedBrokerError = brokerError
            ? translateWhatsAppBrokerError(brokerError)
            : null;
          const reason = normalizedBrokerError?.message
            ?? (error instanceof Error ? error.message : 'unknown_error');
          logger.error('Failed to dispatch WhatsApp message via broker', {
            tenantId,
            ticketId: ticket.id,
            messageId: message.id,
            error: reason,
            brokerErrorCode: brokerError?.code,
            brokerErrorStatus: brokerError?.status,
            brokerRequestId: brokerError?.requestId,
          });
          await markAsFailed({
            message: reason,
            code: normalizedBrokerError?.code ?? brokerError?.code,
            status: brokerError?.status,
            requestId: brokerError?.requestId,
            normalized: normalizedBrokerError,
            raw: brokerError
              ? { code: brokerError.code, message: error instanceof Error ? error.message : null }
              : undefined,
          });
        }
      }
    }
  }

  if (statusChanged) {
    emitMessageUpdatedEvents(tenantId, input.ticketId, message, userId ?? null);
  }

  const refreshedTicket = await storageFindTicketById(tenantId, input.ticketId);
  if (refreshedTicket) {
    emitTicketEvent(tenantId, refreshedTicket.id, 'ticket.updated', refreshedTicket, refreshedTicket.userId ?? null);
  }

  return message;
};

type SendOnTicketParams = {
  tenantId: string;
  operatorId: string;
  ticketId: string;
  payload: NormalizedMessagePayload;
  instanceId?: string;
  idempotencyKey?: string;
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
    default:
      return 'TEXT';
  }
};

export const sendOnTicket = async ({
  tenantId,
  operatorId,
  ticketId,
  payload,
  instanceId,
  idempotencyKey,
}: SendOnTicketParams): Promise<OutboundMessageResponse> => {
  const ticket = await storageFindTicketById(tenantId, ticketId);

  if (!ticket) {
    throw new NotFoundError('Ticket', ticketId);
  }

  if (ticket.tenantId !== tenantId) {
    throw new ConflictError('Ticket belongs to another tenant');
  }

  const contact = await prisma.contact.findUnique({ where: { id: ticket.contactId } });

  if (!contact || contact.tenantId !== tenantId) {
    throw new NotFoundError('Contact', ticket.contactId);
  }

  const phone = contact.phone?.trim();

  if (!phone) {
    throw new PhoneNormalizationError('Contato não possui telefone cadastrado.');
  }

  const targetInstanceId = instanceId ?? resolveWhatsAppInstanceId(ticket);

  if (!targetInstanceId) {
    throw new Error('WHATSAPP_INSTANCE_REQUIRED');
  }

  await ensureWhatsAppInstanceAccessible(tenantId, targetInstanceId);

  let payloadHash: string | null = null;
  if (idempotencyKey) {
    payloadHash = hashIdempotentPayload({
      tenantId,
      ticketId,
      instanceId: targetInstanceId,
      payload,
    });

    const cached = getIdempotentValue<OutboundMessageResponse>(tenantId, idempotencyKey);
    if (cached && cached.payloadHash === payloadHash) {
      return cached.value;
    }
  }

  const rateLimit = resolveInstanceRateLimit(targetInstanceId);
  assertWithinRateLimit(rateKeyForInstance(tenantId, targetInstanceId), rateLimit);

  const metadata: Record<string, unknown> = {};
  if (typeof payload.previewUrl === 'boolean') {
    metadata.previewUrl = payload.previewUrl;
  }
  if (idempotencyKey) {
    metadata.idempotencyKey = idempotencyKey;
  }

  const messageInput: SendMessageDTO = {
    ticketId,
    type: toMessageType(payload.type),
    instanceId: targetInstanceId,
    content: payload.content,
    caption: payload.caption,
    mediaUrl: payload.mediaUrl,
    mediaFileName: payload.mediaFileName,
    mediaMimeType: payload.mediaMimeType,
    metadata,
    idempotencyKey,
  };

  const startedAt = Date.now();
  const message = await sendMessage(tenantId, operatorId, messageInput);
  const latencyMs = Date.now() - startedAt;
  const metricsInstanceId = message.instanceId ?? targetInstanceId;

  whatsappOutboundMetrics.incTotal(
    {
      instanceId: metricsInstanceId,
      status: message.status,
    },
    1
  );
  whatsappOutboundMetrics.observeLatency({ instanceId: metricsInstanceId }, latencyMs);

  const response = buildOutboundResponse(message);

  if (idempotencyKey && payloadHash) {
    rememberIdempotency(tenantId, idempotencyKey, payloadHash, response, IDEMPOTENCY_TTL_MS);
  }

  return response;
};

type SendToContactParams = {
  tenantId: string;
  operatorId: string;
  contactId: string;
  payload: NormalizedMessagePayload;
  instanceId?: string;
  to?: string;
  idempotencyKey?: string;
};

export const sendToContact = async ({
  tenantId,
  operatorId,
  contactId,
  payload,
  instanceId,
  to,
  idempotencyKey,
}: SendToContactParams): Promise<OutboundMessageResponse> => {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });

  if (!contact || contact.tenantId !== tenantId) {
    throw new NotFoundError('Contact', contactId);
  }

  if (instanceId) {
    await ensureWhatsAppInstanceAccessible(tenantId, instanceId);
  }

  let normalizedPhone = contact.phone?.trim() ?? undefined;

  if (to) {
    const normalized = normalizePhoneNumber(to);
    normalizedPhone = normalized.e164;

    if (contact.phone !== normalizedPhone) {
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          phone: normalizedPhone,
          lastInteractionAt: new Date(),
        },
      });
    }
  }

  if (!normalizedPhone) {
    throw new PhoneNormalizationError('Contato sem telefone válido para envio.');
  }

  const existingTickets = await findTicketsByContact(tenantId, contactId);
  let activeTicket = existingTickets.find((ticket) => OPEN_STATUSES.has(ticket.status));

  if (!activeTicket) {
    const queueId = await resolveDefaultQueueId(tenantId);
    activeTicket = await createTicket({
      tenantId,
      contactId,
      queueId,
      channel: 'WHATSAPP',
      metadata: {
        whatsappInstanceId: instanceId ?? null,
        phone: normalizedPhone,
      },
    });
  }

  return sendOnTicket({
    tenantId,
    operatorId,
    ticketId: activeTicket.id,
    payload,
    instanceId,
    idempotencyKey,
  });
};

type SendAdHocParams = {
  tenantId: string;
  operatorId: string;
  instanceId: string;
  to: string;
  payload: NormalizedMessagePayload;
  idempotencyKey?: string;
};

export const sendAdHoc = async ({
  tenantId,
  operatorId,
  instanceId,
  to,
  payload,
  idempotencyKey,
}: SendAdHocParams): Promise<OutboundMessageResponse> => {
  await ensureWhatsAppInstanceAccessible(tenantId, instanceId);

  const normalized = normalizePhoneNumber(to);

  let contact = await prisma.contact.findUnique({
    where: {
      tenantId_phone: {
        tenantId,
        phone: normalized.e164,
      },
    },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        tenantId,
        name: normalized.e164,
        phone: normalized.e164,
        tags: ['whatsapp', 'outbound'],
        lastInteractionAt: new Date(),
      },
    });
  } else {
    contact = await prisma.contact.update({
      where: { id: contact.id },
      data: {
        lastInteractionAt: new Date(),
        phone: normalized.e164,
      },
    });
  }

  return sendToContact({
    tenantId,
    operatorId,
    contactId: contact.id,
    payload,
    instanceId,
    to: normalized.e164,
    idempotencyKey,
  });
};

export const addTicketNote = async (
  tenantId: string,
  ticketId: string,
  author: TicketNoteAuthor,
  input: CreateTicketNoteInput
): Promise<TicketNote> => {
  await getTicketById(tenantId, ticketId);

  const note = await createTicketNote({
    tenantId,
    ticketId,
    authorId: author.id,
    authorName: author.name ?? null,
    authorAvatar: author.avatar ?? null,
    body: input.body,
    visibility: input.visibility,
    tags: input.tags,
    metadata: input.metadata,
  });

  emitTicketEvent(tenantId, ticketId, 'ticket.note.created', note, author.id);

  return note;
};
