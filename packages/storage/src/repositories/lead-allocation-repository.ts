import { Prisma, $Enums } from '@prisma/client';
import { getPrismaClient } from '../prisma-client';

export type LeadAllocationStatus = 'allocated' | 'contacted' | 'won' | 'lost';

type PrismaLeadAllocationStatus = $Enums.LeadAllocationStatus;

type LeadAllocationRecord = Prisma.LeadAllocationGetPayload<{
  include: { lead: { include: { tenant: true } }; campaign: true; tenant: true };
}>;

type BrokerLead = LeadAllocationRecord['lead'];
type PrismaCampaign = NonNullable<LeadAllocationRecord['campaign']>;

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
  instanceId?: string;
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

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

const sanitizeDocument = (value: string): string => value.replace(/\D/g, '');

const normalizePhone = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10) {
    return undefined;
  }
  return `+${digits.replace(/^\+/, '')}`;
};

const uniqueStrings = (items: string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  items.forEach((item) => {
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  });
  return normalized;
};

const mapCampaign = (
  campaign: LeadAllocationRecord['campaign']
): Pick<LeadAllocationDto, 'campaignName' | 'agreementId' | 'instanceId'> => {
  if (!campaign) {
    return {
      campaignName: 'Campanha desconhecida',
      agreementId: 'unknown',
      instanceId: 'default',
    };
  }

  return {
    campaignName: campaign.name,
    agreementId: campaign.agreementId ?? 'unknown',
    instanceId: campaign.whatsappInstanceId ?? 'default',
  };
};

const FALLBACK_CAMPAIGN_NAME = 'WhatsApp • Inbound';
const FALLBACK_CAMPAIGN_AGREEMENT_PREFIX = 'whatsapp-instance-fallback';

const ensureFallbackCampaignForInstance = async (
  tenantId: string,
  instanceId: string
): Promise<PrismaCampaign> => {
  const prisma = getPrismaClient();

  return prisma.campaign.upsert({
    where: {
      tenantId_agreementId_whatsappInstanceId: {
        tenantId,
        agreementId: `${FALLBACK_CAMPAIGN_AGREEMENT_PREFIX}:${instanceId}`,
        whatsappInstanceId: instanceId,
      },
    },
    update: {
      status: 'active',
      name: FALLBACK_CAMPAIGN_NAME,
      agreementName: FALLBACK_CAMPAIGN_NAME,
      metadata: {
        fallback: true,
        source: 'whatsapp-inbound',
      } as Prisma.InputJsonValue,
    },
    create: {
      tenantId,
      name: FALLBACK_CAMPAIGN_NAME,
      agreementId: `${FALLBACK_CAMPAIGN_AGREEMENT_PREFIX}:${instanceId}`,
      agreementName: FALLBACK_CAMPAIGN_NAME,
      whatsappInstanceId: instanceId,
      status: 'active',
      metadata: {
        fallback: true,
        source: 'whatsapp-inbound',
      } as Prisma.InputJsonValue,
    },
  });
};

const mapAllocation = (allocation: LeadAllocationRecord): LeadAllocationDto => {
  const campaignInfo = mapCampaign(allocation.campaign);
  const payload = (allocation.payload as Record<string, unknown> | null) ?? null;

  const result: LeadAllocationDto = {
    allocationId: allocation.id,
    leadId: allocation.leadId,
    tenantId: allocation.tenant.id,
    campaignId: allocation.campaignId,
    campaignName: campaignInfo.campaignName,
    agreementId:
      campaignInfo.agreementId ?? allocation.lead.agreementId ?? 'unknown',
    instanceId: campaignInfo.instanceId,
    status: allocation.status as LeadAllocationStatus,
    receivedAt: allocation.receivedAt.toISOString(),
    updatedAt: allocation.updatedAt.toISOString(),
    fullName: allocation.lead.fullName,
    document: allocation.lead.document,
    registrations: [...allocation.lead.registrations],
    tags: [...allocation.lead.tags],
    payload,
  };

  if (allocation.notes !== null && allocation.notes !== undefined) {
    result.notes = allocation.notes;
  }

  const lead = allocation.lead;

  if (lead.matricula !== null && lead.matricula !== undefined) {
    result.matricula = lead.matricula;
  }

  if (lead.phone !== null && lead.phone !== undefined) {
    result.phone = lead.phone;
  }

  if (lead.margin !== null && lead.margin !== undefined) {
    result.margin = lead.margin;
  }

  if (lead.netMargin !== null && lead.netMargin !== undefined) {
    result.netMargin = lead.netMargin;
  }

  if (lead.score !== null && lead.score !== undefined) {
    result.score = lead.score;
  }

  return result;
};

