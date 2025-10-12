import {
  Prisma,
  $Enums,
  type Message as PrismaMessage,
  type Ticket as PrismaTicket,
  type Contact as PrismaContact,
  type Queue as PrismaQueue,
} from '@prisma/client';
import {
  type Contact,
  type CreateTicketDTO,
  type Message,
  type MessageFilters,
  type Pagination,
  type PaginatedResult,
  type SendMessageDTO,
  type Ticket,
  type TicketFilters,
  type TicketStatus,
  type UpdateTicketDTO,
} from '@ticketz/core';

import { getPrismaClient } from '../prisma-client';

type PrismaMessageType = $Enums.MessageType;

const PRISMA_MESSAGE_TYPES = new Set<PrismaMessageType>(
  Object.values($Enums.MessageType)
);

const mapPrismaMessageTypeToDomain = (
  type: PrismaMessageType
): Message['type'] => {
  if (type === $Enums.MessageType.STICKER) {
    return 'IMAGE';
  }

  return type as Message['type'];
};

const normalizeMessageTypeForWrite = (
  type: Message['type'] | undefined
): PrismaMessageType => {
  if (type && PRISMA_MESSAGE_TYPES.has(type as PrismaMessageType)) {
    return type as PrismaMessageType;
  }

  return $Enums.MessageType.TEXT;
};

const normalizeMessageTypesForFilter = (
  types: Message['type'][] | undefined
): PrismaMessageType[] => {
  if (!types?.length) {
    return [];
  }

  return types
    .map((type) => {
      if (PRISMA_MESSAGE_TYPES.has(type as PrismaMessageType)) {
        return type as PrismaMessageType;
      }

      return type === 'TEMPLATE' ? $Enums.MessageType.TEXT : null;
    })
    .filter((value): value is PrismaMessageType => value !== null);
};

const defaultPagination = (
  pagination: Pagination
): Pagination & Required<Pick<Pagination, 'page' | 'limit' | 'sortOrder'>> => ({
  page: pagination.page ?? 1,
  limit: pagination.limit ?? 20,
  sortBy: pagination.sortBy,
  sortOrder: pagination.sortOrder ?? 'desc',
});

