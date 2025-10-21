import { randomUUID } from 'node:crypto';
import type {
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
} from '../types/tickets';

export const STORAGE_VERSION = 'test';

let prismaClient: unknown = null;

export const setPrismaClient = (client: unknown) => {
  prismaClient = client;
};

export const getPrismaClient = <T = unknown>(): T => {
  if (!prismaClient) {
    const error = new Error('Prisma client is not configured for storage mock');
    (error as Error & { code?: string }).code = 'STORAGE_PRISMA_NOT_CONFIGURED';
    throw error;
  }

  return prismaClient as T;
};

export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ENDED = 'ended',
}

export interface Campaign {
  id: string;
  tenantId: string;
  agreementId: string;
  instanceId: string;
  name: string;
  status: CampaignStatus;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCampaignInput {
  tenantId: string;
  agreementId: string;
  instanceId: string;
  name: string;
  status?: CampaignStatus;
  startDate?: Date | null;
  endDate?: Date | null;
}

export interface CampaignFilters {
  tenantId: string;
  agreementId?: string;
  status?: CampaignStatus[];
}

const campaignsByTenant = new Map<string, Map<string, Campaign>>();

const getCampaignBucket = (tenantId: string): Map<string, Campaign> => {
  let bucket = campaignsByTenant.get(tenantId);
  if (!bucket) {
    bucket = new Map<string, Campaign>();
    campaignsByTenant.set(tenantId, bucket);
  }
  return bucket;
};

const findByCompositeKey = (tenantId: string, agreementId: string, instanceId: string): Campaign | undefined => {
  const bucket = campaignsByTenant.get(tenantId);
  if (!bucket) {
    return undefined;
  }

  for (const campaign of bucket.values()) {
    if (campaign.agreementId === agreementId && campaign.instanceId === instanceId) {
      return campaign;
    }
  }
  return undefined;
};

export const createOrActivateCampaign = async (input: CreateCampaignInput): Promise<Campaign> => {
  const status = input.status ?? CampaignStatus.DRAFT;
  const bucket = getCampaignBucket(input.tenantId);
  const existing = findByCompositeKey(input.tenantId, input.agreementId, input.instanceId);
  const now = new Date();

  if (existing) {
    existing.name = input.name;
    existing.status = status;
    existing.startDate = input.startDate ?? existing.startDate ?? now;
    existing.endDate = input.endDate ?? (status === CampaignStatus.ACTIVE ? null : existing.endDate);
    existing.updatedAt = now;
    return existing;
  }

  const campaign: Campaign = {
    id: randomUUID(),
    tenantId: input.tenantId,
    agreementId: input.agreementId,
    instanceId: input.instanceId,
    name: input.name,
    status,
    startDate: input.startDate ?? now,
    endDate: input.endDate ?? null,
    createdAt: now,
    updatedAt: now,
  };

  bucket.set(campaign.id, campaign);
  return campaign;
};

export const updateCampaignStatus = async (
  tenantId: string,
  campaignId: string,
  status: CampaignStatus
): Promise<Campaign | null> => {
  const bucket = campaignsByTenant.get(tenantId);
  if (!bucket) {
    return null;
  }

  const campaign = bucket.get(campaignId);
  if (!campaign) {
    return null;
  }

  const now = new Date();
  campaign.status = status;
  campaign.updatedAt = now;
  if (status === CampaignStatus.ACTIVE) {
    campaign.endDate = null;
  } else if (status === CampaignStatus.ENDED) {
    campaign.endDate = now;
  }
  return campaign;
};

export const findCampaignById = async (tenantId: string, campaignId: string): Promise<Campaign | null> => {
  const bucket = campaignsByTenant.get(tenantId);
  if (!bucket) {
    return null;
  }
  const campaign = bucket.get(campaignId);
  return campaign ?? null;
};

export const findActiveCampaign = async (
  tenantId: string,
  agreementId: string,
  instanceId?: string
): Promise<Campaign | null> => {
  const bucket = campaignsByTenant.get(tenantId);
  if (!bucket) {
    return null;
  }

  const campaigns = Array.from(bucket.values()).filter((campaign) => {
    if (campaign.agreementId !== agreementId) {
      return false;
    }
    if (instanceId && campaign.instanceId !== instanceId) {
      return false;
    }
    return campaign.status === CampaignStatus.ACTIVE;
  });

  if (campaigns.length === 0) {
    return null;
  }

  campaigns.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return campaigns[0];
};

export const listCampaigns = async (filters: CampaignFilters): Promise<Campaign[]> => {
  const bucket = campaignsByTenant.get(filters.tenantId);
  if (!bucket) {
    return [];
  }

  let campaigns = Array.from(bucket.values());

  if (filters.agreementId) {
    campaigns = campaigns.filter((campaign) => campaign.agreementId === filters.agreementId);
  }

  if (filters.status?.length) {
    const allowed = new Set(filters.status);
    campaigns = campaigns.filter((campaign) => allowed.has(campaign.status));
  }

  const statusOrder: Record<CampaignStatus, number> = {
    [CampaignStatus.DRAFT]: 0,
    [CampaignStatus.ACTIVE]: 1,
    [CampaignStatus.PAUSED]: 2,
    [CampaignStatus.ENDED]: 3,
  };

  campaigns.sort((a, b) => {
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return campaigns;
};

export const resetCampaignStore = async () => {
  campaignsByTenant.clear();
};

export type LeadAllocationStatus = 'allocated' | 'contacted' | 'won' | 'lost';

export interface BrokerLeadInput {
  id: string;
  fullName: string;
  document: string;
  registrations: string[];
  agreementId: string;
  phone?: string;
  margin?: number;
  netMargin?: number;
  score?: number;
  tags?: string[];
  raw?: Record<string, unknown> | null;
}

export interface AllocationFilters {
  tenantId: string;
  agreementId?: string;
  campaignId?: string;
  statuses?: LeadAllocationStatus[];
}

export interface AllocationSummary {
  total: number;
  contacted: number;
  won: number;
  lost: number;
}

export interface CampaignMetrics {
  total: number;
  allocated: number;
  contacted: number;
  won: number;
  lost: number;
  averageResponseSeconds: number | null;
}

export interface LeadAllocationDto {
  allocationId: string;
  leadId: string;
  tenantId: string;
  campaignId: string;
  campaignName: string;
  agreementId: string;
  instanceId: string;
  status: LeadAllocationStatus;
  receivedAt: string;
  updatedAt: string;
  notes?: string;
  fullName: string;
  document: string;
  matricula?: string;
  registrations: string[];
  phone?: string;
  margin?: number;
  netMargin?: number;
  score?: number;
  tags: string[];
  payload?: Record<string, unknown> | null;
}

interface LeadRecord {
  id: string;
  tenantId: string;
  agreementId: string;
  fullName: string;
  document: string;
  matricula?: string | null;
  phone?: string;
  registrations: string[];
  tags: string[];
  margin?: number;
  netMargin?: number;
  score?: number;
  raw?: Record<string, unknown> | null;
  updatedAt: Date;
}

interface AllocationRecord {
  id: string;
  tenantId: string;
  campaignId: string;
  leadId: string;
  status: LeadAllocationStatus;
  notes?: string | null;
  payload?: Record<string, unknown> | null;
  receivedAt: Date;
  updatedAt: Date;
}

const leadsByTenant = new Map<string, Map<string, LeadRecord>>();
const leadDocumentIndex = new Map<string, Map<string, string>>();
const allocationsByTenant = new Map<string, Map<string, AllocationRecord>>();
const allocationKeyIndex = new Map<string, string>();
const recentAllocationKeys = new Map<string, number>();

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

const getLeadBucket = (tenantId: string) => {
  let leads = leadsByTenant.get(tenantId);
  if (!leads) {
    leads = new Map<string, LeadRecord>();
    leadsByTenant.set(tenantId, leads);
  }

  let docIndex = leadDocumentIndex.get(tenantId);
  if (!docIndex) {
    docIndex = new Map<string, string>();
    leadDocumentIndex.set(tenantId, docIndex);
  }

  return { leads, docIndex };
};

const getAllocationBucket = (tenantId: string) => {
  let allocations = allocationsByTenant.get(tenantId);
  if (!allocations) {
    allocations = new Map<string, AllocationRecord>();
    allocationsByTenant.set(tenantId, allocations);
  }
  return allocations;
};

const sanitizeDocument = (value: string): string => value.replace(/\D/g, '');

const normalizePhone = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 ? digits : undefined;
};

const uniqueStrings = (items: string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  items.forEach((item) => {
    const trimmed = item.trim();
    if (!trimmed) {
      return;
    }
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      normalized.push(trimmed);
    }
  });
  return normalized;
};

const allocationKey = (tenantId: string, leadId: string, campaignId: string) =>
  `${tenantId}:${leadId}:${campaignId}`;

const toAllocationDto = async (allocation: AllocationRecord): Promise<LeadAllocationDto> => {
  const leads = leadsByTenant.get(allocation.tenantId) ?? new Map<string, LeadRecord>();
  const lead = leads.get(allocation.leadId);
  const campaign = await findCampaignById(allocation.tenantId, allocation.campaignId);

  return {
    allocationId: allocation.id,
    leadId: allocation.leadId,
    tenantId: allocation.tenantId,
    campaignId: allocation.campaignId,
    campaignName: campaign?.name ?? allocation.campaignId,
    agreementId: campaign?.agreementId ?? lead?.agreementId ?? 'unknown',
    instanceId: campaign?.instanceId ?? 'default',
    status: allocation.status,
    receivedAt: allocation.receivedAt.toISOString(),
    updatedAt: allocation.updatedAt.toISOString(),
    notes: allocation.notes ?? undefined,
    fullName: lead?.fullName ?? lead?.id ?? allocation.leadId,
    document: lead?.document ?? '',
    matricula: lead?.matricula ?? undefined,
    registrations: lead?.registrations ?? [],
    phone: lead?.phone ?? undefined,
    margin: lead?.margin ?? undefined,
    netMargin: lead?.netMargin ?? undefined,
    score: lead?.score ?? undefined,
    tags: lead?.tags ?? [],
    payload: allocation.payload ?? null,
  };
};

const getSummary = (tenantId: string, campaignId?: string): AllocationSummary => {
  const allocations = allocationsByTenant.get(tenantId);
  const summary: AllocationSummary = {
    total: 0,
    contacted: 0,
    won: 0,
    lost: 0,
  };

  if (!allocations) {
    return summary;
  }

  allocations.forEach((allocation) => {
    if (campaignId && allocation.campaignId !== campaignId) {
      return;
    }
    summary.total += 1;
    if (allocation.status === 'contacted') {
      summary.contacted += 1;
    } else if (allocation.status === 'won') {
      summary.won += 1;
    } else if (allocation.status === 'lost') {
      summary.lost += 1;
    }
  });

  return summary;
};

export const listAllocations = async (filters: AllocationFilters): Promise<LeadAllocationDto[]> => {
  const allocations = allocationsByTenant.get(filters.tenantId);
  if (!allocations) {
    return [];
  }

  let items = Array.from(allocations.values());

  if (filters.campaignId) {
    items = items.filter((allocation) => allocation.campaignId === filters.campaignId);
  }

  if (filters.agreementId) {
    items = await Promise.all(
      items.map(async (allocation) => ({
        allocation,
        campaign: await findCampaignById(allocation.tenantId, allocation.campaignId),
      }))
    ).then((results) =>
      results
        .filter(({ campaign }) => campaign?.agreementId === filters.agreementId)
        .map(({ allocation }) => allocation)
    );
  }

  if (filters.statuses?.length) {
    const allowed = new Set(filters.statuses);
    items = items.filter((allocation) => allowed.has(allocation.status));
  }

  items.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());

