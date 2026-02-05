import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api.js';
export async function fetchCampaigns({ agreementId, instanceId, }) {
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
export async function createCampaign(payload) {
    const response = await apiPost('/api/campaigns', payload);
    return response?.data ?? null;
}
export async function updateCampaignStatus(campaignId, status) {
    await apiPatch(`/api/campaigns/${encodeURIComponent(campaignId)}`, { status });
}
export async function deleteCampaign(campaignId) {
    await apiDelete(`/api/campaigns/${encodeURIComponent(campaignId)}`);
}
export async function reassignCampaign(campaignId, instanceId) {
    await apiPatch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
        instanceId,
    });
}
export async function fetchCampaignImpact(campaignId) {
    const response = await apiGet(`/api/lead-engine/allocations?campaignId=${encodeURIComponent(campaignId)}`);
    const summary = response?.meta?.summary ?? null;
    return {
        summary,
        items: Array.isArray(response?.data) ? response.data : [],
    };
}
