import { randomUUID } from 'node:crypto';
import {
  CreateTicketDTO,
  Message,
  MessageFilters,
  Pagination,
  PaginatedResult,
  SendMessageDTO,
  Ticket,
  TicketFilters,
  TicketStatus,
  UpdateTicketDTO,
} from '@ticketz/core';

type TicketRecord = Ticket & {
  lastMessagePreview?: string;
};

type MessageRecord = Message;

const ticketsByTenant = new Map<string, Map<string, TicketRecord>>();
const messagesByTenant = new Map<string, Map<string, MessageRecord>>();

const defaultPagination = (
  pagination: Pagination
): Pagination & Required<Pick<Pagination, 'page' | 'limit' | 'sortOrder'>> => ({
  page: pagination.page ?? 1,
  limit: pagination.limit ?? 20,
  sortBy: pagination.sortBy,
  sortOrder: pagination.sortOrder ?? 'desc',
});

const getTicketBucket = (tenantId: string) => {
  let bucket = ticketsByTenant.get(tenantId);
  if (!bucket) {
    bucket = new Map<string, TicketRecord>();
    ticketsByTenant.set(tenantId, bucket);
  }
  return bucket;
};

const getMessageBucket = (tenantId: string) => {
  let bucket = messagesByTenant.get(tenantId);
  if (!bucket) {
    bucket = new Map<string, MessageRecord>();
    messagesByTenant.set(tenantId, bucket);
  }
  return bucket;
};

const toTicket = (record: TicketRecord): Ticket => ({
  ...record,
  tags: [...record.tags],
  metadata: { ...record.metadata },
});

const toMessage = (record: MessageRecord): Message => ({
  ...record,
  metadata: { ...record.metadata },
});

const matchesTicketFilters = (ticket: TicketRecord, filters: TicketFilters): boolean => {
  if (filters.status && filters.status.length > 0 && !filters.status.includes(ticket.status)) {
    return false;
  }

  if (filters.priority && filters.priority.length > 0 && !filters.priority.includes(ticket.priority)) {
    return false;
  }

  if (filters.queueId && filters.queueId.length > 0 && !filters.queueId.includes(ticket.queueId)) {
    return false;
  }

  if (filters.userId && filters.userId.length > 0 && (!ticket.userId || !filters.userId.includes(ticket.userId))) {
    return false;
  }

  if (filters.channel && filters.channel.length > 0 && !filters.channel.includes(ticket.channel)) {
    return false;
  }

  if (filters.tags && filters.tags.length > 0) {
    const hasTag = ticket.tags.some((tag) => filters.tags?.includes(tag));
    if (!hasTag) {
      return false;
    }
  }

  if (filters.dateFrom && ticket.createdAt < filters.dateFrom) {
    return false;
  }

  if (filters.dateTo && ticket.createdAt > filters.dateTo) {
    return false;
  }

  if (filters.search && filters.search.trim().length > 0) {
    const normalized = filters.search.trim().toLowerCase();
    const searchableValues = [
      ticket.id,
      ticket.subject ?? '',
      ticket.contactId,
      ticket.queueId,
      ticket.userId ?? '',
      ticket.tags.join(' '),
      ticket.metadata?.summary ? String(ticket.metadata.summary) : '',
    ];

    const hasMatch = searchableValues.some((value) => value.toLowerCase().includes(normalized));
    if (!hasMatch) {
      return false;
    }
  }

  return true;
};

const matchesMessageFilters = (message: MessageRecord, filters: MessageFilters): boolean => {
  if (filters.ticketId && message.ticketId !== filters.ticketId) {
    return false;
  }

  if (filters.contactId && message.contactId !== filters.contactId) {
    return false;
  }

  if (filters.userId && message.userId !== filters.userId) {
    return false;
  }

  if (filters.direction && filters.direction.length > 0 && !filters.direction.includes(message.direction)) {
    return false;
  }

  if (filters.type && filters.type.length > 0 && !filters.type.includes(message.type)) {
    return false;
  }

  if (filters.status && filters.status.length > 0 && !filters.status.includes(message.status)) {
    return false;
  }

  if (filters.dateFrom && message.createdAt < filters.dateFrom) {
    return false;
  }

  if (filters.dateTo && message.createdAt > filters.dateTo) {
    return false;
  }

  if (filters.search && filters.search.trim().length > 0) {
    const normalized = filters.search.trim().toLowerCase();
    const searchableValues = [message.id, message.content, message.metadata?.summary ? String(message.metadata.summary) : ''];
    const hasMatch = searchableValues.some((value) => value.toLowerCase().includes(normalized));
    if (!hasMatch) {
      return false;
    }
  }

  return true;
};