  const dtos = await Promise.all(items.map((allocation) => toAllocationDto(allocation)));
  return dtos;
};

export const allocateBrokerLeads = async (params: {
  tenantId: string;
  campaignId: string;
  leads: BrokerLeadInput[];
}): Promise<{ newlyAllocated: LeadAllocationDto[]; summary: AllocationSummary }> => {
  const { leads, docIndex } = getLeadBucket(params.tenantId);
  const allocations = getAllocationBucket(params.tenantId);

  const created: AllocationRecord[] = [];
  const now = new Date();

  for (const leadInput of params.leads) {
    const normalizedPhone = normalizePhone(leadInput.phone);
    const document = sanitizeDocument(leadInput.document || normalizedPhone || '');

    if (!document) {
      continue;
    }

    const dedupeKey = `${params.tenantId}:${params.campaignId}:${document}`;
    const nowTimestamp = now.getTime();
    const lastSeen = recentAllocationKeys.get(dedupeKey);
    if (lastSeen && nowTimestamp - lastSeen < DEDUPE_WINDOW_MS) {
      continue;
    }

    const leadId = docIndex.get(document);
    const normalizedRegistrations = uniqueStrings(leadInput.registrations ?? []);
    const normalizedTags = uniqueStrings(leadInput.tags ?? []);

    let lead: LeadRecord | undefined;

    if (leadId) {
      lead = leads.get(leadId);
      if (lead) {
        lead.fullName = leadInput.fullName || lead.fullName;
        lead.agreementId = leadInput.agreementId;
        lead.matricula = normalizedRegistrations[0] ?? null;
        lead.phone = normalizedPhone;
        lead.registrations = normalizedRegistrations;
        lead.tags = normalizedTags;
        lead.margin = leadInput.margin ?? lead.margin;
        lead.netMargin = leadInput.netMargin ?? lead.netMargin;
        lead.score = leadInput.score ?? lead.score;
        lead.raw = leadInput.raw ?? lead.raw ?? null;
        lead.updatedAt = now;
      }
    }

    if (!lead) {
      const id = randomUUID();
      lead = {
        id,
        tenantId: params.tenantId,
        agreementId: leadInput.agreementId,
        fullName: leadInput.fullName,
        document,
        matricula: normalizedRegistrations[0] ?? null,
        phone: normalizedPhone,
        registrations: normalizedRegistrations,
        tags: normalizedTags,
        margin: leadInput.margin,
        netMargin: leadInput.netMargin,
        score: leadInput.score,
        raw: leadInput.raw ?? null,
        updatedAt: now,
      };
      leads.set(id, lead);
      docIndex.set(document, id);
    }

    const key = allocationKey(params.tenantId, lead.id, params.campaignId);
    if (allocationKeyIndex.has(key)) {
      continue;
    }

    const allocation: AllocationRecord = {
      id: randomUUID(),
      tenantId: params.tenantId,
      campaignId: params.campaignId,
      leadId: lead.id,
      status: 'allocated',
      notes: null,
      payload: leadInput.raw ?? null,
      receivedAt: now,
      updatedAt: now,
    };

    allocations.set(allocation.id, allocation);
    allocationKeyIndex.set(key, allocation.id);
    recentAllocationKeys.set(dedupeKey, nowTimestamp);
    created.push(allocation);
  }

  const newlyAllocated = await Promise.all(created.map((allocation) => toAllocationDto(allocation)));
  const summary = getSummary(params.tenantId, params.campaignId);

  if (recentAllocationKeys.size > 2000) {
    const threshold = now.getTime() - DEDUPE_WINDOW_MS;
    for (const [key, timestamp] of recentAllocationKeys.entries()) {
      if (timestamp < threshold) {
        recentAllocationKeys.delete(key);
      }
    }
  }

  return { newlyAllocated, summary };
};

