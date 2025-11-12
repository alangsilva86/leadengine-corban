import { Prisma } from '@prisma/client';

import { getPrismaClient } from '../prisma-client';

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

const CAMPAIGN_SELECT = {
  id: true,
  tenantId: true,
  agreementId: true,
  agreementName: true,
  whatsappInstanceId: true,
  name: true,
  status: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
  productType: true,
  marginType: true,
  strategy: true,
  metadata: true,
  tags: true,
} satisfies Prisma.CampaignSelect;

type CampaignRecord = Prisma.CampaignGetPayload<{ select: typeof CAMPAIGN_SELECT }>;

const mapCampaign = (record: CampaignRecord): Campaign => ({
  id: record.id,
  tenantId: record.tenantId,
  agreementId: record.agreementId,
  agreementName: record.agreementName ?? null,
  instanceId: record.whatsappInstanceId ?? 'default',
  name: record.name,
  status: record.status as CampaignStatus,
  startDate: record.startDate ?? null,
  endDate: record.endDate ?? null,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  productType: record.productType ?? null,
  marginType: record.marginType ?? null,
  strategy: record.strategy ?? null,
  tags: Array.isArray(record.tags) ? record.tags : [],
  metadata: (record.metadata as Record<string, unknown>) ?? {},
});

const statusOrder: Record<CampaignStatus, number> = {
  [CampaignStatus.DRAFT]: 0,
  [CampaignStatus.ACTIVE]: 1,
  [CampaignStatus.PAUSED]: 2,
  [CampaignStatus.ENDED]: 3,
};

const ensureStatus = (status?: CampaignStatus): CampaignStatus => status ?? CampaignStatus.DRAFT;

export const createOrActivateCampaign = async (input: CreateCampaignInput): Promise<Campaign> => {
  const prisma = getPrismaClient();
  const status = ensureStatus(input.status);
  const now = new Date();
  const normalizeTag = (value: string | null | undefined): string | null => {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const normalizedTags = new Set<string>();
  for (const tag of input.tags ?? []) {
    const normalized = normalizeTag(tag);
    if (normalized) {
      normalizedTags.add(normalized);
    }
  }

  for (const candidate of [input.productType, input.marginType, input.strategy]) {
    const normalized = normalizeTag(candidate ?? undefined);
    if (normalized) {
      normalizedTags.add(normalized);
    }
  }

  const tagList = Array.from(normalizedTags);

  const campaignWhere: Prisma.CampaignWhereInput = {
    tenantId: input.tenantId,
    agreementId: input.agreementId,
    whatsappInstanceId: input.instanceId,
  };

  if (input.productType !== undefined) {
    campaignWhere.productType = normalizeTag(input.productType ?? null);
  }

  if (input.marginType !== undefined) {
    campaignWhere.marginType = normalizeTag(input.marginType ?? null);
  }

  if (input.strategy !== undefined) {
    campaignWhere.strategy = normalizeTag(input.strategy ?? null);
  }

  const existing = await prisma.campaign.findFirst({
    where: campaignWhere,
    select: CAMPAIGN_SELECT,
  });

  if (existing) {
    const updated = await prisma.campaign.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        status,
        startDate: input.startDate ?? existing.startDate ?? now,
        endDate: input.endDate ?? (status === CampaignStatus.ACTIVE ? null : existing.endDate),
        agreementName: input.agreementName ?? existing.agreementName ?? null,
        productType: normalizeTag(input.productType ?? existing.productType ?? null),
        marginType: normalizeTag(input.marginType ?? existing.marginType ?? null),
        strategy: normalizeTag(input.strategy ?? existing.strategy ?? null),
        tags: tagList.length > 0 ? tagList : existing.tags,
        metadata: (input.metadata ?? existing.metadata ?? {}) as Prisma.JsonObject,
      },
      select: CAMPAIGN_SELECT,
    });

    return mapCampaign(updated);
  }

  const created = await prisma.campaign.create({
    data: {
      tenantId: input.tenantId,
      agreementId: input.agreementId,
      whatsappInstanceId: input.instanceId,
      name: input.name,
      status,
      startDate: input.startDate ?? now,
      endDate: input.endDate ?? null,
      agreementName: input.agreementName ?? null,
      productType: normalizeTag(input.productType ?? null),
      marginType: normalizeTag(input.marginType ?? null),
      strategy: normalizeTag(input.strategy ?? null),
      tags: tagList,
      metadata: (input.metadata ?? {}) as Prisma.JsonObject,
    },
    select: CAMPAIGN_SELECT,
  });

  return mapCampaign(created);
};