const mapTicket = (record: PrismaTicket): Ticket => ({
  id: record.id,
  tenantId: record.tenantId,
  contactId: record.contactId,
  queueId: record.queueId,
  userId: record.userId ?? undefined,
  status: record.status as TicketStatus,
  priority: record.priority,
  subject: record.subject ?? undefined,
  channel: record.channel,
  lastMessageAt: record.lastMessageAt ?? undefined,
  lastMessagePreview: record.lastMessagePreview ?? undefined,
  tags: [...record.tags],
  metadata: (record.metadata as Record<string, unknown>) ?? {},
  closedAt: record.closedAt ?? undefined,
  closedBy: record.closedBy ?? undefined,
  closeReason: record.closeReason ?? undefined,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const mapContact = (record: PrismaContact): Contact => ({
  id: record.id,
  tenantId: record.tenantId,
  name: record.name,
  phone: record.phone ?? undefined,
  email: record.email ?? undefined,
  document: record.document ?? undefined,
  avatar: record.avatar ?? undefined,
  isBlocked: record.isBlocked,
  tags: [...record.tags],
  customFields: (record.customFields as Record<string, unknown>) ?? {},
  lastInteractionAt: record.lastInteractionAt ?? undefined,
  notes: record.notes ?? undefined,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const mapMessage = (record: PrismaMessage): Message => ({
  id: record.id,
  tenantId: record.tenantId,
  ticketId: record.ticketId,
  contactId: record.contactId,
  userId: record.userId ?? undefined,
  instanceId: record.instanceId ?? undefined,
  direction: record.direction,
  type: mapPrismaMessageTypeToDomain(record.type),
  content: record.content,
  caption: record.caption ?? undefined,
  mediaUrl: record.mediaUrl ?? undefined,
  mediaFileName: record.mediaFileName ?? undefined,
  mediaType: record.mediaType ?? undefined,
  mediaSize: record.mediaSize ?? undefined,
  status: record.status,
  externalId: record.externalId ?? undefined,
  quotedMessageId: record.quotedMessageId ?? undefined,
  metadata: (record.metadata as Record<string, unknown>) ?? {},
  idempotencyKey: record.idempotencyKey ?? undefined,
  deliveredAt: record.deliveredAt ?? undefined,
  readAt: record.readAt ?? undefined,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const PASSTHROUGH_QUEUE_NAME = 'WhatsApp • Passthrough';
const PASSTHROUGH_QUEUE_DESCRIPTION =
  'Fila criada automaticamente para ingestão de mensagens em modo passthrough.';

const ensurePassthroughQueue = async (tenantId: string): Promise<PrismaQueue> => {
  const prisma = getPrismaClient();

  return prisma.queue.upsert({
    where: {
      tenantId_name: {
        tenantId,
        name: PASSTHROUGH_QUEUE_NAME,
      },
    },
    update: {
      isActive: true,
    },
    create: {
      tenantId,
      name: PASSTHROUGH_QUEUE_NAME,
      description: PASSTHROUGH_QUEUE_DESCRIPTION,
      color: '#22C55E',
      orderIndex: 0,
      settings: {
        passthrough: true,
      },
    },
  });
};

type FindOrCreateTicketByChatInput = {
  tenantId: string;
  chatId: string;
  displayName?: string | null;
  phone?: string | null;
  instanceId?: string | null;
};

type UpsertMessageByExternalIdInput = {
  tenantId: string;
  ticketId: string;
  contactId: string;
  externalId: string;
  direction: Message['direction'];
  type: Message['type'];
  content: string;
  caption?: string | null;
  mediaUrl?: string | null;
  mediaFileName?: string | null;
  mediaMimeType?: string | null;
  metadata?: Record<string, unknown>;
  instanceId?: string | null;
  status?: Message['status'];
  createdAt?: Date;
};

const buildTicketWhere = (tenantId: string, filters: TicketFilters): Prisma.TicketWhereInput => {
  const where: Prisma.TicketWhereInput = {
    tenantId,
  };

  if (filters.status?.length) {
    where.status = { in: filters.status };
  }

  if (filters.priority?.length) {
    where.priority = { in: filters.priority };
  }

  if (filters.queueId?.length) {
    where.queueId = { in: filters.queueId };
  }

  if (filters.userId?.length) {
    where.userId = { in: filters.userId };
  }

  if (filters.channel?.length) {
    where.channel = { in: filters.channel };
  }

  if (filters.tags?.length) {
    where.tags = { hasSome: filters.tags };
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };
  }

  if (filters.search && filters.search.trim().length > 0) {
    const normalized = filters.search.trim();
    const searchOr: Prisma.TicketWhereInput[] = [
      { id: { contains: normalized, mode: 'insensitive' } },
      { subject: { contains: normalized, mode: 'insensitive' } },
      { contactId: { contains: normalized, mode: 'insensitive' } },
      { queueId: { contains: normalized, mode: 'insensitive' } },
      { userId: { contains: normalized, mode: 'insensitive' } },
      { tags: { has: normalized } },
      {
        metadata: {
          path: ['summary'],
          string_contains: normalized,
        },
      },
    ];
    const existingAnd = Array.isArray(where.AND)
      ? where.AND
      : where.AND
        ? [where.AND]
        : [];
    where.AND = [...existingAnd, { OR: searchOr }];
  }

  return where;
};

const buildTicketOrderBy = (
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'desc'
): Prisma.TicketOrderByWithRelationInput => {
  const allowedFields = new Set(['createdAt', 'updatedAt', 'lastMessageAt', 'priority']);
  const field = allowedFields.has(sortBy ?? '') ? (sortBy as keyof PrismaTicket) : 'createdAt';

  return {
    [field]: sortOrder,
  } as Prisma.TicketOrderByWithRelationInput;
};

const buildMessageWhere = (tenantId: string, filters: MessageFilters): Prisma.MessageWhereInput => {
  const where: Prisma.MessageWhereInput = {
    tenantId,
  };

  if (filters.ticketId) {
    where.ticketId = filters.ticketId;
  }

  if (filters.contactId) {
    where.contactId = filters.contactId;
  }

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.direction?.length) {
    where.direction = { in: filters.direction };
  }

  const normalizedTypes = normalizeMessageTypesForFilter(filters.type);
  if (normalizedTypes.length) {
    where.type = { in: normalizedTypes };
  }

  if (filters.status?.length) {
    where.status = { in: filters.status };
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };
  }

  if (filters.search && filters.search.trim().length > 0) {
    const normalized = filters.search.trim();
    const searchOr: Prisma.MessageWhereInput[] = [
      { id: { contains: normalized, mode: 'insensitive' } },
      { content: { contains: normalized, mode: 'insensitive' } },
      { metadata: { path: ['summary'], string_contains: normalized } },
    ];
    const existingAnd = Array.isArray(where.AND)
      ? where.AND
      : where.AND
        ? [where.AND]
        : [];
    where.AND = [...existingAnd, { OR: searchOr }];
  }

  return where;
};

const resolveTimestamp = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? value : value * 1000;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const mergeMessageMetadata = (
  current: Prisma.JsonValue | null | undefined,
  updates?: Record<string, unknown> | null
): Prisma.InputJsonValue => {
  const base =
    current && typeof current === 'object' && !Array.isArray(current)
      ? ({ ...(current as Record<string, unknown>) } as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  if (!updates) {
    return base as Prisma.InputJsonValue;
  }

  return {
    ...base,
    ...updates,
  } as Prisma.InputJsonValue;
};

export const resetTicketStore = async (): Promise<void> => {
  const prisma = getPrismaClient();
  await prisma.$transaction([
    prisma.message.deleteMany({}),
    prisma.ticket.deleteMany({}),
  ]);
};

export const findTicketById = async (tenantId: string, ticketId: string): Promise<Ticket | null> => {
  const prisma = getPrismaClient();
  const record = await prisma.ticket.findFirst({
    where: { id: ticketId, tenantId },
  });

  return record ? mapTicket(record) : null;
};

export const findTicketsByContact = async (tenantId: string, contactId: string): Promise<Ticket[]> => {
  const prisma = getPrismaClient();
  const records = await prisma.ticket.findMany({
    where: { tenantId, contactId },
  });

  return records.map(mapTicket);
};

export const createTicket = async (input: CreateTicketDTO): Promise<Ticket> => {
  const prisma = getPrismaClient();
  const record = await prisma.ticket.create({
    data: {
      tenantId: input.tenantId,
      contactId: input.contactId,
      queueId: input.queueId,
      status: 'OPEN',
      priority: input.priority ?? 'NORMAL',
      subject: input.subject ?? null,
      channel: input.channel,
      tags: input.tags ?? [],
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });

  return mapTicket(record);
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
  const prisma = getPrismaClient();
  const existing = await prisma.ticket.findFirst({
    where: { id: ticketId, tenantId },
  });

  if (!existing) {
    return null;
  }

  const data: Prisma.TicketUncheckedUpdateInput = {};

  if (typeof input.status === 'string') {
    data.status = input.status as TicketStatus;
  }

  if (typeof input.priority === 'string') {
    data.priority = input.priority;
  }

  if (input.subject !== undefined) {
    data.subject = input.subject ?? null;
  }

  if (input.userId !== undefined) {
    data.userId = input.userId ?? null;
  }

  if (typeof input.queueId === 'string') {
    data.queueId = input.queueId;
  }

  if (Array.isArray(input.tags)) {
    data.tags = { set: input.tags };
  }

  if (input.metadata !== undefined) {
    data.metadata = (input.metadata ?? {}) as Prisma.InputJsonValue;
  }

  if (input.closeReason !== undefined) {
    data.closeReason = input.closeReason ?? null;
  }

  if (input.lastMessageAt !== undefined) {
    data.lastMessageAt = input.lastMessageAt ?? null;
  }

  if (input.lastMessagePreview !== undefined) {
    data.lastMessagePreview = input.lastMessagePreview ?? null;
  }

  if (input.closedAt !== undefined) {
    data.closedAt = input.closedAt ?? null;
  }

  if (input.closedBy !== undefined) {
    data.closedBy = input.closedBy ?? null;
  }

  await prisma.ticket.update({
    where: { id: existing.id },
    data,
  });

  const updated = await prisma.ticket.findUnique({ where: { id: existing.id } });
  return updated ? mapTicket(updated) : null;
};

export const assignTicket = async (
  tenantId: string,
  ticketId: string,
  userId: string
): Promise<Ticket | null> => {
  return updateTicket(tenantId, ticketId, { userId, status: 'ASSIGNED' });
};

export const closeTicket = async (
  tenantId: string,
  ticketId: string,
  reason: string | undefined,
  userId: string | undefined
): Promise<Ticket | null> => {
  const now = new Date();
  return updateTicket(tenantId, ticketId, {
    status: 'CLOSED',
    closeReason: reason,
    closedAt: now,
    closedBy: userId ?? null,
  });
};

export const listTickets = async (
  tenantId: string,
  filters: TicketFilters,
  pagination: Pagination
): Promise<PaginatedResult<Ticket>> => {
  const prisma = getPrismaClient();
  const normalized = defaultPagination(pagination);
  const where = buildTicketWhere(tenantId, filters);
  const orderBy = buildTicketOrderBy(normalized.sortBy, normalized.sortOrder);

  const [total, records] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      orderBy,
      skip: (normalized.page - 1) * normalized.limit,
      take: normalized.limit,
    }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / normalized.limit);

  return {
    items: records.map(mapTicket),
    total,
    page: normalized.page,
    limit: normalized.limit,
    totalPages,
    hasNext: normalized.page < totalPages,
    hasPrev: normalized.page > 1 && total > 0,
  };
};

export const createMessage = async (
  tenantId: string,
  ticketId: string,
  input: SendMessageDTO & {
    userId?: string;
    direction: Message['direction'];
    status?: Message['status'];
    instanceId?: string | null;
    idempotencyKey?: string | null;
  }
): Promise<Message | null> => {
  const prisma = getPrismaClient();
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, tenantId } });

  if (!ticket) {
    return null;
  }

  const metadataRecord = (input.metadata ?? {}) as Record<string, unknown>;
  const createdAtCandidate =
    resolveTimestamp(metadataRecord['normalizedTimestamp']) ??
    resolveTimestamp(metadataRecord['brokerMessageTimestamp']) ??
    resolveTimestamp(metadataRecord['receivedAt']);
  const createdAt = createdAtCandidate ? new Date(createdAtCandidate) : new Date();
  const previewSource = input.content && input.content.trim().length > 0 ? input.content : input.caption ?? '';
  const lastMessagePreview = previewSource.slice(0, 280);

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        tenantId,
        ticketId,
        contactId: ticket.contactId,
        userId: input.userId ?? null,
        instanceId: input.instanceId ?? null,
        direction: input.direction,
        type: normalizeMessageTypeForWrite(input.type),
        content: (input.content ?? '').trim(),
        caption: input.caption ?? null,
        mediaUrl: input.mediaUrl ?? null,
        mediaFileName: input.mediaFileName ?? null,
        mediaType: input.mediaMimeType ?? null,
        status: input.status ?? 'SENT',
        quotedMessageId: input.quotedMessageId ?? null,
        metadata: metadataRecord as Prisma.InputJsonValue,
        idempotencyKey: input.idempotencyKey ?? null,
        externalId: input.externalId ?? null,
        createdAt,
        updatedAt: createdAt,
      },
    });

    const currentMetadata =
      ticket.metadata && typeof ticket.metadata === 'object'
        ? ({ ...(ticket.metadata as Record<string, unknown>) } as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    const timelineSource =
      currentMetadata['timeline'] && typeof currentMetadata['timeline'] === 'object'
        ? ({ ...(currentMetadata['timeline'] as Record<string, unknown>) } as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    const createdAtTime = createdAt.getTime();
    const timestampIso = createdAt.toISOString();

    const ensureMin = (key: 'firstInboundAt' | 'firstOutboundAt') => {
      const currentValue = resolveTimestamp(timelineSource[key]);
      if (currentValue === null || createdAtTime < currentValue) {
        timelineSource[key] = timestampIso;
      }
    };

    const ensureMax = (key: 'lastInboundAt' | 'lastOutboundAt') => {
      const currentValue = resolveTimestamp(timelineSource[key]);
      if (currentValue === null || createdAtTime >= currentValue) {
        timelineSource[key] = timestampIso;
      }
    };

    if (created.direction === 'INBOUND') {
      ensureMin('firstInboundAt');
      ensureMax('lastInboundAt');
    } else {
      ensureMin('firstOutboundAt');
      ensureMax('lastOutboundAt');
    }

    if (Object.keys(timelineSource).length > 0) {
      currentMetadata['timeline'] = timelineSource;
    }

    await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        metadata: currentMetadata as Prisma.InputJsonValue,
        lastMessageAt: createdAt,
        lastMessagePreview,
        updatedAt: createdAt,
      },
    });

    return created;
  });

  return mapMessage(message);
};

