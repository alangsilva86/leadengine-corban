import { Prisma, type Campaign as PrismaCampaign } from '@prisma/client';

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

const mapCampaign = (record: PrismaCampaign): Campaign => ({
  id: record.id,
  tenantId: record.tenantId,
  agreementId: record.agreementId,
  instanceId: record.whatsappInstanceId ?? 'default',
  name: record.name,
  status: record.status as CampaignStatus,
  startDate: record.startDate ?? null,
  endDate: record.endDate ?? null,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
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

  const existing = await prisma.campaign.findFirst({
    where: {
      tenantId: input.tenantId,
      agreementId: input.agreementId,
      whatsappInstanceId: input.instanceId,
    },
  });

  if (existing) {
    const updated = await prisma.campaign.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        status,
        startDate: input.startDate ?? existing.startDate ?? now,
        endDate: input.endDate ?? (status === CampaignStatus.ACTIVE ? null : existing.endDate),
      },
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
    },
  });

  return mapCampaign(created);
};

export const updateCampaignStatus = async (
  tenantId: string,
  campaignId: string,
  status: CampaignStatus
): Promise<Campaign | null> => {
  const prisma = getPrismaClient();
  const existing = await prisma.campaign.findFirst({ where: { id: campaignId, tenantId } });

  if (!existing) {
    return null;
  }

  const now = new Date();
  const data: Prisma.CampaignUpdateInput = {
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
  });

  return mapCampaign(updated);
};

export const findCampaignById = async (
  tenantId: string,
  campaignId: string
): Promise<Campaign | null> => {
  const prisma = getPrismaClient();
  const record = await prisma.campaign.findFirst({ where: { id: campaignId, tenantId } });
  return record ? mapCampaign(record) : null;
};

export const findActiveCampaign = async (
  tenantId: string,
  agreementId: string,
  instanceId?: string
): Promise<Campaign | null> => {
  const prisma = getPrismaClient();
  const record = await prisma.campaign.findFirst({
    where: {
      tenantId,
      agreementId,
      status: CampaignStatus.ACTIVE,
      ...(instanceId ? { whatsappInstanceId: instanceId } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  });

  return record ? mapCampaign(record) : null;
};

export const listCampaigns = async (filters: CampaignFilters): Promise<Campaign[]> => {
  const prisma = getPrismaClient();
  const where: Prisma.CampaignWhereInput = {
    tenantId: filters.tenantId,
    ...(filters.agreementId ? { agreementId: filters.agreementId } : {}),
  };

  if (filters.status?.length) {
    where.status = { in: filters.status };
  }

  const records = await prisma.campaign.findMany({ where });

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
