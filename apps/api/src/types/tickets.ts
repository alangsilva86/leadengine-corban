import { $Enums } from '@prisma/client';

export type TicketStatus = $Enums.TicketStatus;
export type TicketPriority = $Enums.TicketPriority;
export type ChannelType = $Enums.ChannelType;
export type MessageStatus = $Enums.MessageStatus;
export type MessageType = $Enums.MessageType | 'TEMPLATE';
export type MessageDirection = $Enums.MessageDirection;
export type LeadStatus = $Enums.LeadStatus;
export type LeadSource = $Enums.LeadSource;

export type SortOrder = 'asc' | 'desc';

export interface Pagination {
  page?: number | undefined;
  limit?: number | undefined;
  sortBy?: string | undefined;
  sortOrder?: SortOrder | undefined;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface TicketFilters {
  status?: TicketStatus[] | undefined;
  priority?: TicketPriority[] | undefined;
  queueId?: string[] | undefined;
  userId?: string[] | undefined;
  channel?: ChannelType[] | undefined;
  tags?: string[] | undefined;
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
  search?: string | undefined;
}

export interface MessageFilters {
  ticketId?: string | undefined;
  contactId?: string | undefined;
  userId?: string | undefined;
  direction?: MessageDirection[] | undefined;
  type?: MessageType[] | undefined;
  status?: MessageStatus[] | undefined;
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
  search?: string | undefined;
}

export interface CreateTicketDTO {
  tenantId: string;
  contactId: string;
  queueId: string;
  subject?: string | undefined;
  channel: ChannelType;
  priority?: TicketPriority | undefined;
  tags?: string[] | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface UpdateTicketDTO {
  status?: TicketStatus | undefined;
  priority?: TicketPriority | undefined;
  subject?: string | undefined;
  userId?: string | undefined;
  queueId?: string | undefined;
  tags?: string[] | undefined;
  metadata?: Record<string, unknown> | undefined;
  closeReason?: string | undefined;
}

export interface SendMessageDTO {
  ticketId: string;
  type?: MessageType | undefined;
  instanceId?: string | undefined;
  direction: MessageDirection;
  content?: string | undefined;
  caption?: string | undefined;
  externalId?: string | undefined;
  mediaUrl?: string | undefined;
  mediaFileName?: string | undefined;
  mediaMimeType?: string | undefined;
  quotedMessageId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  idempotencyKey?: string | undefined;
}

export interface Ticket {
  id: string;
  tenantId: string;
  contactId: string;
  queueId: string;
  userId?: string | undefined;
  status: TicketStatus;
  priority: TicketPriority;
  subject?: string | undefined;
  channel: ChannelType;
  lastMessageAt?: Date | undefined;
  lastMessagePreview?: string | undefined;
  tags: string[];
  metadata: Record<string, unknown>;
  closedAt?: Date | undefined;
  closedBy?: string | undefined;
  closeReason?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  tenantId: string;
  ticketId: string;
  contactId: string;
  userId?: string | undefined;
  instanceId?: string | undefined;
  direction: MessageDirection;
  type: MessageType;
  content: string;
  caption?: string | undefined;
  mediaUrl?: string | undefined;
  mediaFileName?: string | undefined;
  mediaType?: string | undefined;
  mediaSize?: number | undefined;
  status: MessageStatus;
  externalId?: string | undefined;
  quotedMessageId?: string | undefined;
  metadata: Record<string, unknown>;
  idempotencyKey?: string | undefined;
  deliveredAt?: Date | undefined;
  readAt?: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface Contact {
  id: string;
  tenantId: string;
  name: string;
  phone?: string | undefined;
  email?: string | undefined;
  document?: string | undefined;
  avatar?: string | undefined;
  isBlocked: boolean;
  tags: string[];
  customFields: Record<string, unknown>;
  lastInteractionAt?: Date | undefined;
  notes?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lead {
  id: string;
  tenantId: string;
  contactId: string;
  campaignId?: string | undefined;
  userId?: string | undefined;
  status: LeadStatus;
  source: LeadSource;
  score?: Record<string, unknown> | null | undefined;
  value?: number | undefined;
  probability?: number | undefined;
  expectedCloseDate?: Date | undefined;
  actualCloseDate?: Date | undefined;
  lostReason?: string | undefined;
  tags: string[];
  customFields: Record<string, unknown>;
  lastContactAt?: Date | undefined;
  nextFollowUpAt?: Date | undefined;
  notes?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}
