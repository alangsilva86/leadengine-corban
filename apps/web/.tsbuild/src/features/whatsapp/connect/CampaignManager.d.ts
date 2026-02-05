interface CampaignManagerProps {
    agreementName: string | null;
    campaigns: any[];
    loading: boolean;
    error: string | null;
    onRefresh: () => void;
    onCreateClick: () => void;
    onPause: (campaign: any) => void;
    onActivate: (campaign: any) => void;
    onDelete: (campaign: any) => void;
    onReassign: (campaign: any) => void;
    onDisconnect: (campaign: any) => void;
    actionState: any;
    selectedInstanceId: string | null;
    canCreateCampaigns: boolean;
    selectedAgreementId: string | null;
}
declare const CampaignManager: ({ agreementName, campaigns, loading, error, onRefresh, onCreateClick, onPause, onActivate, onDelete, onReassign, onDisconnect, actionState, selectedInstanceId, canCreateCampaigns, selectedAgreementId, }: CampaignManagerProps) => import("react/jsx-runtime").JSX.Element;
export default CampaignManager;
