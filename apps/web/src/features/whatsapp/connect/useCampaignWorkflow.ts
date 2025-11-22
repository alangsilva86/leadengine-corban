import useWhatsappCampaignActions from './hooks/useWhatsappCampaignActions';
import type { WhatsAppConnectAction, WhatsAppConnectState } from './useWhatsAppConnect';

interface UseCampaignWorkflowParams {
  state: WhatsAppConnectState;
  dispatch: (action: WhatsAppConnectAction) => void;
  selectedAgreement: any;
  activeCampaign: any;
  instance: any;
  instances: any[];
  handleAuthFallback: (options: { error: any }) => void;
  logError: (message: string, error: any) => void;
  onCampaignReady?: (campaign: any | null) => void;
}

const useCampaignWorkflow = ({
  state,
  dispatch,
  selectedAgreement,
  activeCampaign,
  instance,
  instances,
  handleAuthFallback,
  logError,
  onCampaignReady,
}: UseCampaignWorkflowParams) => {
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