export const updateAllocation = async (params: {
  tenantId: string;
  allocationId: string;
  updates: Partial<{ status: LeadAllocationStatus; notes: string | null }>;
}): Promise<LeadAllocationDto | null> => {
  const allocations = allocationsByTenant.get(params.tenantId);
  if (!allocations) {
    return null;
  }

  const allocation = allocations.get(params.allocationId);
  if (!allocation) {
    return null;
  }

  if (params.updates.status) {
    allocation.status = params.updates.status;
  }

  if (params.updates.notes !== undefined) {
    allocation.notes = params.updates.notes;
  }

  allocation.updatedAt = new Date();

  return toAllocationDto(allocation);
};

export const resetAllocationStore = async () => {
  leadsByTenant.clear();
  leadDocumentIndex.clear();
  allocationsByTenant.clear();
  allocationKeyIndex.clear();
  recentAllocationKeys.clear();
};

export const getCampaignMetrics = async (
  tenantId: string,
  campaignId: string
): Promise<CampaignMetrics> => {
  const allocations = allocationsByTenant.get(tenantId);
  const result: CampaignMetrics = {
    total: 0,
    allocated: 0,
    contacted: 0,
    won: 0,
    lost: 0,
    averageResponseSeconds: null,
  };

  if (!allocations) {
    return result;
  }

  let totalResponseMs = 0;
  let responseCount = 0;

  allocations.forEach((allocation) => {
    if (allocation.campaignId !== campaignId) {
      return;
    }

    result.total += 1;
    if (allocation.status === 'allocated') {
      result.allocated += 1;
    }
    if (allocation.status === 'contacted') {
      result.contacted += 1;
    }
    if (allocation.status === 'won') {
      result.won += 1;
    }
    if (allocation.status === 'lost') {
      result.lost += 1;
    }

    if (allocation.status !== 'allocated') {
      const diff = allocation.updatedAt.getTime() - allocation.receivedAt.getTime();
      if (diff >= 0) {
        totalResponseMs += diff;
        responseCount += 1;
      }
    }
  });

  if (responseCount > 0) {
    result.averageResponseSeconds = Math.round(totalResponseMs / responseCount / 1000);
  }

  return result;
};

