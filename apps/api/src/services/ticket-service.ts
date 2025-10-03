import {
  ConflictError,
  Contact,
  CreateTicketDTO,
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

const OPEN_STATUSES = new Set(['OPEN', 'PENDING', 'ASSIGNED']);

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
  const baseResult = await storageListTickets(tenantId, filters, pagination);

  const conversations = await fetchConversationStatsForTickets(tenantId, baseResult.items);
  const contactIds = Array.from(new Set(baseResult.items.map((ticket) => ticket.contactId)));

  const [contacts, leads, notes] = await Promise.all([
    includeSet.has('contact') ? safeResolveContacts(tenantId, contactIds) : Promise.resolve(new Map()),
    includeSet.has('lead') || options.includeMetrics
      ? safeResolveLeads(tenantId, contactIds)
      : Promise.resolve(new Map()),
    includeSet.has('notes') ? resolveTicketNotes(tenantId, baseResult.items) : Promise.resolve(new Map()),
  ]);

  const hydratedItems: TicketHydrated[] = baseResult.items.map((ticket) => {
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

  const metrics = options.includeMetrics ? calculateInboxMetrics(baseResult.items, conversations, leads) : undefined;

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
  const message = await storageCreateMessage(tenantId, input.ticketId, {
    ...input,
    direction: userId ? 'OUTBOUND' : 'INBOUND',
    userId,
    status: 'SENT',
  });

  if (!message) {
    throw new NotFoundError('Ticket', input.ticketId);
  }

  emitTicketEvent(tenantId, input.ticketId, 'ticket.message', message, userId ?? null);
  emitTicketEvent(tenantId, input.ticketId, 'ticket.message.created', message, userId ?? null);
  emitTicketEvent(
    tenantId,
    input.ticketId,
    'message.status.changed',
    {
      ticketId: input.ticketId,
      messageId: message.id,
      status: message.status,
    },
    userId ?? null
  );

  const ticket = await storageFindTicketById(tenantId, input.ticketId);
  if (ticket) {
    emitTicketEvent(tenantId, ticket.id, 'ticket.updated', ticket, ticket.userId ?? null);
  }

  return message;
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
