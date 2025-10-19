import {
  Prisma,
  $Enums,
  type Message as PrismaMessage,
  type Ticket as PrismaTicket,
  type Contact as PrismaContact,
  type ContactPhone as PrismaContactPhone,
  type ContactEmail as PrismaContactEmail,
  type ContactTag as PrismaContactTag,
  type Tag as PrismaTag,
  type Interaction as PrismaInteraction,
  type Task as PrismaTask,
  type Queue as PrismaQueue,
} from '@prisma/client';
import type {
  Contact,
  ContactEmail,
  ContactPhone,
  ContactTag,
  CreateTicketDTO,
  Interaction,
  Message,
  MessageType,
  MessageFilters,
  Pagination,
  PaginatedResult,
  SendMessageDTO,
  SortOrder,
  Tag,
  Task,
  Ticket,
  TicketFilters,
  TicketStatus,
  UpdateTicketDTO,
} from './ticket-types';

import { getPrismaClient } from '../prisma-client';

type PrismaMessageType = $Enums.MessageType;

const PRISMA_MESSAGE_TYPES = new Set<PrismaMessageType>(
  Object.values($Enums.MessageType)
);

type PassthroughMessageDirection = 'inbound' | 'outbound';
type PassthroughMessageType = 'text' | 'media' | 'unknown';

export type PassthroughMessageMedia = {
  mediaType: string;
  url?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  size?: number | null;
  caption?: string | null;
};

export type PassthroughMessage = {
  id: string;
  tenantId: string;
  ticketId: string;
  chatId: string;
  direction: PassthroughMessageDirection;
  type: PassthroughMessageType;
  text: string | null;
  media: PassthroughMessageMedia | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  externalId?: string | null;
};

type UpsertPassthroughMessageInput = {
  tenantId: string;
  ticketId: string;
  chatId: string;
  direction: PassthroughMessageDirection;
  externalId: string;
  type: PassthroughMessageType;
  text: string | null | undefined;
  media?: PassthroughMessageMedia | null;
  metadata?: Record<string, unknown> | null;
  timestamp?: number | string | Date | null;
};

type PrismaContactWithRelations = PrismaContact & {
  phones: PrismaContactPhone[];
  emails: PrismaContactEmail[];
  tags: Array<PrismaContactTag & { tag: PrismaTag }>;
  interactions: PrismaInteraction[];
  tasks: PrismaTask[];
};

const CONTACT_INCLUDE = {
  phones: true,
  emails: true,
  tags: { include: { tag: true } },
  interactions: true,
  tasks: true,
} satisfies Prisma.ContactInclude;

const mapPrismaMessageTypeToDomain = (
  type: PrismaMessageType
): MessageType => {
  if (type === $Enums.MessageType.STICKER) {
    return 'IMAGE';
  }

  return type as MessageType;
};

const normalizeMessageTypeForWrite = (
  type: MessageType | undefined
): PrismaMessageType => {
  if (type && PRISMA_MESSAGE_TYPES.has(type as PrismaMessageType)) {
    return type as PrismaMessageType;
  }

  return $Enums.MessageType.TEXT;
};

