import { useRef } from 'react';
import { FileText, Repeat2, ShieldCheck, StickyNote } from 'lucide-react';
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
  const notesSectionRef = useRef(null);

  const actions = [
    {
      label: 'Gerar minuta',
      description: 'Resumo pré-aprovado com dados do lead',
      icon: FileText,
      onClick: () => onGenerateProposal?.(),
      disabled: typeof onGenerateProposal !== 'function',
    },
    {
      label: 'Reabrir janela',
      description: 'Sugere template homologado',
      icon: Repeat2,
      onClick: () => onReopenWindow?.(),
      disabled: typeof onReopenWindow !== 'function',
    },
    {
      label: 'Abrir auditoria',
      description: 'Compliance & trilha de eventos',
      icon: ShieldCheck,
      onClick: () => onOpenAudit?.(),
      disabled: typeof onOpenAudit !== 'function',
    },
    {
      label: 'Nova nota',
      description: 'Registrar alinhamentos internos',
      icon: StickyNote,
      onClick: () => notesSectionRef.current?.focusComposer?.(),
      disabled: false,
    },
  ];

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            type="button"
            key={action.label}
            onClick={action.onClick}
            disabled={action.disabled}
            className="group flex flex-col gap-2 rounded-3xl bg-surface-overlay-quiet p-4 text-left shadow-[0_24px_50px_-32px_rgba(15,23,42,0.9)] ring-1 ring-surface-overlay-glass-border backdrop-blur transition hover:bg-surface-overlay-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-inner shadow-[inset_0_0_0_1px_var(--surface-overlay-glass-border)]">
              <action.icon className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-foreground">{action.label}</span>
            <span className="text-xs text-foreground-muted">{action.description}</span>
          </button>
        ))}
      </div>
      <LeadSummaryCard lead={ticket?.lead} />
      <ContactDetailsCard contact={ticket?.contact} />
      <ConsentInfo consent={ticket?.contact?.consent} />
      <ProposalMiniSim lead={ticket?.lead} onGenerate={onGenerateProposal} />
      <NotesSection ref={notesSectionRef} notes={ticket?.notes ?? []} onCreate={onCreateNote} loading={notesLoading} />
      <TasksSection ticket={ticket} onReopenWindow={onReopenWindow} />
      <AuditTrailLink onOpenAudit={onOpenAudit} />
    </div>
  );
};

export default DetailsPanel;
