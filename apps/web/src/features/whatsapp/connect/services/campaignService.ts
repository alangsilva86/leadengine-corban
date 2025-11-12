import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api.js';

export interface FetchCampaignsParams {
  agreementId: string | null;
  instanceId?: string | null;
}

export async function fetchCampaigns({
  agreementId,
  instanceId,
}: FetchCampaignsParams): Promise<any[]> {
  const params = new URLSearchParams();
  if (agreementId) {
    params.set('agreementId', agreementId);
  }
  if (instanceId) {
    params.set('instanceId', instanceId);
  }
  const query = params.toString();
  const response = await apiGet(`/api/campaigns${query ? `?${query}` : ''}`);
  return Array.isArray(response?.data) ? response.data : [];
}

export interface CreateCampaignPayload {
  agreementId: string;
  agreementName?: string | null;
  instanceId: string;
  name: string;
  status: string;
  brokerId?: string | null;
  productType?: string | null;
  marginType?: string | null;
  strategy?: string | null;
  tags?: string[];
}

export async function createCampaign(payload: CreateCampaignPayload) {
  const response = await apiPost('/api/campaigns', payload);
  return response?.data ?? null;
}

export async function updateCampaignStatus(campaignId: string, status: string) {
  await apiPatch(`/api/campaigns/${encodeURIComponent(campaignId)}`, { status });
}

export async function deleteCampaign(campaignId: string) {
  await apiDelete(`/api/campaigns/${encodeURIComponent(campaignId)}`);
}

export async function reassignCampaign(campaignId: string, instanceId: string | null) {
  await apiPatch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
    instanceId,
  });
}

export async function fetchCampaignImpact(campaignId: string) {
  const response = await apiGet(
    `/api/lead-engine/allocations?campaignId=${encodeURIComponent(campaignId)}`
  );
  const summary = response?.meta?.summary ?? null;
  return {
    summary,
    items: Array.isArray(response?.data) ? response.data : [],
  };
}