const computeSummary = async (
  tenantId: string,
  campaignId?: string
): Promise<{ summary: AllocationSummary; metrics: CampaignMetrics }> => {
  const prisma = getPrismaClient();
  const where: Prisma.LeadAllocationWhereInput = {
    tenantId,
    ...(campaignId ? { campaignId } : {}),
  };

  const records = await prisma.leadAllocation.findMany({
    where,
    select: {
      status: true,
      receivedAt: true,
      updatedAt: true,
    },
  });

  const summary: AllocationSummary = {
    total: records.length,
    contacted: 0,
    won: 0,
    lost: 0,
  };

  const metrics: CampaignMetrics = {
    total: records.length,
    allocated: 0,
    contacted: 0,
    won: 0,
    lost: 0,
    averageResponseSeconds: null,
  };

  let totalResponseMs = 0;
  let responseCount = 0;

  records.forEach((allocation) => {
    if (allocation.status === 'allocated') {
      metrics.allocated += 1;
      return;
    }

    if (allocation.status === 'contacted') {
      summary.contacted += 1;
      metrics.contacted += 1;
    }

    if (allocation.status === 'won') {
      summary.won += 1;
      metrics.won += 1;
    }

    if (allocation.status === 'lost') {
      summary.lost += 1;
      metrics.lost += 1;
    }

    const diff = allocation.updatedAt.getTime() - allocation.receivedAt.getTime();
    if (diff >= 0) {
      totalResponseMs += diff;
      responseCount += 1;
    }
  });

  if (responseCount > 0) {
    metrics.averageResponseSeconds = Math.round(totalResponseMs / responseCount / 1000);
  }

  return { summary, metrics };
};

export const listAllocations = async (filters: AllocationFilters): Promise<LeadAllocationDto[]> => {
  const prisma = getPrismaClient();
  const where: Prisma.LeadAllocationWhereInput = {
    tenantId: filters.tenantId,
  };

  if (filters.campaignId) {
    where.campaignId = filters.campaignId;
  }

  if (filters.statuses?.length) {
    const statuses = filters.statuses.map(
      (status) => status as PrismaLeadAllocationStatus
    );
    where.status = { in: statuses };
  }

  const campaignCriteria: Prisma.CampaignWhereInput = {};

  if (filters.instanceId) {
    campaignCriteria.whatsappInstanceId = filters.instanceId;
  }

  if (filters.agreementId) {
    where.OR = [
      {
        campaign: {
          ...(filters.instanceId ? { whatsappInstanceId: filters.instanceId } : {}),
          agreementId: filters.agreementId,
        },
      },
      { lead: { agreementId: filters.agreementId } },
    ];
  } else if (Object.keys(campaignCriteria).length > 0) {
    where.campaign = campaignCriteria;
  }

  const allocations = await prisma.leadAllocation.findMany({
    where,
    orderBy: { receivedAt: 'desc' },
    include: { lead: { include: { tenant: true } }, campaign: true, tenant: true },
  });

  return allocations.map(mapAllocation);
};

