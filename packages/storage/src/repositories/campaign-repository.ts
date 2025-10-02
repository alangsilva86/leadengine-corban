import { randomUUID } from 'crypto';

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

const getTenantBucket = (tenantId: string): Map<string, Campaign> => {
  let bucket = campaignsByTenant.get(tenantId);
  if (!bucket) {
    bucket = new Map<string, Campaign>();
    campaignsByTenant.set(tenantId, bucket);
  }
  return bucket;
};

const findByCompositeKey = (
  tenantId: string,
  agreementId: string,
  instanceId: string
): Campaign | undefined => {
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
  const bucket = getTenantBucket(input.tenantId);
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

export const findCampaignById = async (
  tenantId: string,
  campaignId: string
): Promise<Campaign | null> => {
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

export const resetCampaignStore = () => {
  campaignsByTenant.clear();
};
