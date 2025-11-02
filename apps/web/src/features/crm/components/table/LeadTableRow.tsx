import { memo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils.js';
import type { LeadSummary } from '../../state/leads.ts';

const formatActivity = (value: string | null) => {
  if (!value) {
    return 'Sem atividade';
  }
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true, locale: ptBR });
  } catch {
    return 'Atividade desconhecida';
  }
};

const formatValue = (value: number | null | undefined) => {
  if (!value) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
};

type LeadTableRowProps = {
  lead: LeadSummary;
  selected: boolean;
  onToggleSelect: (leadId: string) => void;
  onOpenDrawer: (leadId: string) => void;
  selectable?: boolean;
};

const LeadTableRow = memo(({ lead, selected, onToggleSelect, onOpenDrawer, selectable = true }: LeadTableRowProps) => {
  return (
    <div
      className={cn(
        'grid grid-cols-[32px,minmax(0,1.4fr),minmax(0,1fr),minmax(0,0.9fr),minmax(0,1fr),minmax(0,140px)] items-center gap-3 border-b border-border/50 bg-background px-4 py-3 text-sm transition hover:bg-muted/30',
        selected && 'bg-primary/5'
      )}
      role="row"
    >
      <div className="flex items-center justify-center" role="gridcell">
        <Checkbox
          checked={selected}
          disabled={!selectable}
          onCheckedChange={() => selectable && onToggleSelect(lead.id)}
          aria-label={`Selecionar lead ${lead.name}`}
        />
      </div>
      <button
        type="button"
        className="flex min-w-0 flex-col items-start gap-1 text-left"
        onClick={() => onOpenDrawer(lead.id)}
      >
        <span className="truncate text-sm font-medium text-foreground">{lead.name}</span>
        <span className="truncate text-xs text-muted-foreground">{lead.ownerName ?? 'Sem responsável definido'}</span>
      </button>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" role="gridcell">
        <Badge variant="outline" className="text-[0.65rem] uppercase tracking-wide">
          {lead.stage ?? 'Sem etapa'}
        </Badge>
        <span>{lead.source ?? 'Origem desconhecida'}</span>
      </div>
      <div className="text-xs text-muted-foreground" role="gridcell">
        {lead.channel ?? 'Canal indeterminado'}
      </div>
      <div className="text-xs text-muted-foreground" role="gridcell">
        {formatActivity(lead.lastActivityAt)}
      </div>
      <div className="flex items-center justify-end gap-2" role="gridcell">
        <span className="text-sm font-medium text-foreground">{formatValue(lead.potentialValue ?? null)}</span>
        <Button type="button" size="sm" variant="outline" onClick={() => onOpenDrawer(lead.id)}>
          Abrir
        </Button>
      </div>
    </div>
  );
});

LeadTableRow.displayName = 'LeadTableRow';

export default LeadTableRow;
