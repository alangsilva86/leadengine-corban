import { randomUUID } from 'crypto';
import type { Campaign } from './campaign-repository';
import { findCampaignById } from './campaign-repository';

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

const toDto = async (allocation: AllocationRecord): Promise<LeadAllocationDto> => {
  const leads = leadsByTenant.get(allocation.tenantId) ?? new Map<string, LeadRecord>();
  const lead = leads.get(allocation.leadId);
  const campaign: Campaign | null = await findCampaignById(allocation.tenantId, allocation.campaignId);

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

  const dtos = await Promise.all(items.map((allocation) => toDto(allocation)));
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
    const document = sanitizeDocument(leadInput.document);
    if (!document) {
      continue;
    }

    const leadId = docIndex.get(document);
    const normalizedRegistrations = uniqueStrings(leadInput.registrations ?? []);
    const normalizedTags = uniqueStrings(leadInput.tags ?? []);
    const normalizedPhone = normalizePhone(leadInput.phone);

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
    created.push(allocation);
  }

  const newlyAllocated = await Promise.all(created.map((allocation) => toDto(allocation)));
  const summary = getSummary(params.tenantId, params.campaignId);

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

  return toDto(allocation);
};

export const resetAllocationStore = () => {
  leadsByTenant.clear();
  leadDocumentIndex.clear();
  allocationsByTenant.clear();
  allocationKeyIndex.clear();
};