const normalizeMessageTypesForFilter = (
  types: MessageType[] | undefined
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

type NormalizedPagination = {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder: SortOrder;
};

const defaultPagination = (pagination: Pagination): NormalizedPagination => ({
  page: pagination.page ?? 1,
  limit: pagination.limit ?? 20,
  ...(pagination.sortBy !== undefined ? { sortBy: pagination.sortBy } : {}),
  sortOrder: pagination.sortOrder ?? 'desc',
});

const mapTagRecord = (record: PrismaTag): Tag => ({
  id: record.id,
  tenantId: record.tenantId,
  name: record.name,
  color: record.color ?? undefined,
  description: record.description ?? undefined,
  isSystem: record.isSystem,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const mapContactPhoneRecord = (record: PrismaContactPhone): ContactPhone => ({
  id: record.id,
  tenantId: record.tenantId,
  contactId: record.contactId,
  phoneNumber: record.phoneNumber,
  type: record.type ?? undefined,
  label: record.label ?? undefined,
  waId: record.waId ?? undefined,
  isPrimary: record.isPrimary,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const mapContactEmailRecord = (record: PrismaContactEmail): ContactEmail => ({
  id: record.id,
  tenantId: record.tenantId,
  contactId: record.contactId,
  email: record.email,
  type: record.type ?? undefined,
  label: record.label ?? undefined,
  isPrimary: record.isPrimary,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const mapContactTagRecord = (
  record: PrismaContactTag & { tag: PrismaTag | null }
): ContactTag | null => {
  if (!record.tag) {
    return null;
  }

  return {
    id: record.id,
    tenantId: record.tenantId,
    contactId: record.contactId,
    tagId: record.tagId,
    addedById: record.addedById ?? undefined,
    addedAt: record.addedAt,
    tag: mapTagRecord(record.tag),
  } satisfies ContactTag;
};

const mapInteractionRecord = (record: PrismaInteraction): Interaction => ({
  id: record.id,
  tenantId: record.tenantId,
  contactId: record.contactId,
  userId: record.userId ?? undefined,
  type: record.type,
  direction: record.direction,
  channel: record.channel ?? undefined,
  subject: record.subject ?? undefined,
  content: record.content ?? undefined,
  metadata: asRecord(record.metadata) ?? {},
  occurredAt: record.occurredAt,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const mapTaskRecord = (record: PrismaTask): Task => ({
  id: record.id,
  tenantId: record.tenantId,
  contactId: record.contactId,
  createdById: record.createdById ?? undefined,
  assigneeId: record.assigneeId ?? undefined,
  type: record.type,
  status: record.status,
  priority: record.priority,
  title: record.title,
  description: record.description ?? undefined,
  dueAt: record.dueAt ?? undefined,
  completedAt: record.completedAt ?? undefined,
  metadata: asRecord(record.metadata) ?? {},
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
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
  status: record.status,
  isBlocked: record.isBlocked,
  tags: [...record.tags],
  customFields: (record.customFields as Record<string, unknown>) ?? {},
  lastInteractionAt: record.lastInteractionAt ?? undefined,
  notes: record.notes ?? undefined,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});
const mapContact = (record: PrismaContactWithRelations): Contact => {
  const phoneDetails = record.phones.map(mapContactPhoneRecord);
  const emailDetails = record.emails.map(mapContactEmailRecord);
  const tagAssignments = record.tags
    .map(mapContactTagRecord)
    .filter((value): value is ContactTag => value !== null);

  return {
    id: record.id,
    tenantId: record.tenantId,
    fullName: record.fullName,
    name: record.fullName,
    displayName: record.displayName ?? undefined,
    firstName: record.firstName ?? undefined,
    lastName: record.lastName ?? undefined,
    organization: record.organization ?? undefined,
    jobTitle: record.jobTitle ?? undefined,
    department: record.department ?? undefined,
    phone: record.primaryPhone ?? undefined,
    email: record.primaryEmail ?? undefined,
    primaryPhone: record.primaryPhone ?? undefined,
    primaryEmail: record.primaryEmail ?? undefined,
    document: record.document ?? undefined,
    avatar: record.avatar ?? undefined,
    status: record.status,
    lifecycleStage: record.lifecycleStage,
    source: record.source,
    ownerId: record.ownerId ?? undefined,
    isBlocked: record.isBlocked,
    isVip: record.isVip,
    timezone: record.timezone ?? undefined,
    locale: record.locale ?? undefined,
    birthDate: record.birthDate ?? undefined,
    lastInteractionAt: record.lastInteractionAt ?? undefined,
    lastActivityAt: record.lastActivityAt ?? undefined,
    notes: record.notes ?? undefined,
    customFields: asRecord(record.customFields) ?? {},
    metadata: asRecord(record.metadata) ?? {},
    tags: tagAssignments.map((assignment) => assignment.tag.name),
    tagAssignments,
    phones: phoneDetails.map((phone) => phone.phoneNumber),
    phoneDetails,
    emails: emailDetails.map((email) => email.email),
    emailDetails,
    interactions: record.interactions.map(mapInteractionRecord),
    tasks: record.tasks.map(mapTaskRecord),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  } satisfies Contact;
};

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

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const normalizePassthroughDirectionForWrite = (
  direction: PassthroughMessageDirection
): Message['direction'] => (direction === 'outbound' ? 'OUTBOUND' : 'INBOUND');

const mapDirectionFromRecord = (
  direction: PrismaMessage['direction']
): PassthroughMessageDirection => (direction === 'OUTBOUND' ? 'outbound' : 'inbound');

const mapPassthroughTypeToPrisma = (
  type: PassthroughMessageType,
  mediaType: string | null | undefined
): Message['type'] => {
  if (type === 'media') {
    const normalized = (mediaType ?? '').toLowerCase();
    if (normalized === 'image' || normalized === 'sticker') {
      return 'IMAGE';
    }
    if (normalized === 'video') {
      return 'VIDEO';
    }
    if (normalized === 'audio' || normalized === 'ptt') {
      return 'AUDIO';
    }
    if (normalized === 'document' || normalized === 'file' || normalized === 'pdf') {
      return 'DOCUMENT';
    }
  }

  return 'TEXT';
};

const mapPrismaTypeToPassthroughMedia = (
  type: PrismaMessageType
): string | null => {
  if (type === $Enums.MessageType.IMAGE || type === $Enums.MessageType.STICKER) {
    return 'image';
  }
  if (type === $Enums.MessageType.VIDEO) {
    return 'video';
  }
  if (type === $Enums.MessageType.AUDIO) {
    return 'audio';
  }
  if (type === $Enums.MessageType.DOCUMENT) {
    return 'document';
  }
  return null;
};

const coerceTimestamp = (value: UpsertPassthroughMessageInput['timestamp']): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value > 1_000_000_000_000 ? value : value * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      const millis = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
      const date = new Date(millis);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed);
    }
  }

  return null;
};

const normalizeMetadataRecord = (
  current: unknown
): Record<string, unknown> => {
  const record = asRecord(current);
  return record ? { ...record } : {};
};

export const mapPassthroughMessage = (
  record: PrismaMessage
): PassthroughMessage => {
  const metadataRecord = normalizeMetadataRecord(record.metadata);
  const passthroughMetadata = asRecord(metadataRecord.passthrough) ?? {};
  const metadataChatIdCandidate = ((): string | null => {
    const chatId = metadataRecord.chatId;
    if (typeof chatId === 'string' && chatId.trim().length > 0) {
      return chatId.trim();
    }
    const passthroughChatId = passthroughMetadata.chatId;
    if (typeof passthroughChatId === 'string' && passthroughChatId.trim().length > 0) {
      return passthroughChatId.trim();
    }
    const broker = asRecord(metadataRecord.broker);
    if (broker) {
      const remoteJid = broker.remoteJid;
      if (typeof remoteJid === 'string' && remoteJid.trim().length > 0) {
        return remoteJid.trim();
      }
    }
    return null;
  })();

  const resolvedMediaRecord = asRecord(passthroughMetadata.media);
  const derivedMediaType = (() => {
    const fromMetadata = typeof resolvedMediaRecord?.mediaType === 'string' ? resolvedMediaRecord.mediaType : null;
    if (fromMetadata) {
      return fromMetadata;
    }
    return mapPrismaTypeToPassthroughMedia(record.type);
  })();

  const resolvedMedia: PassthroughMessageMedia | null = (() => {
    const url =
      typeof resolvedMediaRecord?.url === 'string' && resolvedMediaRecord.url.trim().length > 0
        ? resolvedMediaRecord.url.trim()
        : record.mediaUrl ?? null;
    const mimeType =
      typeof resolvedMediaRecord?.mimeType === 'string' && resolvedMediaRecord.mimeType.trim().length > 0
        ? resolvedMediaRecord.mimeType.trim()
        : record.mediaType ?? null;
    const fileName =
      typeof resolvedMediaRecord?.fileName === 'string' && resolvedMediaRecord.fileName.trim().length > 0
        ? resolvedMediaRecord.fileName.trim()
        : record.mediaFileName ?? null;
    const size =
      typeof resolvedMediaRecord?.size === 'number' && Number.isFinite(resolvedMediaRecord.size)
        ? resolvedMediaRecord.size
        : record.mediaSize ?? null;
    const caption =
      typeof resolvedMediaRecord?.caption === 'string'
        ? resolvedMediaRecord.caption
        : record.caption ?? null;

    if (!url && !mimeType && !fileName && !size) {
      return null;
    }

    return {
      mediaType: derivedMediaType ?? 'file',
      url,
      mimeType,
      fileName,
      size,
      caption,
    } satisfies PassthroughMessageMedia;
  })();

  const metadataText =
    typeof passthroughMetadata.text === 'string' && passthroughMetadata.text.trim().length > 0
      ? passthroughMetadata.text
      : null;
  const captionText = record.caption && record.caption.trim().length > 0 ? record.caption : null;
  const contentText = record.content && record.content.trim().length > 0 ? record.content : null;

  const text = metadataText ?? captionText ?? contentText ?? null;

  const candidateType = passthroughMetadata.type;
  const type: PassthroughMessageType = (() => {
    if (candidateType === 'text' || candidateType === 'media' || candidateType === 'unknown') {
      return candidateType;
    }
    if (resolvedMedia) {
      return 'media';
    }
    if (text) {
      return 'text';
    }
    return 'unknown';
  })();

  const sourceInstanceCandidate = metadataRecord.sourceInstance;
  const normalizedMetadata: Record<string, unknown> = {
    ...metadataRecord,
    sourceInstance:
      typeof sourceInstanceCandidate === 'string'
        ? sourceInstanceCandidate
        : typeof record.instanceId === 'string'
          ? record.instanceId
          : null,
    remoteJid:
      typeof metadataRecord.remoteJid === 'string'
        ? metadataRecord.remoteJid
        : typeof metadataRecord.chatId === 'string'
          ? metadataRecord.chatId
          : metadataChatIdCandidate,
    phoneE164:
      typeof metadataRecord.phoneE164 === 'string' ? metadataRecord.phoneE164 : null,
  };

  return {
    id: record.id,
    tenantId: record.tenantId,
    ticketId: record.ticketId,
    chatId: metadataChatIdCandidate ?? record.ticketId,
    direction: mapDirectionFromRecord(record.direction),
    type,
    text,
    media: resolvedMedia,
    metadata: normalizedMetadata,
    createdAt: record.createdAt,
    externalId: record.externalId,
  } satisfies PassthroughMessage;
};

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
): Promise<{ ticket: Ticket; contact: Contact; wasCreated: boolean }> => {
  const prisma = getPrismaClient();
  const normalizedChatId = input.chatId.trim();
  const now = new Date();
  const displayName = input.displayName && input.displayName.trim().length > 0 ? input.displayName.trim() : normalizedChatId;
  const phone = input.phone && input.phone.trim().length > 0 ? input.phone.trim() : normalizedChatId;

  const contactRecord = await prisma.$transaction(async (tx) => {
    const contact = await tx.contact.upsert({
      where: {
        tenantId_primaryPhone: {
          tenantId: input.tenantId,
          primaryPhone: phone,
        },
      },
      update: {
        fullName: displayName,
        displayName,
        primaryPhone: phone,
        lastInteractionAt: now,
        lastActivityAt: now,
      },
      create: {
        tenantId: input.tenantId,
        fullName: displayName,
        displayName,
        primaryPhone: phone,
        status: 'ACTIVE',
        source: 'CHAT',
        lastInteractionAt: now,
        lastActivityAt: now,
        customFields: {
          passthroughChatId: normalizedChatId,
        },
        metadata: {
          passthrough: true,
          chatId: normalizedChatId,
        },
      },
    });

    if (phone) {
      await tx.contactPhone.upsert({
        where: {
          tenantId_phoneNumber: {
            tenantId: input.tenantId,
            phoneNumber: phone,
          },
        },
        update: {
          contactId: contact.id,
          isPrimary: true,
        },
        create: {
          tenantId: input.tenantId,
          contactId: contact.id,
          phoneNumber: phone,
          type: 'MOBILE',
          label: 'WhatsApp',
          isPrimary: true,
        },
      });
    }

    const tagNames = ['whatsapp', 'passthrough'];
    const tags = await Promise.all(
      tagNames.map((tagName) =>
        tx.tag.upsert({
          where: {
            tenantId_name: {
              tenantId: input.tenantId,
              name: tagName,
            },
          },
          update: {},
          create: {
            tenantId: input.tenantId,
            name: tagName,
          },
        })
      )
    );

    await Promise.all(
      tags.map((tag) =>
        tx.contactTag.upsert({
          where: {
            contactId_tagId: {
              contactId: contact.id,
              tagId: tag.id,
            },
          },
          update: {
            addedAt: now,
          },
          create: {
            tenantId: input.tenantId,
            contactId: contact.id,
            tagId: tag.id,
            addedAt: now,
          },
        })
      )
    );

    const contactWithRelations = await tx.contact.findUniqueOrThrow({
      where: { id: contact.id },
      include: CONTACT_INCLUDE,
    });

    return contactWithRelations as PrismaContactWithRelations;
  });

  let wasCreated = false;
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
    wasCreated = true;
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
    wasCreated,
  };
};

export const upsertMessageByExternalId = async (
  input: UpsertPassthroughMessageInput
): Promise<{ message: PassthroughMessage; wasCreated: boolean }> => {
  const prisma = getPrismaClient();
  const normalizedExternalId = input.externalId.trim();
  const metadataBase = normalizeMetadataRecord(input.metadata ?? null);
  const timestamp = coerceTimestamp(input.timestamp) ?? new Date();

  const passthroughMetadata = {
    chatId: input.chatId,
    type: input.type,
    text: input.text ?? null,
    media: input.media ?? null,
  };

  const metadataRecord: Record<string, unknown> = {
    ...metadataBase,
    chatId: input.chatId,
    passthrough: passthroughMetadata,
  };

  const direction = normalizePassthroughDirectionForWrite(input.direction);
  const storageType = mapPassthroughTypeToPrisma(input.type, input.media?.mediaType ?? null);

  const resolveContent = (): string => {
    const text = typeof input.text === 'string' ? input.text.trim() : '';
    if (text) {
      return text;
    }

    if (input.type === 'media') {
      return `[${input.media?.mediaType ?? 'media'}]`;
    }

    if (input.type === 'unknown') {
      return '[Mensagem não suportada]';
    }

    return '[Mensagem]';
  };

  const content = resolveContent();
  const caption = input.type === 'media' ? input.text ?? undefined : undefined;
  const mediaUrl =
    input.type === 'media' && typeof input.media?.url === 'string' && input.media.url.trim().length > 0
      ? input.media.url.trim()
      : undefined;

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
        direction,
        type: normalizeMessageTypeForWrite(storageType),
        content,
        caption: caption ?? null,
        mediaUrl: mediaUrl ?? null,
        mediaFileName: input.media?.fileName ?? null,
        mediaType: input.media?.mimeType ?? null,
        mediaSize: input.media?.size ?? null,
        metadata: mergeMessageMetadata(existing.metadata, metadataRecord),
        instanceId:
          typeof metadataBase.sourceInstance === 'string'
            ? metadataBase.sourceInstance
            : existing.instanceId ?? null,
        updatedAt: timestamp,
      },
    });

    return {
      message: mapPassthroughMessage(updated),
      wasCreated: false,
    };
  }

  const mediaEnabled = storageType !== 'TEXT' && Boolean(mediaUrl);
  const metadataWithTimestamps: Record<string, unknown> = {
    ...metadataRecord,
    normalizedTimestamp: timestamp.getTime(),
    receivedAt: timestamp.getTime(),
  };

    const instanceIdValue =
      typeof metadataBase.sourceInstance === 'string' ? metadataBase.sourceInstance : undefined;

    const created = await createMessage(input.tenantId, input.ticketId, {
      ticketId: input.ticketId,
      direction,
      type: mediaEnabled ? storageType : 'TEXT',
      content,
      caption,
      externalId: normalizedExternalId,
      mediaUrl: mediaEnabled ? mediaUrl : undefined,
      mediaFileName: mediaEnabled ? input.media?.fileName ?? undefined : undefined,
      mediaMimeType: mediaEnabled ? input.media?.mimeType ?? undefined : undefined,
      metadata: metadataWithTimestamps,
      ...(instanceIdValue !== undefined ? { instanceId: instanceIdValue } : {}),
    });

  if (!created) {
    const ticket = await prisma.ticket.findFirst({
      where: { id: input.ticketId, tenantId: input.tenantId },
      select: { contactId: true },
    });

    if (!ticket) {
      throw new Error('Unable to create message: ticket not found');
    }

    const fallback = await prisma.message.create({
      data: {
        tenantId: input.tenantId,
        ticketId: input.ticketId,
        contactId: ticket.contactId,
        userId: null,
        instanceId:
          typeof metadataBase.sourceInstance === 'string' ? metadataBase.sourceInstance : null,
        direction,
        type: normalizeMessageTypeForWrite(storageType),
        content,
        caption: caption ?? null,
        mediaUrl: mediaUrl ?? null,
        mediaFileName: input.media?.fileName ?? null,
        mediaType: input.media?.mimeType ?? null,
        mediaSize: input.media?.size ?? null,
        status: 'SENT',
        externalId: normalizedExternalId,
        metadata: metadataWithTimestamps as Prisma.InputJsonValue,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });

    return {
      message: mapPassthroughMessage(fallback),
      wasCreated: true,
    };
  }

  const persisted = await prisma.message.findFirst({
    where: { id: created.id },
  });

  if (!persisted) {
    throw new Error('Unable to load message after creation');
  }

  return {
    message: mapPassthroughMessage(persisted),
    wasCreated: true,
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
  const { instanceId, idempotencyKey, userId, status, ...rest } = input;

  return createMessage(tenantId, ticketId, {
    ...rest,
    direction: 'OUTBOUND',
    ...(userId !== undefined ? { userId } : {}),
    status: status ?? 'PENDING',
    ...(instanceId !== undefined ? { instanceId } : {}),
    ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
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
    ...(ack.status !== undefined ? { status: ack.status } : {}),
    ...(ack.externalId !== undefined ? { externalId: ack.externalId ?? null } : {}),
    ...(ack.metadata !== undefined ? { metadata: ack.metadata ?? null } : {}),
    ...(ack.deliveredAt !== undefined ? { deliveredAt: ack.deliveredAt ?? null } : {}),
    ...(ack.readAt !== undefined ? { readAt: ack.readAt ?? null } : {}),
    ...(ack.instanceId !== undefined ? { instanceId: ack.instanceId ?? null } : {}),
  });
};
