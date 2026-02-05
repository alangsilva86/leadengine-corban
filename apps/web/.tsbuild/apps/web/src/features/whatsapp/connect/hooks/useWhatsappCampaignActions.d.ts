import { fetchCampaignImpact } from '../services/campaignService';
import type { CampaignActionState, WhatsAppConnectAction, WhatsAppConnectState } from '../useWhatsAppConnect';
interface UseWhatsappCampaignActionsParams {
    state: WhatsAppConnectState;
    dispatch: (action: WhatsAppConnectAction) => void;
    selectedAgreement: any;
    activeCampaign: any | undefined;
    instance: any;
    instances: any[];
    handleAuthFallback: (options: {
        error: any;
    }) => void;
    logError: (message: string, error: any) => void;
    onCampaignReady?: (campaign: any | null) => void;
}
declare const useWhatsappCampaignActions: ({ state, dispatch, selectedAgreement, activeCampaign, instance, instances, handleAuthFallback, logError, onCampaignReady, }: UseWhatsappCampaignActionsParams) => {
    campaign: any;
    campaigns: any[];
    campaignsLoading: boolean;
    campaignError: string | null;
    campaignAction: CampaignActionState | null;
    createCampaign: ({ name, instanceId, agreementId, agreementName, leadSource, product, margin, strategy, status: requestedStatus, segments, }: {
        name: string;
        instanceId: string;
        agreementId: string;
        agreementName: string;
        leadSource: string;
        product: string;
        margin: number;
        strategy: string;
        segments?: string[];
        status?: string;
    }) => Promise<any>;
    updateCampaignStatus: (target: any, nextStatus: string) => Promise<void>;
    deleteCampaign: (target: any) => Promise<void>;
    reassignCampaign: (target: any, requestedInstanceId: string | null) => Promise<void>;
    reloadCampaigns: () => Promise<void>;
    fetchCampaignImpact: typeof fetchCampaignImpact;
    setCreateCampaignOpen: (value: boolean) => void;
    isCreateCampaignOpen: boolean;
    setPendingReassign: (value: any) => void;
    pendingReassign: any;
    setReassignIntent: (value: "reassign" | "disconnect") => void;
    reassignIntent: "disconnect" | "reassign";
    persistentWarning: string | null;
    clearCampaign: () => void;
};
export default useWhatsappCampaignActions;
