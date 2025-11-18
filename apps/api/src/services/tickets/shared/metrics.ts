import type {
  InboxHealthMetrics,
  Message,
  Ticket,
  TicketLeadSummary,
  TicketTimelineSnapshot,
  TicketWindowSnapshot,
} from '../../types/tickets';
import { listMessages as storageListMessages } from '@ticketz/storage';

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

export const fetchConversationStatsForTickets = async (
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

export const calculateInboxMetrics = (
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

    const stageKey = ticket.stage ?? 'desconhecido';
    const stage = typeof ticket.metadata?.pipelineStep === 'string' ? ticket.metadata.pipelineStep : stageKey;
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

export type { ConversationComputation };