const sortTickets = (tickets: TicketRecord[], sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc') => {
  const direction = sortOrder === 'asc' ? 1 : -1;
  const allowedFields = new Set(['createdAt', 'updatedAt', 'lastMessageAt', 'priority']);
  const field = allowedFields.has(sortBy ?? '') ? (sortBy as keyof TicketRecord) : 'createdAt';

  return tickets.sort((a, b) => {
    const valueA = a[field];
    const valueB = b[field];

    if (valueA === valueB) {
      return 0;
    }

    if (valueA === undefined || valueA === null) {
      return 1;
    }

    if (valueB === undefined || valueB === null) {
      return -1;
    }

    if (valueA instanceof Date && valueB instanceof Date) {
      return valueA.getTime() > valueB.getTime() ? direction : -direction;
    }

    if (typeof valueA === 'string' && typeof valueB === 'string') {
      return valueA.localeCompare(valueB) * direction;
    }

    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return valueA > valueB ? direction : -direction;
    }

    return 0;
  });
};

const sortMessages = (messages: MessageRecord[], sortOrder: 'asc' | 'desc') => {
  const direction = sortOrder === 'asc' ? 1 : -1;
  return messages.sort((a, b) => (a.createdAt > b.createdAt ? direction : -direction));
};

export const resetTicketStore = () => {
  ticketsByTenant.clear();
  messagesByTenant.clear();
};

export const findTicketById = async (tenantId: string, ticketId: string): Promise<Ticket | null> => {
  const bucket = getTicketBucket(tenantId);
  const record = bucket.get(ticketId);
  return record ? toTicket(record) : null;
};

export const findTicketsByContact = async (tenantId: string, contactId: string): Promise<Ticket[]> => {
  const bucket = getTicketBucket(tenantId);
  return Array.from(bucket.values())
    .filter((ticket) => ticket.contactId === contactId)
    .map(toTicket);
};

export const createTicket = async (input: CreateTicketDTO): Promise<Ticket> => {
  const bucket = getTicketBucket(input.tenantId);
  const now = new Date();
  const record: TicketRecord = {
    id: randomUUID(),
    tenantId: input.tenantId,
    contactId: input.contactId,
    queueId: input.queueId,
    userId: undefined,
    status: 'OPEN',
    priority: input.priority ?? 'NORMAL',
    subject: input.subject,
    channel: input.channel,
    lastMessageAt: undefined,
    lastMessagePreview: undefined,
    tags: [...(input.tags ?? [])],
    metadata: { ...(input.metadata ?? {}) },
    closedAt: undefined,
    closedBy: undefined,
    closeReason: undefined,
    createdAt: now,
    updatedAt: now,
  };

  bucket.set(record.id, record);
  return toTicket(record);
};

export const updateTicket = async (
  tenantId: string,
  ticketId: string,
  input: UpdateTicketDTO & {
    lastMessageAt?: Date;
    lastMessagePreview?: string;
    closedAt?: Date | null;
    closedBy?: string | null;
  }
): Promise<Ticket | null> => {
  const bucket = getTicketBucket(tenantId);
  const record = bucket.get(ticketId);
  if (!record) {
    return null;
  }

  if (typeof input.status === 'string') {
    record.status = input.status as TicketStatus;
  }

  if (typeof input.priority === 'string') {
    record.priority = input.priority;
  }

  if (typeof input.subject === 'string' || input.subject === undefined) {
    record.subject = input.subject ?? record.subject;
  }

  if (typeof input.userId === 'string' || input.userId === null) {
    record.userId = input.userId ?? undefined;
  }

  if (typeof input.queueId === 'string') {
    record.queueId = input.queueId;
  }

  if (Array.isArray(input.tags)) {
    record.tags = [...input.tags];
  }

  if (typeof input.metadata === 'object' && input.metadata !== null) {
    record.metadata = { ...input.metadata };
  }

  if (typeof input.closeReason === 'string' || input.closeReason === null) {
    record.closeReason = input.closeReason ?? undefined;
  }

  if (input.lastMessageAt) {
    record.lastMessageAt = input.lastMessageAt;
  }

  if (input.lastMessagePreview) {
    record.lastMessagePreview = input.lastMessagePreview;
  }

  if (input.closedAt !== undefined) {
    record.closedAt = input.closedAt ?? undefined;
  }

  if (input.closedBy !== undefined) {
    record.closedBy = input.closedBy ?? undefined;
  }

  record.updatedAt = new Date();

  return toTicket(record);
};