interface TicketRecord extends Ticket {
  lastMessagePreview?: string;
}

interface MessageRecord extends Message {}

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
    const hasTag = ticket.tags.some((tag: string) => filters.tags!.includes(tag));
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
  const field = allowedFields.has(sortBy ?? '') ? (sortBy as keyof TicketRecord) : 'lastMessageAt';
  const fallbackFields: Array<keyof TicketRecord> =
    field === 'lastMessageAt' ? ['updatedAt', 'createdAt'] : [];
  const fieldsToCompare: Array<keyof TicketRecord> = [field, ...fallbackFields];

  return tickets.sort((a, b) => {
    for (const currentField of fieldsToCompare) {
      const valueA = a[currentField];
      const valueB = b[currentField];

      if (valueA === valueB) {
        continue;
      }
  const sortFields: Array<keyof TicketRecord> = (() => {
    if (!sortBy || !allowedFields.has(sortBy)) {
      return ['lastMessageAt', 'updatedAt', 'createdAt'];
    }

    if (sortBy === 'lastMessageAt') {
      return ['lastMessageAt', 'updatedAt', 'createdAt'];
    }

    return [sortBy as keyof TicketRecord];
  })();

  const compareValues = (valueA: unknown, valueB: unknown) => {
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
        if (valueA.getTime() === valueB.getTime()) {
          continue;
        }
        return valueA.getTime() > valueB.getTime() ? direction : -direction;
      }

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        const comparison = valueA.localeCompare(valueB);
        if (comparison === 0) {
          continue;
        }
        return comparison * direction;
      }

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        if (valueA === valueB) {
          continue;
        }
        return valueA > valueB ? direction : -direction;
      }
    }

    return 0;
  };

  return tickets.sort((a, b) => {
    for (const field of sortFields) {
      const result = compareValues(a[field], b[field]);
      if (result !== 0) {
        return result;
      }
    }

    return 0;
  });
};