export const listMessages = async (
  tenantId: string,
  filters: MessageFilters,
  pagination: Pagination
): Promise<PaginatedResult<Message>> => {
  const prisma = getPrismaClient();
  const normalized = defaultPagination(pagination);
  const where = buildMessageWhere(tenantId, filters);

  const [total, records] = await Promise.all([
    prisma.message.count({ where }),
    prisma.message.findMany({
      where,
      orderBy: { createdAt: normalized.sortOrder },
      skip: (normalized.page - 1) * normalized.limit,
      take: normalized.limit,
    }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / normalized.limit);

  return {
    items: records.map(mapMessage),
    total,
    page: normalized.page,
    limit: normalized.limit,
    totalPages,
    hasNext: normalized.page < totalPages,
    hasPrev: normalized.page > 1 && total > 0,
  };
};

export const updateMessage = async (
  tenantId: string,
  messageId: string,
  updates: {
    status?: Message['status'];
    externalId?: string | null;
    metadata?: Record<string, unknown> | null;
    deliveredAt?: Date | null;
    readAt?: Date | null;
    instanceId?: string | null;
  }
): Promise<Message | null> => {
  const prisma = getPrismaClient();
  const existing = await prisma.message.findFirst({ where: { id: messageId, tenantId } });

  if (!existing) {
    return null;
  }

  const data: Prisma.MessageUpdateInput = {};

  if (typeof updates.status === 'string') {
    data.status = updates.status;
  }

  if (updates.externalId !== undefined) {
    data.externalId = updates.externalId ?? null;
  }

  if (updates.metadata !== undefined) {
    data.metadata = mergeMessageMetadata(existing.metadata, updates.metadata);
  }

  if (updates.deliveredAt !== undefined) {
    data.deliveredAt = updates.deliveredAt ?? null;
  }

  if (updates.readAt !== undefined) {
    data.readAt = updates.readAt ?? null;
  }

  if (updates.instanceId !== undefined) {
    data.instanceId = updates.instanceId ?? null;
  }

  const updated = await prisma.message.update({
    where: { id: existing.id },
    data,
  });

  return mapMessage(updated);
};

export const findMessageByExternalId = async (
  tenantId: string,
  externalId: string
): Promise<Message | null> => {
  const prisma = getPrismaClient();
  const trimmed = externalId.trim();
  if (!trimmed) {
    return null;
  }

  const existing = await prisma.message.findFirst({
    where: {
      tenantId,
      externalId: trimmed,
    },
  });

  return existing ? mapMessage(existing) : null;
};

export const findOrCreateOpenTicketByChat = async (
  input: FindOrCreateTicketByChatInput
): Promise<{ ticket: Ticket; contact: Contact }> => {
  const prisma = getPrismaClient();
  const normalizedChatId = input.chatId.trim();
  const now = new Date();
  const displayName = input.displayName && input.displayName.trim().length > 0 ? input.displayName.trim() : normalizedChatId;
  const phone = input.phone && input.phone.trim().length > 0 ? input.phone.trim() : normalizedChatId;

  const contactRecord = await prisma.contact.upsert({
    where: {
      tenantId_phone: {
        tenantId: input.tenantId,
        phone,
      },
    },
    update: {
      name: displayName,
      phone,
      lastInteractionAt: now,
    },
    create: {
      tenantId: input.tenantId,
      name: displayName,
      phone,
      tags: ['whatsapp', 'passthrough'],
      lastInteractionAt: now,
      customFields: {
        passthroughChatId: normalizedChatId,
      },
    },
  });

  let ticketRecord = await prisma.ticket.findFirst({
    where: {
      tenantId: input.tenantId,
      contactId: contactRecord.id,
      status: {
        in: ['OPEN', 'PENDING', 'ASSIGNED'],
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  });

  if (!ticketRecord) {
    const queue = await ensurePassthroughQueue(input.tenantId);
    ticketRecord = await prisma.ticket.create({
      data: {
        tenantId: input.tenantId,
        contactId: contactRecord.id,
        queueId: queue.id,
        channel: 'WHATSAPP',
        priority: 'NORMAL',
        status: 'OPEN',
        subject: displayName,
        metadata: {
          chatId: normalizedChatId,
          passthrough: true,
          instanceId: input.instanceId ?? null,
        },
      },
    });
  } else {
    const existingMetadata =
      ticketRecord.metadata && typeof ticketRecord.metadata === 'object'
        ? ({ ...(ticketRecord.metadata as Record<string, unknown>) } as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    existingMetadata.chatId = existingMetadata.chatId ?? normalizedChatId;
    existingMetadata.passthrough = true;
    if (input.instanceId) {
      existingMetadata.instanceId = input.instanceId;
    }

    ticketRecord = await prisma.ticket.update({
      where: { id: ticketRecord.id },
      data: {
        metadata: existingMetadata as Prisma.InputJsonValue,
        updatedAt: now,
      },
    });
  }

  return {
    ticket: mapTicket(ticketRecord),
    contact: mapContact(contactRecord),
  };
};

export const upsertMessageByExternalId = async (
  input: UpsertMessageByExternalIdInput
): Promise<{ message: Message; created: boolean }> => {
  const prisma = getPrismaClient();
  const normalizedExternalId = input.externalId.trim();
  const metadataRecord = input.metadata ?? {};
  const createdAt = input.createdAt ?? new Date();

  const existing = await prisma.message.findFirst({
    where: {
      tenantId: input.tenantId,
      externalId: normalizedExternalId,
    },
  });

  if (existing) {
    const updated = await prisma.message.update({
      where: { id: existing.id },
      data: {
        content: input.content,
        caption: input.caption ?? null,
        mediaUrl: input.mediaUrl ?? null,
        mediaFileName: input.mediaFileName ?? null,
        mediaType: input.mediaMimeType ?? null,
        metadata: mergeMessageMetadata(existing.metadata, metadataRecord),
        instanceId: input.instanceId ?? existing.instanceId ?? null,
        direction: input.direction,
        type: normalizeMessageTypeForWrite(input.type),
        updatedAt: createdAt,
      },
    });

    return {
      message: mapMessage(updated),
      created: false,
    };
  }

  const created = await prisma.message.create({
    data: {
      tenantId: input.tenantId,
      ticketId: input.ticketId,
      contactId: input.contactId,
      userId: null,
      instanceId: input.instanceId ?? null,
      direction: input.direction,
      type: normalizeMessageTypeForWrite(input.type),
      content: input.content,
      caption: input.caption ?? null,
      mediaUrl: input.mediaUrl ?? null,
      mediaFileName: input.mediaFileName ?? null,
      mediaType: input.mediaMimeType ?? null,
      status: input.status ?? 'SENT',
      externalId: normalizedExternalId,
      metadata: metadataRecord as Prisma.InputJsonValue,
      createdAt,
      updatedAt: createdAt,
    },
  });

  return {
    message: mapMessage(created),
    created: true,
  };
};

export const createOutboundMessage = async (
  tenantId: string,
  ticketId: string,
  input: SendMessageDTO & {
    userId?: string;
    instanceId?: string | null;
    idempotencyKey?: string | null;
    status?: Message['status'];
  }
): Promise<Message | null> => {
  return createMessage(tenantId, ticketId, {
    ...input,
    userId: input.userId,
    direction: 'OUTBOUND',
    status: input.status ?? 'PENDING',
    instanceId: input.instanceId ?? undefined,
    idempotencyKey: input.idempotencyKey ?? undefined,
  });
};

export const applyBrokerAck = async (
  tenantId: string,
  messageId: string,
  ack: {
    status?: Message['status'];
    externalId?: string;
    metadata?: Record<string, unknown>;
    deliveredAt?: Date | null;
    readAt?: Date | null;
    instanceId?: string | null;
  }
): Promise<Message | null> => {
  return updateMessage(tenantId, messageId, {
    status: ack.status,
    externalId: ack.externalId,
    metadata: ack.metadata ?? undefined,
    deliveredAt: ack.deliveredAt ?? undefined,
    readAt: ack.readAt ?? undefined,
    instanceId: ack.instanceId ?? undefined,
  });
};
