import { Suspense } from 'react';

import CampaignsPanel from '../components/CampaignsPanel.jsx';

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

const CampaignManager = ({
  agreementName,
  campaigns,
  loading,
  error,
  onRefresh,
  onCreateClick,
  onPause,
  onActivate,
  onDelete,
  onReassign,
  onDisconnect,
  actionState,
  selectedInstanceId,
  canCreateCampaigns,
  selectedAgreementId,
}: CampaignManagerProps) => {
  return (
    <Suspense fallback={null}>
      <CampaignsPanel
        agreementName={agreementName ?? undefined}
        campaigns={campaigns}
        loading={loading}
        error={error}
        onRefresh={onRefresh}
        onCreateClick={onCreateClick}
        onPause={onPause}
        onActivate={onActivate}
        onDelete={onDelete}
        onReassign={onReassign}
        onDisconnect={onDisconnect}
        actionState={actionState}
        selectedInstanceId={selectedInstanceId ?? undefined}
        canCreateCampaigns={canCreateCampaigns}
        selectedAgreementId={selectedAgreementId ?? undefined}
      />
    </Suspense>
  );
};

export default CampaignManager;
