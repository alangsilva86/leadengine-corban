import { randomUUID } from 'node:crypto';
import { DomainError } from '@ticketz/core';
import type {
  CreateTicketDTO,
  Message,
  MessageFilters,
  Pagination,
  PaginatedResult,
  SendMessageDTO,
  Ticket,
  TicketFilters,
  TicketStage,
  TicketStatus,
  SalesSimulation,
  SalesProposal,
  SalesDeal,
  CreateSalesSimulationDTO,
  UpdateSalesSimulationDTO,
  CreateSalesProposalDTO,
  UpdateSalesProposalDTO,
  CreateSalesDealDTO,
  UpdateSalesDealDTO,
  UpdateTicketDTO,
} from '../types/tickets';

export class TenantAccessError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'FORBIDDEN', details);
    this.name = 'TenantAccessError';
  }
}

export const normalizeTenantId = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const ensureTenantFromUser = (
  user: { id?: string | null; tenantId?: string | null } | null | undefined,
  details?: Record<string, unknown>
): string => {
  const tenantId = normalizeTenantId(user?.tenantId);

  if (!tenantId) {
    throw new TenantAccessError('Tenant obrigatório para esta operação.', {
      ...(details ?? {}),
      userId: user?.id ?? null,
    });
  }

  return tenantId;
};

