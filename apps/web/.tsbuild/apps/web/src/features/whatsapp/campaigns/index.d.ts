import useWhatsAppConnect from '../connect/useWhatsAppConnect';
type WhatsAppCampaignsProps = Parameters<typeof useWhatsAppConnect>[0] & {
    onNavigateStage?: (stageId: string) => void;
};
declare const WhatsAppCampaigns: (props: WhatsAppCampaignsProps) => import("react/jsx-runtime").JSX.Element;
export default WhatsAppCampaigns;
