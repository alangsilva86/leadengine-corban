export interface FetchCampaignsParams {
    agreementId: string | null;
    instanceId?: string | null;
}
export declare function fetchCampaigns({ agreementId, instanceId, }: FetchCampaignsParams): Promise<any[]>;
export interface CreateCampaignPayload {
    agreementId: string;
    agreementName?: string | null;
    instanceId: string;
    name: string;
    status: string;
    brokerId?: string | null;
    productType: string;
    marginType: string;
    marginValue?: number | null;
    leadSource?: string;
    segments?: string[];
    tags?: string[];
    strategy?: string | null;
    leadSource?: string;
    segments?: string[];
}
export declare function createCampaign(payload: CreateCampaignPayload): Promise<any>;
export declare function updateCampaignStatus(campaignId: string, status: string): Promise<void>;
export declare function deleteCampaign(campaignId: string): Promise<void>;
export declare function reassignCampaign(campaignId: string, instanceId: string | null): Promise<void>;
export declare function fetchCampaignImpact(campaignId: string): Promise<{
    summary: any;
    items: any;
}>;