export const updateCampaignStatus = async (
  tenantId: string,
  campaignId: string,
  status: CampaignStatus
): Promise<Campaign | null> => {
  const prisma = getPrismaClient();
  const existing = await prisma.campaign.findFirst({
    where: { id: campaignId, tenantId },
    select: CAMPAIGN_SELECT,
  });

  if (!existing) {
    return null;
  }

  const now = new Date();
  const data: Prisma.CampaignUncheckedUpdateInput = {
    status,
  };

  if (status === CampaignStatus.ACTIVE) {
    data.endDate = null;
    data.startDate = existing.startDate ?? now;
  } else if (status === CampaignStatus.ENDED) {
    data.endDate = now;
  }

  const updated = await prisma.campaign.update({
    where: { id: existing.id },
    data,
    select: CAMPAIGN_SELECT,
  });

  return mapCampaign(updated);
};

export const findCampaignById = async (
  tenantId: string,
  campaignId: string
): Promise<Campaign | null> => {
  const prisma = getPrismaClient();
  const record = await prisma.campaign.findFirst({
    where: { id: campaignId, tenantId },
    select: CAMPAIGN_SELECT,
  });
  return record ? mapCampaign(record) : null;
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
  const prisma = getPrismaClient();
  const where: Prisma.CampaignWhereInput = {
    tenantId,
    agreementId,
    status: CampaignStatus.ACTIVE,
  };

  if (filters.instanceId) {
    where.whatsappInstanceId = filters.instanceId;
  }

  if (filters.productType !== undefined) {
    where.productType = filters.productType;
  }

  if (filters.marginType !== undefined) {
    where.marginType = filters.marginType;
  }

  if (filters.strategy !== undefined) {
    where.strategy = filters.strategy;
  }

  if (filters.tags?.length) {
    where.tags = { hasEvery: filters.tags };
  }

  const record = await prisma.campaign.findFirst({
    where,
    orderBy: { updatedAt: 'desc' },
    select: CAMPAIGN_SELECT,
  });

  return record ? mapCampaign(record) : null;
};

export const listCampaigns = async (filters: CampaignFilters): Promise<Campaign[]> => {
  const prisma = getPrismaClient();
  const where: Prisma.CampaignWhereInput = {
    tenantId: filters.tenantId,
    ...(filters.agreementId ? { agreementId: filters.agreementId } : {}),
  };

  if (filters.instanceId) {
    where.whatsappInstanceId = filters.instanceId;
  }

  if (filters.status?.length) {
    where.status = { in: filters.status };
  }

  if (filters.productType !== undefined) {
    where.productType = filters.productType;
  }

  if (filters.marginType !== undefined) {
    where.marginType = filters.marginType;
  }

  if (filters.strategy !== undefined) {
    where.strategy = filters.strategy;
  }

  if (filters.tags?.length) {
    where.tags = { hasEvery: filters.tags };
  }

  const records = await prisma.campaign.findMany({ where, select: CAMPAIGN_SELECT });

  return records
    .map(mapCampaign)
    .sort((a, b) => {
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) {
        return statusDiff;
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
};

export const resetCampaignStore = async () => {
  const prisma = getPrismaClient();
  await prisma.campaign.deleteMany({});
};
