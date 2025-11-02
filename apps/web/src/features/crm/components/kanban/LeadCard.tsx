import { memo } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Activity, Clock3, MessageSquare, User } from 'lucide-react';
import { Card } from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils.js';
import type { LeadSummary } from '../../state/leads.ts';
import { useCrmViewContext } from '../../state/view-context.tsx';
import emitCrmTelemetry from '../../utils/telemetry.ts';

type LeadCardProps = {
  lead: LeadSummary;
  index: number;
};

const formatPotential = (value: number | null | undefined) => {
  if (!value) return null;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
};

const formatRelative = (value: string | null | undefined) => {
  if (!value) return 'Sem atividade recente';
  try {
    const diff = Date.now() - new Date(value).getTime();
    const hours = Math.max(1, Math.floor(diff / (1000 * 60 * 60)));
    return `${hours}h atrás`;
  } catch {
    return 'Atividade desconhecida';
  }
};

const LeadCard = memo(({ lead, index }: LeadCardProps) => {
  const { state, openLeadDrawer, selectIds, clearSelection } = useCrmViewContext();
  const selected = state.selection.selectedIds.has(lead.id);

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={(event) => {
            event.stopPropagation();
            clearSelection();
            selectIds([lead.id]);
            openLeadDrawer(lead.id);
            emitCrmTelemetry('crm.lead.open', { source: 'kanban', leadId: lead.id, stageId: lead.stage });
          }}
          className={cn(
            'cursor-grab rounded-xl border border-border/40 bg-background/80 p-3 text-sm transition-shadow hover:shadow-md',
            selected && 'border-primary shadow-lg',
            snapshot.isDragging && 'border-primary shadow-lg'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-medium text-foreground">{lead.name}</h4>
              <p className="text-xs text-muted-foreground">{lead.ownerName ?? 'Sem responsável'}</p>
            </div>
            <span className="text-xs text-muted-foreground">{formatPotential(lead.potentialValue)}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              {formatRelative(lead.lastActivityAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {lead.channel ?? 'Canal indeterminado'}
            </span>
            <span className="inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {lead.source ?? 'Origem desconhecida'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Activity className="h-3.5 w-3.5" />
              {lead.status}
            </span>
          </div>
        </Card>
      )}
    </Draggable>
  );
});

LeadCard.displayName = 'LeadCard';

export default LeadCard;
