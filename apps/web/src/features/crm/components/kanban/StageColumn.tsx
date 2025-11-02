import { memo } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge.jsx';
import { Card } from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils.js';
import type { LeadSummary } from '../../state/leads.ts';
import LeadCard from './LeadCard.tsx';

type StageColumnProps = {
  stageId: string;
  title: string;
  leads: LeadSummary[];
  metrics?: { totalPotential?: number; stalledCount?: number } | null;
};

const StageColumn = memo(({ stageId, title, leads, metrics }: StageColumnProps) => {
  const potentialLabel = metrics?.totalPotential
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.totalPotential)
    : null;
  const stalledCount = metrics?.stalledCount ?? 0;

  return (
    <Droppable droppableId={stageId} type="lead">
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            'flex h-full min-w-[280px] flex-1 flex-col gap-3 rounded-2xl border border-border/50 bg-muted/20 p-4 transition-all data-[active=true]:border-primary/60 data-[active=true]:bg-primary/5',
            snapshot.isDraggingOver && 'border-primary/60 bg-primary/10'
          )}
          data-active={snapshot.isDraggingOver ? 'true' : 'false'}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
              <p className="text-xs text-muted-foreground/80">{leads.length} lead(s)</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {potentialLabel ? <Badge variant="secondary">{potentialLabel}</Badge> : null}
              {stalledCount > 0 ? (
                <Badge variant="destructive" className="text-[0.65rem]">
                  {stalledCount} parado(s)
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3">
            {leads.map((lead, index) => (
              <LeadCard key={lead.id} lead={lead} index={index} />
            ))}
            {provided.placeholder}
            {leads.length === 0 ? (
              <Card className="flex flex-1 items-center justify-center border border-dashed border-border/60 bg-background/60 p-4 text-xs text-muted-foreground">
                Nenhum lead nesta etapa.
              </Card>
            ) : null}
          </div>
        </div>
      )}
    </Droppable>
  );
});

StageColumn.displayName = 'StageColumn';

export default StageColumn;
