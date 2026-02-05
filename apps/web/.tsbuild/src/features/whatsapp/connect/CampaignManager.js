import { jsx as _jsx } from "react/jsx-runtime";
import { Suspense } from 'react';
import CampaignsPanel from '../components/CampaignsPanel.jsx';
const CampaignManager = ({ agreementName, campaigns, loading, error, onRefresh, onCreateClick, onPause, onActivate, onDelete, onReassign, onDisconnect, actionState, selectedInstanceId, canCreateCampaigns, selectedAgreementId, }) => {
    return (_jsx(Suspense, { fallback: null, children: _jsx(CampaignsPanel, { agreementName: agreementName ?? undefined, campaigns: campaigns, loading: loading, error: error, onRefresh: onRefresh, onCreateClick: onCreateClick, onPause: onPause, onActivate: onActivate, onDelete: onDelete, onReassign: onReassign, onDisconnect: onDisconnect, actionState: actionState, selectedInstanceId: selectedInstanceId ?? undefined, canCreateCampaigns: canCreateCampaigns, selectedAgreementId: selectedAgreementId ?? undefined }) }));
};
export default CampaignManager;
