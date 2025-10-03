import LeadSummaryCard from './LeadSummaryCard.jsx';
import ContactDetailsCard from './ContactDetailsCard.jsx';
import ConsentInfo from './ConsentInfo.jsx';
import ProposalMiniSim from './ProposalMiniSim.jsx';
import NotesSection from './NotesSection.jsx';
import TasksSection from './TasksSection.jsx';
import AuditTrailLink from './AuditTrailLink.jsx';

export const DetailsPanel = ({
  ticket,
  onCreateNote,
  notesLoading,
  onGenerateProposal,
  onReopenWindow,
  onOpenAudit,
}) => {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      <LeadSummaryCard lead={ticket?.lead} />
      <ContactDetailsCard contact={ticket?.contact} />
      <ConsentInfo consent={ticket?.contact?.consent} />
      <ProposalMiniSim lead={ticket?.lead} onGenerate={onGenerateProposal} />
      <NotesSection notes={ticket?.notes ?? []} onCreate={onCreateNote} loading={notesLoading} />
      <TasksSection ticket={ticket} onReopenWindow={onReopenWindow} />
      <AuditTrailLink onOpenAudit={onOpenAudit} />
    </div>
  );
};

export default DetailsPanel;