export const assertTenantConsistency = (
  tenantId: string,
  requestedTenantId: unknown,
  details?: Record<string, unknown>
): void => {
  const normalizedRequested = normalizeTenantId(requestedTenantId);

  if (normalizedRequested && normalizedRequested !== tenantId) {
    throw new TenantAccessError('Tentativa de acesso a dados de outro tenant.', {
      ...(details ?? {}),
      tenantId,
      requestedTenantId: normalizedRequested,
    });
  }
};

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
  agreementName: string | null;
  instanceId: string;
  name: string;
  status: CampaignStatus;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  productType: string | null;
  marginType: string | null;
  strategy: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface CreateCampaignInput {
  tenantId: string;
  agreementId: string;
  agreementName?: string | null;
  instanceId: string;
  name: string;
  status?: CampaignStatus;
  startDate?: Date | null;
  endDate?: Date | null;
  productType?: string | null;
  marginType?: string | null;
  marginValue?: number | null;
  strategy?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CampaignFilters {
  tenantId: string;
  agreementId?: string;
  status?: CampaignStatus[];
  instanceId?: string;
  productType?: string | null;
  marginType?: string | null;
  strategy?: string | null;
  tags?: string[];
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

const normalizeValue = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildTagSet = (
  tags: string[] | undefined,
  productType: string | null | undefined,
  marginType: string | null | undefined,
  strategy: string | null | undefined
): string[] => {
  const set = new Set<string>();
  for (const tag of tags ?? []) {
    const normalized = normalizeValue(tag);
    if (normalized) {
      set.add(normalized);
    }
  }

  for (const candidate of [productType, marginType, strategy]) {
    const normalized = normalizeValue(candidate);
    if (normalized) {
      set.add(normalized);
    }
  }

  return Array.from(set);
};

const findByCompositeKey = (
  tenantId: string,
  agreementId: string,
  instanceId: string,
  productType: string | null | undefined,
  marginType: string | null | undefined,
  strategy: string | null | undefined
): Campaign | undefined => {
  const bucket = campaignsByTenant.get(tenantId);
  if (!bucket) {
    return undefined;
  }

  for (const campaign of bucket.values()) {
    if (
      campaign.agreementId === agreementId &&
      campaign.instanceId === instanceId &&
      (productType === undefined || campaign.productType === normalizeValue(productType)) &&
      (marginType === undefined || campaign.marginType === normalizeValue(marginType)) &&
      (strategy === undefined || campaign.strategy === normalizeValue(strategy))
    ) {
      return campaign;
    }
  }
  return undefined;
};

const mergeMetadata = (
  current: unknown,
  overrides: Record<string, unknown> | undefined,
  marginValue: number | null | undefined
): Record<string, unknown> => {
  const base: Record<string, unknown> =
    current && typeof current === 'object' && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {};

  if (overrides) {
    Object.assign(base, overrides);
  }

  if (marginValue !== undefined) {
    if (marginValue === null) {
      delete base.margin;
    } else {
      base.margin = marginValue;
    }
  }

  return base;
};

export const createOrActivateCampaign = async (input: CreateCampaignInput): Promise<Campaign> => {
  const status = input.status ?? CampaignStatus.DRAFT;
  const bucket = getCampaignBucket(input.tenantId);
  const existing = findByCompositeKey(
    input.tenantId,
    input.agreementId,
    input.instanceId,
    input.productType ?? null,
    input.marginType ?? null,
    input.strategy ?? null
  );
  const now = new Date();
  const tagList = buildTagSet(input.tags, input.productType ?? null, input.marginType ?? null, input.strategy ?? null);

  if (existing) {
    existing.name = input.name;
    existing.status = status;
    existing.startDate = input.startDate ?? existing.startDate ?? now;
    existing.endDate = input.endDate ?? (status === CampaignStatus.ACTIVE ? null : existing.endDate);
    existing.updatedAt = now;
    existing.agreementName = input.agreementName ?? existing.agreementName ?? null;
    existing.productType = normalizeValue(input.productType);
   existing.marginType = normalizeValue(input.marginType);
   existing.strategy = normalizeValue(input.strategy);
   if (tagList.length > 0) {
     existing.tags = tagList;
   }
    existing.metadata = mergeMetadata(existing.metadata, input.metadata, input.marginValue);
    return existing;
  }

  const metadata = mergeMetadata(undefined, input.metadata, input.marginValue);

  const campaign: Campaign = {
    id: randomUUID(),
    tenantId: input.tenantId,
    agreementId: input.agreementId,
    agreementName: input.agreementName ?? null,
    instanceId: input.instanceId,
    name: input.name,
    status,
    startDate: input.startDate ?? now,
    endDate: input.endDate ?? null,
    createdAt: now,
    updatedAt: now,
    productType: normalizeValue(input.productType),
    marginType: normalizeValue(input.marginType),
    strategy: normalizeValue(input.strategy),
    tags: tagList,
    metadata,
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

export interface ActiveCampaignFilters {
  instanceId?: string;
  productType?: string | null;
  marginType?: string | null;
  strategy?: string | null;
  tags?: string[];
}

export const findActiveCampaign = async (
  tenantId: string,
  agreementId: string,
  filters: ActiveCampaignFilters = {}
): Promise<Campaign | null> => {
  const bucket = campaignsByTenant.get(tenantId);
  if (!bucket) {
    return null;
  }

  const matchesFilters = (campaign: Campaign): boolean => {
    if (filters.instanceId && campaign.instanceId !== filters.instanceId) {
      return false;
    }
    if (filters.productType !== undefined && campaign.productType !== filters.productType) {
      return false;
    }
    if (filters.marginType !== undefined && campaign.marginType !== filters.marginType) {
      return false;
    }
    if (filters.strategy !== undefined && campaign.strategy !== filters.strategy) {
      return false;
    }
    if (filters.tags?.length) {
      const set = new Set(campaign.tags);
      return filters.tags.every((tag) => set.has(tag));
    }
    return true;
  };

  const campaigns = Array.from(bucket.values())
    .filter((campaign) => campaign.agreementId === agreementId && campaign.status === CampaignStatus.ACTIVE)
    .filter(matchesFilters)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return campaigns[0] ?? null;
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

  if (filters.instanceId) {
    campaigns = campaigns.filter((campaign) => campaign.instanceId === filters.instanceId);
  }

  if (filters.status?.length) {
    const allowed = new Set(filters.status);
    campaigns = campaigns.filter((campaign) => allowed.has(campaign.status));
  }

  if (filters.productType !== undefined) {
    campaigns = campaigns.filter((campaign) => campaign.productType === filters.productType);
  }

  if (filters.marginType !== undefined) {
    campaigns = campaigns.filter((campaign) => campaign.marginType === filters.marginType);
  }

  if (filters.strategy !== undefined) {
    campaigns = campaigns.filter((campaign) => campaign.strategy === filters.strategy);
  }

  if (filters.tags?.length) {
    campaigns = campaigns.filter((campaign) => {
      const set = new Set(campaign.tags);
      return filters.tags?.every((tag) => set.has(tag));
    });
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

interface SalesSimulationRecord {
  id: string;
  tenantId: string;
  ticketId: string;
  leadId?: string;
  calculationSnapshot: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface SalesProposalRecord {
  id: string;
  tenantId: string;
  ticketId: string;
  leadId?: string;
  simulationId?: string;
  calculationSnapshot: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface SalesDealRecord {
  id: string;
  tenantId: string;
  ticketId: string;
  leadId?: string;
  simulationId?: string;
  proposalId?: string;
  calculationSnapshot: Record<string, unknown>;
  metadata: Record<string, unknown>;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ticketsByTenant = new Map<string, Map<string, TicketRecord>>();
const messagesByTenant = new Map<string, Map<string, MessageRecord>>();
const salesSimulationsByTenant = new Map<string, Map<string, SalesSimulationRecord>>();
const salesProposalsByTenant = new Map<string, Map<string, SalesProposalRecord>>();
const salesDealsByTenant = new Map<string, Map<string, SalesDealRecord>>();

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

const getSalesSimulationBucket = (tenantId: string) => {
  let bucket = salesSimulationsByTenant.get(tenantId);
  if (!bucket) {
    bucket = new Map<string, SalesSimulationRecord>();
    salesSimulationsByTenant.set(tenantId, bucket);
  }
  return bucket;
};

const getSalesProposalBucket = (tenantId: string) => {
  let bucket = salesProposalsByTenant.get(tenantId);
  if (!bucket) {
    bucket = new Map<string, SalesProposalRecord>();
    salesProposalsByTenant.set(tenantId, bucket);
  }
  return bucket;
};

const getSalesDealBucket = (tenantId: string) => {
  let bucket = salesDealsByTenant.get(tenantId);
  if (!bucket) {
    bucket = new Map<string, SalesDealRecord>();
    salesDealsByTenant.set(tenantId, bucket);
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

const toSalesSimulation = (
  record: SalesSimulationRecord,
  options: { includeChildren?: boolean } = {}
): SalesSimulation => {
  const base: SalesSimulation = {
    id: record.id,
    tenantId: record.tenantId,
    ticketId: record.ticketId,
    leadId: record.leadId ?? undefined,
    calculationSnapshot: { ...record.calculationSnapshot },
    metadata: { ...record.metadata },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };

  if (options.includeChildren) {
    const proposalBucket = getSalesProposalBucket(record.tenantId);
    const dealBucket = getSalesDealBucket(record.tenantId);

    base.proposals = Array.from(proposalBucket.values())
      .filter((proposal) => proposal.simulationId === record.id)
      .map((proposal) => toSalesProposal(proposal, { includeDeals: false, includeSimulation: false }));

    base.deals = Array.from(dealBucket.values())
      .filter((deal) => deal.simulationId === record.id)
      .map((deal) => toSalesDeal(deal, { includeProposal: false, includeSimulation: false }));
  }

  return base;
};

const toSalesProposal = (
  record: SalesProposalRecord,
  options: { includeSimulation?: boolean; includeDeals?: boolean } = {}
): SalesProposal => {
  const base: SalesProposal = {
    id: record.id,
    tenantId: record.tenantId,
    ticketId: record.ticketId,
    leadId: record.leadId ?? undefined,
    simulationId: record.simulationId ?? undefined,
    calculationSnapshot: { ...record.calculationSnapshot },
    metadata: { ...record.metadata },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };

  if (options.includeSimulation && record.simulationId) {
    const simulation = getSalesSimulationBucket(record.tenantId).get(record.simulationId);
    if (simulation) {
      base.simulation = toSalesSimulation(simulation, { includeChildren: false });
    }
  }

  if (options.includeDeals) {
    const deals = Array.from(getSalesDealBucket(record.tenantId).values())
      .filter((deal) => deal.proposalId === record.id)
      .map((deal) =>
        toSalesDeal(deal, { includeProposal: false, includeSimulation: options.includeSimulation ?? false })
      );
    base.deals = deals;
  }

  return base;
};

const toSalesDeal = (
  record: SalesDealRecord,
  options: { includeSimulation?: boolean; includeProposal?: boolean } = {}
): SalesDeal => {
  const base: SalesDeal = {
    id: record.id,
    tenantId: record.tenantId,
    ticketId: record.ticketId,
    leadId: record.leadId ?? undefined,
    simulationId: record.simulationId ?? undefined,
    proposalId: record.proposalId ?? undefined,
    calculationSnapshot: { ...record.calculationSnapshot },
    metadata: { ...record.metadata },
    closedAt: record.closedAt ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };

  if (options.includeSimulation && record.simulationId) {
    const simulation = getSalesSimulationBucket(record.tenantId).get(record.simulationId);
    if (simulation) {
      base.simulation = toSalesSimulation(simulation, { includeChildren: false });
    }
  }

  if (options.includeProposal && record.proposalId) {
    const proposal = getSalesProposalBucket(record.tenantId).get(record.proposalId);
    if (proposal) {
      base.proposal = toSalesProposal(proposal, {
        includeDeals: false,
        includeSimulation: options.includeSimulation ?? false,
      });
    }
  }

  return base;
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

  if (filters.stage && filters.stage.length > 0 && !filters.stage.includes(ticket.stage)) {
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
  const allowedFields = new Set<keyof TicketRecord>(['createdAt', 'updatedAt', 'lastMessageAt', 'priority']);

  const sortFields: Array<keyof TicketRecord> = (() => {
    if (!sortBy || !allowedFields.has(sortBy as keyof TicketRecord)) {
      return ['lastMessageAt', 'updatedAt', 'createdAt'];
    }

    if (sortBy === 'lastMessageAt') {
      return ['lastMessageAt', 'updatedAt', 'createdAt'];
    }

    return [sortBy as keyof TicketRecord];
  })();

  const compareValues = (valueA: unknown, valueB: unknown): number => {
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
        return 0;
      }
      return valueA.getTime() > valueB.getTime() ? direction : -direction;
    }

    if (typeof valueA === 'string' && typeof valueB === 'string') {
      const comparison = valueA.localeCompare(valueB);
      if (comparison === 0) {
        return 0;
      }
      return comparison * direction;
    }

    if (typeof valueA === 'number' && typeof valueB === 'number') {
      if (valueA === valueB) {
        return 0;
      }
      return valueA > valueB ? direction : -direction;
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
  salesSimulationsByTenant.clear();
  salesProposalsByTenant.clear();
  salesDealsByTenant.clear();
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
    stage: (input.stage ?? 'novo') as TicketStage,
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

  if (typeof input.stage === 'string') {
    record.stage = input.stage as TicketStage;
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

export const createSalesSimulation = async (
  input: CreateSalesSimulationDTO
): Promise<SalesSimulation> => {
  const bucket = getSalesSimulationBucket(input.tenantId);
  const now = new Date();
  const record: SalesSimulationRecord = {
    id: randomUUID(),
    tenantId: input.tenantId,
    ticketId: input.ticketId,
    leadId: input.leadId ?? undefined,
    calculationSnapshot: { ...(input.calculationSnapshot ?? {}) },
    metadata: { ...(input.metadata ?? {}) },
    createdAt: now,
    updatedAt: now,
  };

  bucket.set(record.id, record);
  return toSalesSimulation(record);
};

export const findSalesSimulationById = async (
  tenantId: string,
  simulationId: string,
  options?: { includeChildren?: boolean }
): Promise<SalesSimulation | null> => {
  const record = getSalesSimulationBucket(tenantId).get(simulationId);
  return record ? toSalesSimulation(record, options) : null;
};

export const listSalesSimulations = async (
  tenantId: string,
  filters: SalesSimulationQuery,
  options?: { includeChildren?: boolean }
): Promise<SalesSimulation[]> => {
  const bucket = getSalesSimulationBucket(tenantId);
  const records = Array.from(bucket.values())
    .filter((record) => {
      if (filters.ticketId && record.ticketId !== filters.ticketId) {
        return false;
      }

      if (filters.leadId !== undefined && (record.leadId ?? null) !== filters.leadId) {
        return false;
      }

      return true;
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return records.map((record) => toSalesSimulation(record, options));
};

export const updateSalesSimulation = async (
  tenantId: string,
  simulationId: string,
  input: UpdateSalesSimulationDTO
): Promise<SalesSimulation | null> => {
  const bucket = getSalesSimulationBucket(tenantId);
  const record = bucket.get(simulationId);
  if (!record) {
    return null;
  }

  if ('leadId' in input) {
    record.leadId = input.leadId ?? undefined;
  }

  if (input.calculationSnapshot !== undefined) {
    record.calculationSnapshot = { ...input.calculationSnapshot };
  }

  if (input.metadata !== undefined) {
    record.metadata = { ...input.metadata };
  }

  record.updatedAt = new Date();
  bucket.set(record.id, record);
  return toSalesSimulation(record);
};

export const deleteSalesSimulation = async (
  tenantId: string,
  simulationId: string
): Promise<boolean> => {
  const bucket = getSalesSimulationBucket(tenantId);
  const existed = bucket.delete(simulationId);

  if (!existed) {
    return false;
  }

  const proposals = getSalesProposalBucket(tenantId);
  for (const proposal of proposals.values()) {
    if (proposal.simulationId === simulationId) {
      proposal.simulationId = undefined;
      proposal.updatedAt = new Date();
    }
  }

  const deals = getSalesDealBucket(tenantId);
  for (const deal of deals.values()) {
    if (deal.simulationId === simulationId) {
      deal.simulationId = undefined;
      deal.updatedAt = new Date();
    }
  }

  return true;
};

export const createSalesProposal = async (
  input: CreateSalesProposalDTO
): Promise<SalesProposal> => {
  const bucket = getSalesProposalBucket(input.tenantId);
  const now = new Date();
  const record: SalesProposalRecord = {
    id: randomUUID(),
    tenantId: input.tenantId,
    ticketId: input.ticketId,
    leadId: input.leadId ?? undefined,
    simulationId: input.simulationId ?? undefined,
    calculationSnapshot: { ...(input.calculationSnapshot ?? {}) },
    metadata: { ...(input.metadata ?? {}) },
    createdAt: now,
    updatedAt: now,
  };

  bucket.set(record.id, record);
  return toSalesProposal(record);
};

export const findSalesProposalById = async (
  tenantId: string,
  proposalId: string,
  options?: { includeSimulation?: boolean; includeDeals?: boolean }
): Promise<SalesProposal | null> => {
  const record = getSalesProposalBucket(tenantId).get(proposalId);
  return record ? toSalesProposal(record, options) : null;
};

export const listSalesProposals = async (
  tenantId: string,
  filters: SalesProposalQuery,
  options?: { includeSimulation?: boolean; includeDeals?: boolean }
): Promise<SalesProposal[]> => {
  const bucket = getSalesProposalBucket(tenantId);
  const records = Array.from(bucket.values())
    .filter((record) => {
      if (filters.ticketId && record.ticketId !== filters.ticketId) {
        return false;
      }

      if (filters.leadId !== undefined && (record.leadId ?? null) !== filters.leadId) {
        return false;
      }

      if (filters.simulationId !== undefined && (record.simulationId ?? null) !== filters.simulationId) {
        return false;
      }

      return true;
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return records.map((record) => toSalesProposal(record, options));
};

export const updateSalesProposal = async (
  tenantId: string,
  proposalId: string,
  input: UpdateSalesProposalDTO
): Promise<SalesProposal | null> => {
  const bucket = getSalesProposalBucket(tenantId);
  const record = bucket.get(proposalId);
  if (!record) {
    return null;
  }

  if ('leadId' in input) {
    record.leadId = input.leadId ?? undefined;
  }

  if ('simulationId' in input) {
    record.simulationId = input.simulationId ?? undefined;
  }

  if (input.calculationSnapshot !== undefined) {
    record.calculationSnapshot = { ...input.calculationSnapshot };
  }

  if (input.metadata !== undefined) {
    record.metadata = { ...input.metadata };
  }

  record.updatedAt = new Date();
  bucket.set(record.id, record);
  return toSalesProposal(record);
};

export const deleteSalesProposal = async (
  tenantId: string,
  proposalId: string
): Promise<boolean> => {
  const bucket = getSalesProposalBucket(tenantId);
  const existed = bucket.delete(proposalId);

  if (!existed) {
    return false;
  }

  const deals = getSalesDealBucket(tenantId);
  for (const deal of deals.values()) {
    if (deal.proposalId === proposalId) {
      deal.proposalId = undefined;
      deal.updatedAt = new Date();
    }
  }

  return true;
};

export const createSalesDeal = async (
  input: CreateSalesDealDTO
): Promise<SalesDeal> => {
  const bucket = getSalesDealBucket(input.tenantId);
  const now = new Date();
  const record: SalesDealRecord = {
    id: randomUUID(),
    tenantId: input.tenantId,
    ticketId: input.ticketId,
    leadId: input.leadId ?? undefined,
    simulationId: input.simulationId ?? undefined,
    proposalId: input.proposalId ?? undefined,
    calculationSnapshot: { ...(input.calculationSnapshot ?? {}) },
    metadata: { ...(input.metadata ?? {}) },
    closedAt: input.closedAt ?? undefined,
    createdAt: now,
    updatedAt: now,
  };

  bucket.set(record.id, record);
  return toSalesDeal(record);
};

export const findSalesDealById = async (
  tenantId: string,
  dealId: string,
  options?: { includeSimulation?: boolean; includeProposal?: boolean }
): Promise<SalesDeal | null> => {
  const record = getSalesDealBucket(tenantId).get(dealId);
  return record ? toSalesDeal(record, options) : null;
};

export const listSalesDeals = async (
  tenantId: string,
  filters: SalesDealQuery,
  options?: { includeSimulation?: boolean; includeProposal?: boolean }
): Promise<SalesDeal[]> => {
  const bucket = getSalesDealBucket(tenantId);
  const records = Array.from(bucket.values())
    .filter((record) => {
      if (filters.ticketId && record.ticketId !== filters.ticketId) {
        return false;
      }

      if (filters.leadId !== undefined && (record.leadId ?? null) !== filters.leadId) {
        return false;
      }

      if (filters.simulationId !== undefined && (record.simulationId ?? null) !== filters.simulationId) {
        return false;
      }

      if (filters.proposalId !== undefined && (record.proposalId ?? null) !== filters.proposalId) {
        return false;
      }

      return true;
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return records.map((record) => toSalesDeal(record, options));
};

export const updateSalesDeal = async (
  tenantId: string,
  dealId: string,
  input: UpdateSalesDealDTO
): Promise<SalesDeal | null> => {
  const bucket = getSalesDealBucket(tenantId);
  const record = bucket.get(dealId);
  if (!record) {
    return null;
  }

  if ('leadId' in input) {
    record.leadId = input.leadId ?? undefined;
  }

  if ('simulationId' in input) {
    record.simulationId = input.simulationId ?? undefined;
  }

  if ('proposalId' in input) {
    record.proposalId = input.proposalId ?? undefined;
  }

  if (input.calculationSnapshot !== undefined) {
    record.calculationSnapshot = { ...input.calculationSnapshot };
  }

  if (input.metadata !== undefined) {
    record.metadata = { ...input.metadata };
  }

  if (input.closedAt !== undefined) {
    record.closedAt = input.closedAt ?? undefined;
  }

  record.updatedAt = new Date();
  bucket.set(record.id, record);
  return toSalesDeal(record);
};

export const deleteSalesDeal = async (
  tenantId: string,
  dealId: string
): Promise<boolean> => {
  const bucket = getSalesDealBucket(tenantId);
  return bucket.delete(dealId);
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
