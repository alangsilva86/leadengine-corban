import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils.js';

import '../styles/tokens.css';

const statusVariant = {
  allocated: 'info',
  contacted: 'secondary',
  won: 'success',
  lost: 'destructive',
};

const statusLabel = {
  allocated: 'Aguardando contato',
  contacted: 'Em conversa',
  won: 'Venda realizada',
  lost: 'Sem interesse',
};

const formatCurrency = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

export const LeadAllocationCard = ({ allocation, onUpdateStatus, onOpenWhatsApp }) => (
  <div
    className={cn(
      'inbox-glass-surface flex flex-col gap-3 rounded-[var(--radius)] p-4 transition hover:shadow-lg md:flex-row md:items-center md:justify-between'
    )}
  >
    <div>
      <div className="flex items-center gap-3">
        <h3 className="text-base font-semibold text-foreground">{allocation.fullName}</h3>
        <Badge variant={statusVariant[allocation.status] || 'info'}>{statusLabel[allocation.status]}</Badge>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        CPF {allocation.document || '—'} • Registro {allocation.registrations?.join(', ') || '—'} • Score {allocation.score ?? '—'}
      </div>
      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
        <div>
          Margem bruta: <span className="font-medium text-foreground">{formatCurrency(allocation.margin)}</span>
        </div>
        <div>
          Margem disponível: <span className="font-medium text-foreground">{formatCurrency(allocation.netMargin)}</span>
        </div>
      </div>
    </div>
    <div className="flex flex-wrap gap-2 text-sm">
      {allocation.phone ? (
        <Button variant="outline" size="sm" onClick={() => onOpenWhatsApp(allocation)}>
          Abrir conversa
        </Button>
      ) : null}
      {allocation.status !== 'contacted' && allocation.status !== 'won' ? (
        <Button variant="outline" size="sm" onClick={() => onUpdateStatus(allocation.allocationId, 'contacted')}>
          Marcar como em conversa
        </Button>
      ) : null}
      {allocation.status !== 'won' ? (
        <Button variant="default" size="sm" onClick={() => onUpdateStatus(allocation.allocationId, 'won')}>
          Ganhei a venda
        </Button>
      ) : null}
      {allocation.status !== 'lost' ? (
        <Button variant="destructive" size="sm" onClick={() => onUpdateStatus(allocation.allocationId, 'lost')}>
          Cliente sem interesse
        </Button>
      ) : null}
    </div>
  </div>
);

export default LeadAllocationCard;
