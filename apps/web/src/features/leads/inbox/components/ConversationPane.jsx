import LeadConversationPanel from './LeadConversationPanel.jsx';

const ConversationPane = ({ allocation, onOpenWhatsApp, isLoading, isSwitching }) => {
  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <LeadConversationPanel
        allocation={allocation}
        onOpenWhatsApp={onOpenWhatsApp}
        isLoading={isLoading}
        isSwitching={isSwitching}
      />
    </div>
  );
};

export default ConversationPane;