export const assignTicket = async (
  tenantId: string,
  ticketId: string,
  userId: string
): Promise<Ticket | null> => {
  const updated = await updateTicket(tenantId, ticketId, { userId, status: 'ASSIGNED' });
  return updated;
};

export const closeTicket = async (
  tenantId: string,
  ticketId: string,
  reason: string | undefined,
  userId: string | undefined
): Promise<Ticket | null> => {
  const now = new Date();
  const updated = await updateTicket(tenantId, ticketId, {
    status: 'CLOSED',
    closeReason: reason,
    closedAt: now,
    closedBy: userId ?? null,
  });
  return updated;
};

export const listTickets = async (
  tenantId: string,
  filters: TicketFilters,
  pagination: Pagination
): Promise<PaginatedResult<Ticket>> => {
  const bucket = getTicketBucket(tenantId);
  const normalizedPagination = defaultPagination(pagination);
  const filtered = Array.from(bucket.values()).filter((ticket) => matchesTicketFilters(ticket, filters));
  const sorted = sortTickets(filtered, normalizedPagination.sortBy, normalizedPagination.sortOrder);

  const start = (normalizedPagination.page - 1) * normalizedPagination.limit;
  const end = start + normalizedPagination.limit;
  const paginated = sorted.slice(start, end);
  const total = filtered.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / normalizedPagination.limit);

  return {
    items: paginated.map(toTicket),
    total,
    page: normalizedPagination.page,
    limit: normalizedPagination.limit,
    totalPages,
    hasNext: normalizedPagination.page < totalPages,
    hasPrev: normalizedPagination.page > 1 && total > 0,
  };
};

export const createMessage = async (
  tenantId: string,
  ticketId: string,
  input: SendMessageDTO & {
    userId?: string;
    direction: Message['direction'];
    status?: Message['status'];
  }
): Promise<Message | null> => {
  const ticketsBucket = getTicketBucket(tenantId);
  const ticket = ticketsBucket.get(ticketId);

  if (!ticket) {
    return null;
  }

  const bucket = getMessageBucket(tenantId);
  const now = new Date();
  const record: MessageRecord = {
    id: randomUUID(),
    tenantId,
    ticketId,
    contactId: ticket.contactId,
    userId: input.userId,
    direction: input.direction,
    type: input.type ?? 'TEXT',
    content: input.content,
    mediaUrl: input.mediaUrl,
    mediaType: undefined,
    mediaSize: undefined,
    status: input.status ?? 'SENT',
    externalId: undefined,
    quotedMessageId: input.quotedMessageId,
    metadata: { ...(input.metadata ?? {}) },
    deliveredAt: undefined,
    readAt: undefined,
    createdAt: now,
    updatedAt: now,
  };

  bucket.set(record.id, record);

  ticket.lastMessageAt = now;
  ticket.lastMessagePreview = record.content.slice(0, 280);
  ticket.updatedAt = now;

  return toMessage(record);
};

export const listMessages = async (
  tenantId: string,
  filters: MessageFilters,
  pagination: Pagination
): Promise<PaginatedResult<Message>> => {
  const bucket = getMessageBucket(tenantId);
  const normalizedPagination = defaultPagination(pagination);
  const filtered = Array.from(bucket.values()).filter((message) => matchesMessageFilters(message, filters));
  const sorted = sortMessages(filtered, normalizedPagination.sortOrder);

  const start = (normalizedPagination.page - 1) * normalizedPagination.limit;
  const end = start + normalizedPagination.limit;
  const paginated = sorted.slice(start, end);
  const total = filtered.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / normalizedPagination.limit);

  return {
    items: paginated.map(toMessage),
    total,
    page: normalizedPagination.page,
    limit: normalizedPagination.limit,
    totalPages,
    hasNext: normalizedPagination.page < totalPages,
    hasPrev: normalizedPagination.page > 1 && total > 0,
  };
};