const sortMessages = (messages: MessageRecord[], sortOrder: 'asc' | 'desc') => {
  const direction = sortOrder === 'asc' ? 1 : -1;
  return messages.sort((a, b) => (a.createdAt > b.createdAt ? direction : -direction));
};

export const resetTicketStore = async () => {
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
    instanceId?: string | null;
    idempotencyKey?: string | null;
  }
): Promise<Message | null> => {
  const ticketsBucket = getTicketBucket(tenantId);
  const ticket = ticketsBucket.get(ticketId);

  if (!ticket) {
    return null;
  }

  const bucket = getMessageBucket(tenantId);
  const now = new Date();
  const metadataRecord = (input.metadata ?? {}) as Record<string, unknown>;
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

  const normalizedTs = resolveTimestamp(metadataRecord['normalizedTimestamp']);
  const brokerTs = resolveTimestamp(metadataRecord['brokerMessageTimestamp']);
  const receivedTs = resolveTimestamp(metadataRecord['receivedAt']);
  const createdAtCandidate = normalizedTs ?? brokerTs ?? receivedTs;
  const createdAt = createdAtCandidate ? new Date(createdAtCandidate) : now;
  const createdAtTime = createdAt.getTime();
  const metadataCopy = { ...metadataRecord } as Record<string, unknown>;

  const record: MessageRecord = {
    id: randomUUID(),
    tenantId,
    ticketId,
    contactId: ticket.contactId,
    userId: input.userId,
    instanceId: input.instanceId ?? undefined,
    direction: input.direction,
    type: input.type ?? 'TEXT',
    content: (input.content ?? '').trim(),
    caption: input.caption ?? undefined,
    mediaUrl: input.mediaUrl,
    mediaFileName: input.mediaFileName ?? undefined,
    mediaType: input.mediaMimeType ?? undefined,
    mediaSize: undefined,
    status: input.status ?? 'SENT',
    externalId: input.externalId ?? undefined,
    externalId: undefined,
    quotedMessageId: input.quotedMessageId,
    metadata: metadataCopy,
    idempotencyKey: input.idempotencyKey ?? undefined,
    deliveredAt: undefined,
    readAt: undefined,
    createdAt,
    updatedAt: createdAt,
  };

  bucket.set(record.id, record);

  const ticketMetadata =
    typeof ticket.metadata === 'object' && ticket.metadata !== null
      ? ({ ...(ticket.metadata as Record<string, unknown>) } as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  const timelineSource =
    typeof ticketMetadata['timeline'] === 'object' && ticketMetadata['timeline'] !== null
      ? ({ ...(ticketMetadata['timeline'] as Record<string, unknown>) } as Record<string, unknown>)
      : ({} as Record<string, unknown>);

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

  if (record.direction === 'INBOUND') {
    ensureMin('firstInboundAt');
    ensureMax('lastInboundAt');
  } else {
    ensureMin('firstOutboundAt');
    ensureMax('lastOutboundAt');
  }

  if (Object.keys(timelineSource).length > 0) {
    ticketMetadata['timeline'] = timelineSource;
  }

  ticket.metadata = ticketMetadata as Ticket['metadata'];

  if (!ticket.lastMessageAt || createdAt > ticket.lastMessageAt) {
    ticket.lastMessageAt = createdAt;
    const previewSource = record.content && record.content.length > 0 ? record.content : record.caption ?? '';
    ticket.lastMessagePreview = previewSource.slice(0, 280);
  }

  if (!ticket.updatedAt || createdAt > ticket.updatedAt) {
    ticket.updatedAt = createdAt;
  }

  ticketsBucket.set(ticketId, ticket);

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
  const bucket = getMessageBucket(tenantId);
  const record = bucket.get(messageId);

  if (!record) {
    return null;
  }

  if (typeof updates.status === 'string') {
    record.status = updates.status;
  }

  if (updates.externalId !== undefined) {
    record.externalId = updates.externalId ?? undefined;
  }

  if (updates.metadata !== undefined) {
    const currentMetadata = typeof record.metadata === 'object' && record.metadata !== null ? record.metadata : {};
    const nextMetadata = updates.metadata ?? {};
    record.metadata = {
      ...currentMetadata,
      ...nextMetadata,
    } as Record<string, unknown>;
  }

  if (updates.deliveredAt !== undefined) {
    record.deliveredAt = updates.deliveredAt ?? undefined;
  }

  if (updates.readAt !== undefined) {
    record.readAt = updates.readAt ?? undefined;
  }

  if (updates.instanceId !== undefined) {
    record.instanceId = updates.instanceId ?? undefined;
  }

  record.updatedAt = new Date();

  bucket.set(record.id, record);

  return toMessage(record);
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
