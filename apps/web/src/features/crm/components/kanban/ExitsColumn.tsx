import { memo, useState } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { ChevronDown, Lock } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import type { LeadSummary } from '../../state/leads';
import type { KanbanStage } from '../../hooks/useKanbanStages';
import { formatBRL } from '../../utils/labels';
import { LEAD_STAGE_TONE_CLASSES, type LeadStage } from '../../utils/lead-stage';
import LeadCard from './LeadCard';
import type { DropState } from './StageColumn';

const COLLAPSED_LIMIT = 3;

type ExitSectionProps = {
  stage: KanbanStage;
  leads: LeadSummary[];
  dropState: DropState;
  isLeadDragDisabled?: ((lead: LeadSummary) => boolean) | undefined;
  onOpenLead: (lead: LeadSummary) => void;
  onRequestMove?: ((lead: LeadSummary, stage: LeadStage) => void) | undefined;
};

const ExitSection = ({ stage, leads, dropState, isLeadDragDisabled, onOpenLead, onRequestMove }: ExitSectionProps) => {
  const [expanded, setExpanded] = useState(false);
  const headingId = `crm-stage-${stage.id}`;
  const total = leads.reduce((sum, lead) => sum + (lead.potentialValue ?? 0), 0);
  const potentialLabel = formatBRL(total);
  const visible = expanded ? leads : leads.slice(0, COLLAPSED_LIMIT);
  const hidden = leads.length - visible.length;
  const blocked = dropState === 'blocked';
  const tone = LEAD_STAGE_TONE_CLASSES[stage.tone];

  return (
    <section aria-labelledby={headingId} data-stage-column={stage.id} data-drop-state={dropState} className={cn('flex flex-col gap-1.5', blocked && 'opacity-45')}>
      <h3 id={headingId} className="flex items-center gap-1.5 px-1 text-sm font-medium text-foreground" title={stage.description}>
        <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', tone.dot)} />
        {stage.title}
        <span className="tabular-nums text-muted-foreground">{leads.length}</span>
        <span className="sr-only">{leads.length === 1 ? 'lead' : 'leads'}</span>
        {blocked ? (
          <Lock className="ml-auto size-3 text-muted-foreground" aria-label="Não permitido" />
        ) : potentialLabel ? (
          <span className="ml-auto text-xs font-normal tabular-nums text-muted-foreground">{potentialLabel}</span>
        ) : null}
      </h3>
      <Droppable droppableId={stage.id} type="lead" isDropDisabled={blocked}>
        {(provided, snapshot) => (
          <ol
            ref={provided.innerRef}
            {...provided.droppableProps}
            aria-labelledby={headingId}
            className={cn(
              'flex min-h-10 flex-col gap-1.5 rounded-md transition-colors',
              dropState === 'allowed' && 'min-h-14 outline outline-1 -outline-offset-1 outline-dashed outline-border-strong',
              snapshot.isDraggingOver && cn(tone.chip, 'outline-current')
            )}
          >
            {visible.map((lead, index) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                index={index}
                compact
                dragDisabled={isLeadDragDisabled ? isLeadDragDisabled(lead) : true}
                onOpen={onOpenLead}
                onRequestMove={onRequestMove}
              />
            ))}
            {provided.placeholder}
            {leads.length === 0 && !snapshot.isDraggingOver ? (
              <li
                className={cn(
                  'flex list-none items-center rounded-md text-xs text-subtle-foreground',
                  dropState === 'allowed' ? 'h-14 justify-center' : 'h-6 px-1'
                )}
              >
                {dropState === 'allowed' ? `Soltar para marcar como ${stage.title}` : 'Nenhum lead'}
              </li>
            ) : null}
          </ol>
        )}
      </Droppable>
      {hidden > 0 || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="inline-flex w-fit items-center gap-1 rounded-md px-1 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
          {expanded ? 'Mostrar menos' : `Mostrar mais ${hidden}`}
        </button>
      ) : null}
    </section>
  );
};

type ExitsColumnProps = {
  stages: KanbanStage[];
  leadsByStage: Record<string, LeadSummary[]>;
  dropStates: Record<string, DropState>;
  isLeadDragDisabled?: ((lead: LeadSummary) => boolean) | undefined;
  onOpenLead: (lead: LeadSummary) => void;
  onRequestMove?: ((lead: LeadSummary, stage: LeadStage) => void) | undefined;
};

/**
 * Saídas do funil num grupo compacto no fim do quadro: Ganho, Perdido e Reciclar
 * empilhados (cartões enxutos, 3 por saída), para não competir com as etapas em andamento.
 */
const ExitsColumn = memo(({ stages, leadsByStage, dropStates, isLeadDragDisabled, onOpenLead, onRequestMove }: ExitsColumnProps) => {
  const total = stages.reduce((sum, stage) => sum + (leadsByStage[stage.id]?.length ?? 0), 0);
  return (
    <section
      aria-labelledby="crm-stage-exits"
      className="flex w-[248px] shrink-0 flex-col gap-4 rounded-lg border border-dashed border-border-strong/70 p-3 lg:max-h-[calc(100svh-17rem)] lg:overflow-y-auto"
    >
      <h2 id="crm-stage-exits" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        Saídas do funil
        <span className="tabular-nums">· {total}</span>
      </h2>
      {stages.map((stage) => (
        <ExitSection
          key={stage.id}
          stage={stage}
          leads={leadsByStage[stage.id] ?? []}
          dropState={dropStates[stage.id] ?? 'idle'}
          isLeadDragDisabled={isLeadDragDisabled}
          onOpenLead={onOpenLead}
          onRequestMove={onRequestMove}
        />
      ))}
    </section>
  );
});

ExitsColumn.displayName = 'ExitsColumn';

export default ExitsColumn;
