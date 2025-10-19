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
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      <section className="space-y-3">
        <header>
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-muted">Ações rápidas</h3>
        </header>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => (
            <button
              type="button"
              key={action.label}
              onClick={action.onClick}
              disabled={action.disabled}
              className="group flex flex-col gap-1.5 rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet px-3 py-3 text-left shadow-[0_12px_28px_-20px_rgba(15,23,42,0.55)] transition hover:border-[color:color-mix(in_srgb,var(--accent-inbox-primary)_35%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-bold)_88%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-shell)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 text-accent shadow-inner shadow-[inset_0_0_0_1px_var(--surface-overlay-glass-border)]">
                <action.icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-foreground">{action.label}</span>
              <span className="text-xs text-foreground-muted">{action.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <header>
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-muted">Informações do lead</h3>
        </header>
        <LeadSummaryCard lead={ticket?.lead} />
        <ContactDetailsCard contact={ticket?.contact} />
        <ConsentInfo consent={ticket?.contact?.consent} />
      </section>

      <section className="space-y-3">
        <header>
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-muted">Operações</h3>
        </header>
        <ProposalMiniSim lead={ticket?.lead} onGenerate={onGenerateProposal} />
        <TasksSection ticket={ticket} onReopenWindow={onReopenWindow} />
        <AuditTrailLink onOpenAudit={onOpenAudit} />
      </section>

      <section className="space-y-3">
        <header>
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-muted">Anotações</h3>
        </header>
        <NotesSection
          ref={notesSectionRef}
          notes={ticket?.notes ?? []}
          onCreate={onCreateNote}
          loading={notesLoading}
        />
      </section>
    </div>
  );
};

export default DetailsPanel;
