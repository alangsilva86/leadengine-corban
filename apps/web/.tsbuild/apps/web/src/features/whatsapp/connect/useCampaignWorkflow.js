import useWhatsappCampaignActions from './hooks/useWhatsappCampaignActions';
const useCampaignWorkflow = ({ state, dispatch, selectedAgreement, activeCampaign, instance, instances, handleAuthFallback, logError, onCampaignReady, }) => {
    return useWhatsappCampaignActions({
        state,
        dispatch,
        selectedAgreement,
        activeCampaign,
        instance,
        instances,
        handleAuthFallback,
        logError,
        onCampaignReady,
    });
};
export default useCampaignWorkflow;
