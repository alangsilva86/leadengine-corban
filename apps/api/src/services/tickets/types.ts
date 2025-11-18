import type {
  Lead,
  Message,
  Pagination,
  PaginatedResult,
  Ticket,
  TicketStatus,
} from '../types/tickets';
import type { TicketNote, TicketNoteVisibility } from '../data/ticket-note-store';
import type { TicketSalesEvent } from '../data/ticket-sales-event-store';

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
  salesTimeline?: TicketSalesEvent[];
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

export type TicketNoteAuthor = {
  id: string;
  name?: string | null;
  avatar?: string | null;
};

export type ListTicketsOptions = {
  include?: TicketIncludeOption[];
  includeMetrics?: boolean;
};
