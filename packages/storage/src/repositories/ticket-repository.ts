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
  type SalesSimulation as PrismaSalesSimulation,
  type SalesProposal as PrismaSalesProposal,
  type SalesDeal as PrismaSalesDeal,
} from '@prisma/client';
import type {
  Contact,
  ContactEmail,
  ContactPhone,
  ContactTag,
  CreateTicketDTO,
  CreateSalesDealDTO,
  CreateSalesProposalDTO,
  CreateSalesSimulationDTO,
  Interaction,
  Message,
  MessageType,
  MessageFilters,
  Pagination,
  PaginatedResult,
  SalesDeal,
  SalesProposal,
  SalesSimulation,
  SendMessageDTO,
  SortOrder,
  Tag,
  Task,
  Ticket,
  TicketFilters,
  TicketStage,
  TicketStatus,
  UpdateSalesDealDTO,
  UpdateSalesProposalDTO,
  UpdateSalesSimulationDTO,
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
  base64?: string | null;
  mediaKey?: string | null;
  directPath?: string | null;
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
  stage: record.stage as TicketStage,
  subject: record.subject ?? undefined,
  channel: record.channel,
  lastMessageAt: record.lastMessageAt ?? undefined,
  lastMessagePreview: record.lastMessagePreview ?? undefined,
  tags: [...record.tags],
  metadata: sanitizeEnrichmentKeys(normalizeMetadataRecord(record.metadata)),
  closedAt: record.closedAt ?? undefined,
  closedBy: record.closedBy ?? undefined,
  closeReason: record.closeReason ?? undefined,
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
  metadata: sanitizeEnrichmentKeys(normalizeMetadataRecord(record.metadata)),
  idempotencyKey: record.idempotencyKey ?? undefined,
  deliveredAt: record.deliveredAt ?? undefined,
  readAt: record.readAt ?? undefined,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const mapJsonSnapshot = (value: Prisma.JsonValue): Record<string, unknown> =>
  asRecord(value) ?? {};

type PrismaSalesSimulationRecord = PrismaSalesSimulation & {
  proposals?: PrismaSalesProposalRecord[];
  deals?: PrismaSalesDealRecord[];
};

type PrismaSalesProposalRecord = PrismaSalesProposal & {
  simulation?: PrismaSalesSimulation | null;
  deals?: PrismaSalesDealRecord[];
};

type PrismaSalesDealRecord = PrismaSalesDeal & {
  simulation?: PrismaSalesSimulation | null;
  proposal?: PrismaSalesProposal | null;
};

const mapSalesSimulationRecord = (
  record: PrismaSalesSimulationRecord | PrismaSalesSimulation,
  options: { includeChildren?: boolean } = {}
): SalesSimulation => {
  const base: SalesSimulation = {
    id: record.id,
    tenantId: record.tenantId,
    ticketId: record.ticketId,
    leadId: record.leadId ?? undefined,
    calculationSnapshot: mapJsonSnapshot(record.calculationSnapshot),
    metadata: sanitizeEnrichmentKeys(normalizeMetadataRecord(record.metadata)),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };

  if (options.includeChildren) {
    if ('proposals' in record && Array.isArray(record.proposals)) {
      base.proposals = record.proposals.map((proposal) =>
        mapSalesProposalRecord(proposal, { includeDeals: false, includeSimulation: false })
      );
    }

    if ('deals' in record && Array.isArray(record.deals)) {
      base.deals = record.deals.map((deal) =>
        mapSalesDealRecord(deal, { includeProposal: false, includeSimulation: false })
      );
    }
  }

  return base;
};

const mapSalesProposalRecord = (
  record: PrismaSalesProposalRecord | PrismaSalesProposal,
  options: { includeSimulation?: boolean; includeDeals?: boolean } = {}
): SalesProposal => {
  const base: SalesProposal = {
    id: record.id,
    tenantId: record.tenantId,
    ticketId: record.ticketId,
    leadId: record.leadId ?? undefined,
    simulationId: record.simulationId ?? undefined,
    calculationSnapshot: mapJsonSnapshot(record.calculationSnapshot),
    metadata: sanitizeEnrichmentKeys(normalizeMetadataRecord(record.metadata)),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };

  if (options.includeSimulation && 'simulation' in record && record.simulation) {
    base.simulation = mapSalesSimulationRecord(record.simulation, { includeChildren: false });
  }

  if (options.includeDeals && 'deals' in record && Array.isArray(record.deals)) {
    base.deals = record.deals.map((deal) =>
      mapSalesDealRecord(deal, {
        includeProposal: false,
        includeSimulation: options.includeSimulation ?? false,
      })
    );
  }

  return base;
};

const mapSalesDealRecord = (
  record: PrismaSalesDealRecord | PrismaSalesDeal,
  options: { includeSimulation?: boolean; includeProposal?: boolean } = {}
): SalesDeal => {
  const base: SalesDeal = {
    id: record.id,
    tenantId: record.tenantId,
    ticketId: record.ticketId,
    leadId: record.leadId ?? undefined,
    simulationId: record.simulationId ?? undefined,
    proposalId: record.proposalId ?? undefined,
    calculationSnapshot: mapJsonSnapshot(record.calculationSnapshot),
    metadata: sanitizeEnrichmentKeys(normalizeMetadataRecord(record.metadata)),
    closedAt: record.closedAt ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };

  if (options.includeSimulation && 'simulation' in record && record.simulation) {
    base.simulation = mapSalesSimulationRecord(record.simulation, { includeChildren: false });
  }

  if (options.includeProposal && 'proposal' in record && record.proposal) {
    base.proposal = mapSalesProposalRecord(record.proposal, {
      includeDeals: false,
      includeSimulation: options.includeSimulation ?? false,
    });
  }

  return base;
};

const buildSalesSimulationInclude = (
  options: { includeChildren?: boolean } | undefined
): Prisma.SalesSimulationInclude | undefined => {
  if (!options?.includeChildren) {
    return undefined;
  }

  return {
    proposals: true,
    deals: true,
  } satisfies Prisma.SalesSimulationInclude;
};

const buildSalesProposalInclude = (
  options:
    | {
        includeSimulation?: boolean;
        includeDeals?: boolean;
      }
    | undefined
): Prisma.SalesProposalInclude | undefined => {
  const include: Prisma.SalesProposalInclude = {};

  if (options?.includeSimulation) {
    include.simulation = true;
  }

  if (options?.includeDeals) {
    include.deals = true;
  }

  return Object.keys(include).length > 0 ? include : undefined;
};

const buildSalesDealInclude = (
  options:
    | {
        includeSimulation?: boolean;
        includeProposal?: boolean;
      }
    | undefined
): Prisma.SalesDealInclude | undefined => {
  const include: Prisma.SalesDealInclude = {};

  if (options?.includeSimulation) {
    include.simulation = true;
  }

  if (options?.includeProposal) {
    include.proposal = true;
  }

  return Object.keys(include).length > 0 ? include : undefined;
};

const normalizeSnapshotForWrite = (
  snapshot: Record<string, unknown>
): Prisma.InputJsonValue => snapshot as Prisma.InputJsonValue;

const normalizeMetadataForWrite = (
  metadata: Record<string, unknown> | undefined
): Prisma.InputJsonValue =>
  sanitizeEnrichmentKeys(normalizeMetadataRecord(metadata ?? null)) as Prisma.InputJsonValue;

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
    if (normalized) {
      return 'DOCUMENT';
    }
  }

  if (type === 'media') {
    return 'DOCUMENT';
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

const ENRICHMENT_METADATA_KEYS = [
  'sourceInstance',
  'campaignId',
  'campaignName',
  'productType',
  'strategy',
] as const;

type EnrichmentMetadataKey = (typeof ENRICHMENT_METADATA_KEYS)[number];

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

const sanitizeEnrichmentKeys = (
  metadata: Record<string, unknown>
): Record<string, unknown> => {
  const result = { ...metadata } as Record<string, unknown>;
  for (const key of ENRICHMENT_METADATA_KEYS) {
    if (!(key in result)) {
      continue;
    }
    const normalized = normalizeEnrichmentValue(result[key]);
    if (normalized === undefined) {
      delete result[key];
    } else {
      result[key] = normalized;
    }
  }
  return result;
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
    const fromMetadata =
      typeof resolvedMediaRecord?.mediaType === 'string' && resolvedMediaRecord.mediaType.trim().length > 0
        ? resolvedMediaRecord.mediaType.trim()
        : null;
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
    const base64 =
      typeof resolvedMediaRecord?.base64 === 'string' && resolvedMediaRecord.base64.trim().length > 0
        ? resolvedMediaRecord.base64.trim()
        : null;
    const mediaKey =
      typeof resolvedMediaRecord?.mediaKey === 'string' && resolvedMediaRecord.mediaKey.trim().length > 0
        ? resolvedMediaRecord.mediaKey.trim()
        : null;
    const directPath =
      typeof resolvedMediaRecord?.directPath === 'string' && resolvedMediaRecord.directPath.trim().length > 0
        ? resolvedMediaRecord.directPath.trim()
        : null;
    const caption =
      typeof resolvedMediaRecord?.caption === 'string'
        ? resolvedMediaRecord.caption
        : record.caption ?? null;

    const mediaType =
      derivedMediaType ??
      (typeof resolvedMediaRecord?.mediaType === 'string' && resolvedMediaRecord.mediaType.trim().length > 0
        ? resolvedMediaRecord.mediaType.trim()
        : null);

    if (!url && !mimeType && !fileName && !size && !base64 && !mediaKey && !directPath && !mediaType) {
      return null;
    }

    return {
      mediaType: mediaType ?? 'file',
      url,
      mimeType,
      fileName,
      size,
      caption,
      base64,
      mediaKey,
      directPath,
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

  const pushAndCondition = (condition: Prisma.TicketWhereInput) => {
    if (!condition) {
      return;
    }
    const existingAnd = Array.isArray(where.AND)
      ? where.AND
      : where.AND
        ? [where.AND]
        : [];
    where.AND = [...existingAnd, condition];
  };

  const applyMetadataFilter = (
    key: EnrichmentMetadataKey,
    values: string[] | undefined
  ) => {
    const normalized = values
      ?.map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => value.length > 0);

    if (!normalized || normalized.length === 0) {
      return;
    }

    pushAndCondition({
      OR: normalized.map((value) => ({
        metadata: {
          path: [key],
          equals: value,
        },
      })),
    });
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

  if (filters.stage?.length) {
    where.stage = { in: filters.stage };
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
    pushAndCondition({ OR: searchOr });
  }

  applyMetadataFilter('sourceInstance', filters.sourceInstance);
  applyMetadataFilter('campaignId', filters.campaignId);
  applyMetadataFilter('campaignName', filters.campaignName);
  applyMetadataFilter('productType', filters.productType);
  applyMetadataFilter('strategy', filters.strategy);

  return where;
};

const buildTicketOrderBy = (
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'desc'
): Prisma.TicketOrderByWithRelationInput[] => {
  const allowedFields = new Set(['createdAt', 'updatedAt', 'lastMessageAt', 'priority']);
  const defaultOrder: Prisma.TicketOrderByWithRelationInput[] = [
    { lastMessageAt: sortOrder },
    { updatedAt: sortOrder },
    { createdAt: sortOrder },
  ];

  const field = allowedFields.has(sortBy ?? '') ? (sortBy as keyof PrismaTicket) : null;

  if (!field || field === 'lastMessageAt') {
    return defaultOrder;
  }

  const fallbackOrder = defaultOrder.filter((order) => !(field in order));

  return [
    {
      [field]: sortOrder,
    } as Prisma.TicketOrderByWithRelationInput,
    ...fallbackOrder,
  ];
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

  const merged = {
    ...base,
    ...updates,
  } as Record<string, unknown>;

  return sanitizeEnrichmentKeys(merged) as Prisma.InputJsonValue;
};

export const resetTicketStore = async (): Promise<void> => {
  const prisma = getPrismaClient();
  await prisma.$transaction([
    prisma.salesDeal.deleteMany({}),
    prisma.salesProposal.deleteMany({}),
    prisma.salesSimulation.deleteMany({}),
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
  const metadataRecord = normalizeMetadataForWrite(input.metadata);
  const record = await prisma.ticket.create({
    data: {
      tenantId: input.tenantId,
      contactId: input.contactId,
      queueId: input.queueId,
      status: 'OPEN',
      priority: input.priority ?? 'NORMAL',
      stage: (input.stage ?? 'novo') as TicketStage,
      subject: input.subject ?? null,
      channel: input.channel,
      tags: input.tags ?? [],
      metadata: metadataRecord as Prisma.InputJsonValue,
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

  if (typeof input.stage === 'string') {
    data.stage = input.stage as TicketStage;
  }

  if (Array.isArray(input.tags)) {
    data.tags = { set: input.tags };
  }

  if (input.metadata !== undefined) {
    data.metadata = normalizeMetadataForWrite(input.metadata);
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

type SalesSimulationQuery = {
  ticketId?: string;
  leadId?: string | null;
};

type SalesProposalQuery = {
  ticketId?: string;
  leadId?: string | null;
  simulationId?: string | null;
};

type SalesDealQuery = {
  ticketId?: string;
  leadId?: string | null;
  simulationId?: string | null;
  proposalId?: string | null;
};

export const createSalesSimulation = async (
  input: CreateSalesSimulationDTO
): Promise<SalesSimulation> => {
  const prisma = getPrismaClient();
  const record = await prisma.salesSimulation.create({
    data: {
      tenantId: input.tenantId,
      ticketId: input.ticketId,
      leadId: input.leadId ?? null,
      calculationSnapshot: normalizeSnapshotForWrite(input.calculationSnapshot),
      metadata: normalizeMetadataForWrite(input.metadata),
    },
  });

  return mapSalesSimulationRecord(record);
};

export const findSalesSimulationById = async (
  tenantId: string,
  simulationId: string,
  options?: { includeChildren?: boolean }
): Promise<SalesSimulation | null> => {
  const prisma = getPrismaClient();
  const record = await prisma.salesSimulation.findFirst({
    where: { id: simulationId, tenantId },
    include: buildSalesSimulationInclude(options),
  });

  return record ? mapSalesSimulationRecord(record, options) : null;
};

export const listSalesSimulations = async (
  tenantId: string,
  filters: SalesSimulationQuery,
  options?: { includeChildren?: boolean }
): Promise<SalesSimulation[]> => {
  const prisma = getPrismaClient();
  const where: Prisma.SalesSimulationWhereInput = { tenantId };

  if (filters.ticketId) {
    where.ticketId = filters.ticketId;
  }

  if (filters.leadId !== undefined) {
    where.leadId = filters.leadId;
  }

  const records = await prisma.salesSimulation.findMany({
    where,
    include: buildSalesSimulationInclude(options),
    orderBy: { createdAt: 'desc' },
  });

  return records.map((record) => mapSalesSimulationRecord(record, options));
};

export const updateSalesSimulation = async (
  tenantId: string,
  simulationId: string,
  input: UpdateSalesSimulationDTO
): Promise<SalesSimulation | null> => {
  const prisma = getPrismaClient();
  const existing = await prisma.salesSimulation.findFirst({
    where: { id: simulationId, tenantId },
  });

  if (!existing) {
    return null;
  }

  const data: Prisma.SalesSimulationUncheckedUpdateInput = {};

  if ('leadId' in input) {
    data.leadId = input.leadId ?? null;
  }

  if (input.calculationSnapshot !== undefined) {
    data.calculationSnapshot = normalizeSnapshotForWrite(input.calculationSnapshot);
  }

  if (input.metadata !== undefined) {
    data.metadata = normalizeMetadataForWrite(input.metadata);
  }

  const updated = await prisma.salesSimulation.update({
    where: { id: existing.id },
    data,
  });

  return mapSalesSimulationRecord(updated);
};

export const deleteSalesSimulation = async (
  tenantId: string,
  simulationId: string
): Promise<boolean> => {
  const prisma = getPrismaClient();
  const result = await prisma.salesSimulation.deleteMany({
    where: { id: simulationId, tenantId },
  });

  return result.count > 0;
};

export const createSalesProposal = async (
  input: CreateSalesProposalDTO
): Promise<SalesProposal> => {
  const prisma = getPrismaClient();
  const record = await prisma.salesProposal.create({
    data: {
      tenantId: input.tenantId,
      ticketId: input.ticketId,
      leadId: input.leadId ?? null,
      simulationId: input.simulationId ?? null,
      calculationSnapshot: normalizeSnapshotForWrite(input.calculationSnapshot),
      metadata: normalizeMetadataForWrite(input.metadata),
    },
  });

  return mapSalesProposalRecord(record);
};

export const findSalesProposalById = async (
  tenantId: string,
  proposalId: string,
  options?: { includeSimulation?: boolean; includeDeals?: boolean }
): Promise<SalesProposal | null> => {
  const prisma = getPrismaClient();
  const record = await prisma.salesProposal.findFirst({
    where: { id: proposalId, tenantId },
    include: buildSalesProposalInclude(options),
  });

  return record ? mapSalesProposalRecord(record, options) : null;
};

export const listSalesProposals = async (
  tenantId: string,
  filters: SalesProposalQuery,
  options?: { includeSimulation?: boolean; includeDeals?: boolean }
): Promise<SalesProposal[]> => {
  const prisma = getPrismaClient();
  const where: Prisma.SalesProposalWhereInput = { tenantId };

  if (filters.ticketId) {
    where.ticketId = filters.ticketId;
  }

  if (filters.leadId !== undefined) {
    where.leadId = filters.leadId;
  }

  if (filters.simulationId !== undefined) {
    where.simulationId = filters.simulationId;
  }

  const records = await prisma.salesProposal.findMany({
    where,
    include: buildSalesProposalInclude(options),
    orderBy: { createdAt: 'desc' },
  });

  return records.map((record) => mapSalesProposalRecord(record, options));
};

export const updateSalesProposal = async (
  tenantId: string,
  proposalId: string,
  input: UpdateSalesProposalDTO
): Promise<SalesProposal | null> => {
  const prisma = getPrismaClient();
  const existing = await prisma.salesProposal.findFirst({
    where: { id: proposalId, tenantId },
  });

  if (!existing) {
    return null;
  }

  const data: Prisma.SalesProposalUncheckedUpdateInput = {};

  if ('leadId' in input) {
    data.leadId = input.leadId ?? null;
  }

  if ('simulationId' in input) {
    data.simulationId = input.simulationId ?? null;
  }

  if (input.calculationSnapshot !== undefined) {
    data.calculationSnapshot = normalizeSnapshotForWrite(input.calculationSnapshot);
  }

  if (input.metadata !== undefined) {
    data.metadata = normalizeMetadataForWrite(input.metadata);
  }

  const updated = await prisma.salesProposal.update({
    where: { id: existing.id },
    data,
  });

  return mapSalesProposalRecord(updated);
};

export const deleteSalesProposal = async (
  tenantId: string,
  proposalId: string
): Promise<boolean> => {
  const prisma = getPrismaClient();
  const result = await prisma.salesProposal.deleteMany({
    where: { id: proposalId, tenantId },
  });

  return result.count > 0;
};

export const createSalesDeal = async (
  input: CreateSalesDealDTO
): Promise<SalesDeal> => {
  const prisma = getPrismaClient();
  const record = await prisma.salesDeal.create({
    data: {
      tenantId: input.tenantId,
      ticketId: input.ticketId,
      leadId: input.leadId ?? null,
      simulationId: input.simulationId ?? null,
      proposalId: input.proposalId ?? null,
      calculationSnapshot: normalizeSnapshotForWrite(input.calculationSnapshot),
      metadata: normalizeMetadataForWrite(input.metadata),
      closedAt: input.closedAt ?? null,
    },
  });

  return mapSalesDealRecord(record);
};

export const findSalesDealById = async (
  tenantId: string,
  dealId: string,
  options?: { includeSimulation?: boolean; includeProposal?: boolean }
): Promise<SalesDeal | null> => {
  const prisma = getPrismaClient();
  const record = await prisma.salesDeal.findFirst({
    where: { id: dealId, tenantId },
    include: buildSalesDealInclude(options),
  });

  return record ? mapSalesDealRecord(record, options) : null;
};

export const listSalesDeals = async (
  tenantId: string,
  filters: SalesDealQuery,
  options?: { includeSimulation?: boolean; includeProposal?: boolean }
): Promise<SalesDeal[]> => {
  const prisma = getPrismaClient();
  const where: Prisma.SalesDealWhereInput = { tenantId };

  if (filters.ticketId) {
    where.ticketId = filters.ticketId;
  }

  if (filters.leadId !== undefined) {
    where.leadId = filters.leadId;
  }

  if (filters.simulationId !== undefined) {
    where.simulationId = filters.simulationId;
  }

  if (filters.proposalId !== undefined) {
    where.proposalId = filters.proposalId;
  }

  const records = await prisma.salesDeal.findMany({
    where,
    include: buildSalesDealInclude(options),
    orderBy: { createdAt: 'desc' },
  });

  return records.map((record) => mapSalesDealRecord(record, options));
};

export const updateSalesDeal = async (
  tenantId: string,
  dealId: string,
  input: UpdateSalesDealDTO
): Promise<SalesDeal | null> => {
  const prisma = getPrismaClient();
  const existing = await prisma.salesDeal.findFirst({
    where: { id: dealId, tenantId },
  });

  if (!existing) {
    return null;
  }

  const data: Prisma.SalesDealUncheckedUpdateInput = {};

  if ('leadId' in input) {
    data.leadId = input.leadId ?? null;
  }

  if ('simulationId' in input) {
    data.simulationId = input.simulationId ?? null;
  }

  if ('proposalId' in input) {
    data.proposalId = input.proposalId ?? null;
  }

  if (input.calculationSnapshot !== undefined) {
    data.calculationSnapshot = normalizeSnapshotForWrite(input.calculationSnapshot);
  }

  if (input.metadata !== undefined) {
    data.metadata = normalizeMetadataForWrite(input.metadata);
  }

  if (input.closedAt !== undefined) {
    data.closedAt = input.closedAt ?? null;
  }

  const updated = await prisma.salesDeal.update({
    where: { id: existing.id },
    data,
  });

  return mapSalesDealRecord(updated);
};

export const deleteSalesDeal = async (
  tenantId: string,
  dealId: string
): Promise<boolean> => {
  const prisma = getPrismaClient();
  const result = await prisma.salesDeal.deleteMany({
    where: { id: dealId, tenantId },
  });

  return result.count > 0;
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

  const ticketMetadataRecord = normalizeMetadataRecord(ticket.metadata);
  const metadataRecord = sanitizeEnrichmentKeys(normalizeMetadataRecord(input.metadata ?? null));
  mergeEnrichmentMetadata(metadataRecord, ticketMetadataRecord);
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

    const currentMetadata = { ...ticketMetadataRecord } as Record<string, unknown>;

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

    mergeEnrichmentMetadata(currentMetadata, metadataRecord);

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
    type?: Message['type'];
    externalId?: string | null;
    content?: string | null;
    text?: string | null;
    caption?: string | null;
    metadata?: Record<string, unknown> | null;
    deliveredAt?: Date | null;
    readAt?: Date | null;
    instanceId?: string | null;
    mediaUrl?: string | null;
    mediaFileName?: string | null;
    mediaType?: string | null;
    mediaSize?: number | null;
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

  if (updates.type !== undefined) {
    data.type = normalizeMessageTypeForWrite(updates.type);
  }

  const nextContentCandidate =
    updates.content !== undefined ? updates.content : updates.text !== undefined ? updates.text : undefined;

  if (nextContentCandidate !== undefined && typeof nextContentCandidate === 'string') {
    data.content = nextContentCandidate;
  }

  if (updates.caption !== undefined) {
    data.caption = updates.caption ?? null;
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

  if (updates.mediaUrl !== undefined) {
    data.mediaUrl = updates.mediaUrl ?? null;
  }

  if (updates.mediaFileName !== undefined) {
    data.mediaFileName = updates.mediaFileName ?? null;
  }

  if (updates.mediaType !== undefined) {
    data.mediaType = updates.mediaType ?? null;
  }

  if (updates.mediaSize !== undefined) {
    data.mediaSize = updates.mediaSize ?? null;
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

type PollVoteMessageLookupInput = {
  tenantId: string;
  chatId?: string | null;
  identifiers?: string[];
  pollId?: string | null;
};

const normalizeIdentifierSet = (identifiers: string[] | undefined): string[] => {
  if (!Array.isArray(identifiers)) {
    return [];
  }

  const unique = new Set<string>();
  identifiers.forEach((candidate) => {
    if (typeof candidate !== 'string') {
      return;
    }
    const trimmed = candidate.trim();
    if (trimmed.length === 0) {
      return;
    }
    unique.add(trimmed);
  });

  return Array.from(unique.values());
};

const buildJsonEqualsFilter = (path: string[], value: string): Prisma.MessageWhereInput => ({
  metadata: {
    path,
    equals: value,
  },
});

export const findPollVoteMessageCandidate = async ({
  tenantId,
  chatId,
  identifiers,
  pollId,
}: PollVoteMessageLookupInput): Promise<Message | null> => {
  const prisma = getPrismaClient();
  const normalizedIdentifiers = normalizeIdentifierSet(identifiers);
  const normalizedPollId = typeof pollId === 'string' && pollId.trim().length > 0 ? pollId.trim() : null;
  const normalizedChatId = typeof chatId === 'string' && chatId.trim().length > 0 ? chatId.trim() : null;

  const andClauses: Prisma.MessageWhereInput[] = [];

  if (normalizedChatId) {
    const chatFilters: Prisma.MessageWhereInput[] = [
      buildJsonEqualsFilter(['remoteJid'], normalizedChatId),
      buildJsonEqualsFilter(['chatId'], normalizedChatId),
      buildJsonEqualsFilter(['broker', 'remoteJid'], normalizedChatId),
      buildJsonEqualsFilter(['passthrough', 'chatId'], normalizedChatId),
      buildJsonEqualsFilter(['contact', 'remoteJid'], normalizedChatId),
      buildJsonEqualsFilter(['contact', 'jid'], normalizedChatId),
    ];
    andClauses.push({ OR: chatFilters });
  }

  if (normalizedIdentifiers.length > 0) {
    const identifierFilters: Prisma.MessageWhereInput[] = [];

    normalizedIdentifiers.forEach((id) => {
      identifierFilters.push({ externalId: id });
      identifierFilters.push(buildJsonEqualsFilter(['externalId'], id));
      identifierFilters.push(buildJsonEqualsFilter(['broker', 'messageId'], id));
      identifierFilters.push(buildJsonEqualsFilter(['broker', 'id'], id));
      identifierFilters.push(buildJsonEqualsFilter(['broker', 'wamid'], id));
      identifierFilters.push(buildJsonEqualsFilter(['rawKey', 'id'], id));
      identifierFilters.push(buildJsonEqualsFilter(['poll', 'creationMessageId'], id));
      identifierFilters.push(buildJsonEqualsFilter(['poll', 'pollId'], id));
      identifierFilters.push(buildJsonEqualsFilter(['poll', 'id'], id));
      identifierFilters.push(buildJsonEqualsFilter(['pollVote', 'messageId'], id));
      identifierFilters.push(buildJsonEqualsFilter(['pollChoice', 'pollId'], id));
      identifierFilters.push(buildJsonEqualsFilter(['pollChoice', 'vote', 'messageId'], id));
      identifierFilters.push(buildJsonEqualsFilter(['interactive', 'poll', 'id'], id));
      identifierFilters.push(buildJsonEqualsFilter(['interactive', 'id'], id));
    });

    andClauses.push({ OR: identifierFilters });
  }

  if (normalizedPollId) {
    andClauses.push({
      OR: [
        buildJsonEqualsFilter(['poll', 'pollId'], normalizedPollId),
        buildJsonEqualsFilter(['poll', 'id'], normalizedPollId),
        buildJsonEqualsFilter(['pollVote', 'pollId'], normalizedPollId),
        buildJsonEqualsFilter(['pollChoice', 'pollId'], normalizedPollId),
        buildJsonEqualsFilter(['pollChoice', 'vote', 'pollId'], normalizedPollId),
      ],
    });
  }

  const where: Prisma.MessageWhereInput = { tenantId };
  if (andClauses.length > 0) {
    where.AND = andClauses;
  }

  const record = await prisma.message.findFirst({
    where,
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  });

  return record ? mapMessage(record) : null;
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
      await tx.contactPhone.updateMany({
        where: { tenantId: input.tenantId, contactId: contact.id, isPrimary: true },
        data: { isPrimary: false },
      });

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
  const metadataBase = sanitizeEnrichmentKeys(normalizeMetadataRecord(input.metadata ?? null));
  const timestamp = coerceTimestamp(input.timestamp) ?? new Date();

  const normalizedMedia: PassthroughMessageMedia | null = (() => {
    const source = input.media;
    if (!source) {
      return null;
    }

    const mediaType =
      typeof source.mediaType === 'string' && source.mediaType.trim().length > 0
        ? source.mediaType.trim()
        : 'file';
    const url =
      typeof source.url === 'string' && source.url.trim().length > 0 ? source.url.trim() : null;
    const mimeType =
      typeof source.mimeType === 'string' && source.mimeType.trim().length > 0
        ? source.mimeType.trim()
        : null;
    const fileName =
      typeof source.fileName === 'string' && source.fileName.trim().length > 0
        ? source.fileName.trim()
        : null;
    const size =
      typeof source.size === 'number' && Number.isFinite(source.size) ? source.size : null;
    const caption = typeof source.caption === 'string' ? source.caption : null;
    const base64 =
      typeof source.base64 === 'string' && source.base64.trim().length > 0
        ? source.base64.trim()
        : null;
    const mediaKey =
      typeof source.mediaKey === 'string' && source.mediaKey.trim().length > 0
        ? source.mediaKey.trim()
        : null;
    const directPath =
      typeof source.directPath === 'string' && source.directPath.trim().length > 0
        ? source.directPath.trim()
        : null;

    return {
      mediaType,
      url,
      mimeType,
      fileName,
      size,
      caption,
      base64,
      mediaKey,
      directPath,
    } satisfies PassthroughMessageMedia;
  })();

  const passthroughMetadata = {
    chatId: input.chatId,
    type: input.type,
    text: input.text ?? null,
    media: normalizedMedia,
  };

  const metadataRecord: Record<string, unknown> = {
    ...metadataBase,
    chatId: input.chatId,
    passthrough: passthroughMetadata,
  };
  mergeEnrichmentMetadata(metadataRecord, metadataBase);

  const direction = normalizePassthroughDirectionForWrite(input.direction);
  const storageType = mapPassthroughTypeToPrisma(input.type, normalizedMedia?.mediaType ?? null);

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
  const mediaUrl = normalizedMedia?.url ?? undefined;
  const hasMediaUrl = typeof mediaUrl === 'string' && mediaUrl.length > 0;
  const hasMediaBase64 = typeof normalizedMedia?.base64 === 'string' && normalizedMedia.base64.length > 0;
  const hasMediaKey = typeof normalizedMedia?.mediaKey === 'string' && normalizedMedia.mediaKey.length > 0;
  const hasMediaDirectPath =
    typeof normalizedMedia?.directPath === 'string' && normalizedMedia.directPath.length > 0;
  const hasDeclaredMediaType = typeof normalizedMedia?.mediaType === 'string' && normalizedMedia.mediaType.length > 0;
  const shouldPersistAsMedia =
    input.type === 'media' && (hasMediaUrl || hasMediaBase64 || hasMediaKey || hasMediaDirectPath || hasDeclaredMediaType);

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
        mediaUrl: hasMediaUrl ? mediaUrl : null,
        mediaFileName: normalizedMedia?.fileName ?? null,
        mediaType: normalizedMedia?.mimeType ?? null,
        mediaSize: normalizedMedia?.size ?? null,
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

  const metadataWithTimestamps: Record<string, unknown> = {
    ...metadataRecord,
    normalizedTimestamp: timestamp.getTime(),
    receivedAt: timestamp.getTime(),
  };
  mergeEnrichmentMetadata(metadataWithTimestamps, metadataRecord);

    const instanceIdValue =
      typeof metadataBase.sourceInstance === 'string' ? metadataBase.sourceInstance : undefined;

    const created = await createMessage(input.tenantId, input.ticketId, {
      ticketId: input.ticketId,
      direction,
      type: shouldPersistAsMedia ? storageType : 'TEXT',
      content,
      caption,
      externalId: normalizedExternalId,
      mediaUrl: hasMediaUrl ? mediaUrl : undefined,
      mediaFileName: shouldPersistAsMedia ? normalizedMedia?.fileName ?? undefined : undefined,
      mediaMimeType: shouldPersistAsMedia ? normalizedMedia?.mimeType ?? undefined : undefined,
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
        mediaUrl: hasMediaUrl ? mediaUrl : null,
        mediaFileName: normalizedMedia?.fileName ?? null,
        mediaType: normalizedMedia?.mimeType ?? null,
        mediaSize: normalizedMedia?.size ?? null,
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