export const allocateBrokerLeads = async (params: {
  tenantId: string;
  campaignId?: string;
  instanceId?: string;
  leads: BrokerLeadInput[];
}): Promise<{ newlyAllocated: LeadAllocationDto[]; summary: AllocationSummary }> => {
  const prisma = getPrismaClient();
  const now = new Date();
  const threshold = new Date(now.getTime() - DEDUPE_WINDOW_MS);

  let targetCampaignId = params.campaignId;

  if (!targetCampaignId) {
    if (!params.instanceId) {
      throw new Error('campaignId or instanceId must be provided to allocate broker leads');
    }

    const fallbackCampaign = await ensureFallbackCampaignForInstance(
      params.tenantId,
      params.instanceId
    );
    targetCampaignId = fallbackCampaign.id;
  }

  const created = await prisma.$transaction(async (tx) => {
    const allocations: LeadAllocationRecord[] = [];

    for (const leadInput of params.leads) {
      const normalizedPhone = normalizePhone(leadInput.phone);
      const document = sanitizeDocument(leadInput.document || normalizedPhone || '');

      if (!document) {
        continue;
      }

      const recentAllocation = await tx.leadAllocation.findFirst({
        where: {
          tenantId: params.tenantId,
          campaignId: targetCampaignId!,
          receivedAt: { gte: threshold },
          lead: { document },
        },
        orderBy: { receivedAt: 'desc' },
      });

      if (recentAllocation) {
        continue;
      }

      const normalizedRegistrations = uniqueStrings(leadInput.registrations ?? []);
      const normalizedTags = uniqueStrings(leadInput.tags ?? []);

      const lead = await tx.brokerLead.upsert({
        where: {
          tenantId_document: {
            tenantId: params.tenantId,
            document,
          },
        },
        update: {
          fullName: leadInput.fullName,
          agreementId: leadInput.agreementId,
          matricula: normalizedRegistrations[0] ?? null,
          phone: normalizedPhone ?? null,
          registrations: { set: normalizedRegistrations },
          tags: { set: normalizedTags },
          margin: leadInput.margin ?? null,
          netMargin: leadInput.netMargin ?? null,
          score: leadInput.score ?? null,
          raw: (leadInput.raw ?? null) as Prisma.InputJsonValue,
        },
        create: {
          tenant: { connect: { id: params.tenantId } },
          agreementId: leadInput.agreementId,
          fullName: leadInput.fullName,
          document,
          matricula: normalizedRegistrations[0] ?? null,
          phone: normalizedPhone ?? null,
          registrations: normalizedRegistrations,
          tags: normalizedTags,
          margin: leadInput.margin ?? null,
          netMargin: leadInput.netMargin ?? null,
          score: leadInput.score ?? null,
          raw: (leadInput.raw ?? null) as Prisma.InputJsonValue,
        },
      });

      const existingAllocation = await tx.leadAllocation.findUnique({
        where: {
          tenantId_leadId_campaignId: {
            tenantId: params.tenantId,
            leadId: lead.id,
            campaignId: targetCampaignId!,
          },
        },
      });

      if (existingAllocation) {
        continue;
      }

      const createdAllocation = await tx.leadAllocation.create({
        data: {
          tenant: { connect: { id: params.tenantId } },
          campaign: { connect: { id: targetCampaignId! } },
          lead: { connect: { id: lead.id } },
          status: 'allocated',
          notes: null,
          payload: (leadInput.raw ?? null) as Prisma.InputJsonValue,
          receivedAt: now,
        },
        include: { lead: { include: { tenant: true } }, campaign: true, tenant: true },
      });

      allocations.push(createdAllocation);
    }

    return allocations;
  });

  const { summary } = await computeSummary(params.tenantId, targetCampaignId);

  return {
    newlyAllocated: created.map(mapAllocation),
    summary,
  };
};

export const updateAllocation = async (params: {
  tenantId: string;
  allocationId: string;
  updates: Partial<{ status: LeadAllocationStatus; notes: string | null }>;
}): Promise<LeadAllocationDto | null> => {
  const prisma = getPrismaClient();
  const existing = await prisma.leadAllocation.findFirst({
    where: { id: params.allocationId, tenantId: params.tenantId },
  });

  if (!existing) {
    return null;
  }

  const data: Prisma.LeadAllocationUpdateInput = {};

  if (params.updates.status) {
    data.status = params.updates.status as PrismaLeadAllocationStatus;
  }

  if (params.updates.notes !== undefined) {
    data.notes = params.updates.notes ?? null;
  }

  const updated = await prisma.leadAllocation.update({
    where: { id: existing.id },
    data,
    include: { lead: { include: { tenant: true } }, campaign: true, tenant: true },
  });

  return mapAllocation(updated);
};

export const resetAllocationStore = async () => {
  const prisma = getPrismaClient();
  await prisma.$transaction([
    prisma.leadAllocation.deleteMany({}),
    prisma.brokerLead.deleteMany({}),
  ]);
};

export const getCampaignMetrics = async (
  tenantId: string,
  campaignId: string
): Promise<CampaignMetrics> => {
  const { metrics } = await computeSummary(tenantId, campaignId);
  return metrics;
};
