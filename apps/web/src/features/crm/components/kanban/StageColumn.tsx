import { memo } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import type { LeadSummary } from '../../state/leads';
import type { KanbanStage } from '../../hooks/useKanbanStages';
import { formatBRL } from '../../utils/labels';
import { LEAD_STAGE_TONE_CLASSES, type LeadStage } from '../../utils/lead-stage';
import LeadCard from './LeadCard';

/** Estado da coluna durante um arraste: aceita, recusa (regra do funil) ou nenhum arraste em curso. */
export type DropState = 'idle' | 'allowed' | 'blocked' | 'source';

type StageColumnProps = {
  stage: KanbanStage;
  leads: LeadSummary[];
  metrics?: { totalPotential?: number; stalledCount?: number } | null | undefined;
  dropState?: DropState | undefined;
  blockedReason?: string | null | undefined;
  isLeadDragDisabled?: ((lead: LeadSummary) => boolean) | undefined;
  onOpenLead: (lead: LeadSummary) => void;
  onRequestMove?: ((lead: LeadSummary, stage: LeadStage) => void) | undefined;
};

const StageColumn = memo(
  ({ stage, leads, metrics, dropState = 'idle', blockedReason, isLeadDragDisabled, onOpenLead, onRequestMove }: StageColumnProps) => {
    const potentialLabel = formatBRL(metrics?.totalPotential ?? null);
    const stalledCount = metrics?.stalledCount ?? 0;
    const headingId = `crm-stage-${stage.id}`;
    const blocked = dropState === 'blocked';

    return (
      <section
        aria-labelledby={headingId}
        data-stage-column={stage.id}
        data-drop-state={dropState}
        className="relative flex w-[264px] shrink-0 flex-col rounded-lg bg-surface-sunken lg:max-h-[calc(100svh-17rem)]"
      >
        <header className={cn('flex flex-col gap-0.5 px-3 pb-2 pt-3 transition-opacity', blocked && 'opacity-40')} title={stage.description}>
          <h2 id={headingId} className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
            <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', LEAD_STAGE_TONE_CLASSES[stage.tone].dot)} />
            <span className="truncate">{stage.title}</span>
            <span className="tabular-nums text-muted-foreground">{leads.length}</span>
            <span className="sr-only">{leads.length === 1 ? 'lead' : 'leads'}</span>
            {potentialLabel ? (
              <span className="ml-auto shrink-0 text-xs font-normal tabular-nums text-muted-foreground">{potentialLabel}</span>
            ) : null}
          </h2>
          {stalledCount > 0 ? (
            <p className="text-xs text-danger-soft-foreground">
              {stalledCount === 1 ? '1 parado há 3+ dias' : `${stalledCount} parados há 3+ dias`}
            </p>
          ) : null}
        </header>

        <Droppable droppableId={stage.id} type="lead" isDropDisabled={blocked}>
          {(provided, snapshot) => (
            <ol
              ref={provided.innerRef}
              {...provided.droppableProps}
              aria-labelledby={headingId}
              className={cn(
                'mx-1 mb-1 flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto rounded-md px-1 pb-1 transition-[background-color,opacity]',
                blocked && 'opacity-40',
                dropState === 'allowed' && 'outline outline-1 -outline-offset-1 outline-dashed outline-border-strong',
                snapshot.isDraggingOver && 'bg-primary-soft/60 outline-primary'
              )}
            >
              {leads.map((lead, index) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  index={index}
                  dragDisabled={isLeadDragDisabled ? isLeadDragDisabled(lead) : true}
                  onOpen={onOpenLead}
                  onRequestMove={onRequestMove}
                />
              ))}
              {provided.placeholder}
              {leads.length === 0 && !snapshot.isDraggingOver ? (
                <li className="flex h-16 list-none items-center justify-center rounded-md border border-dashed border-border-strong/60 text-xs text-subtle-foreground">
                  {dropState === 'allowed' ? 'Soltar aqui' : 'Nenhum lead'}
                </li>
              ) : null}
            </ol>
          )}
        </Droppable>

        {blocked ? (
          <div className="pointer-events-none absolute inset-x-2 top-12 flex items-center justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-xs">
              <Lock className="size-3" aria-hidden="true" />
              {blockedReason ?? 'Não permitido'}
            </span>
          </div>
        ) : null}
      </section>
    );
  }
);

StageColumn.displayName = 'StageColumn';

export default StageColumn;
