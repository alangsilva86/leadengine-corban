import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils.js';

const STATUS_LABEL = {
  allocated: 'Aguardando contato',
  contacted: 'Em conversa',
  won: 'Venda realizada',
  lost: 'Sem interesse',
};

const STATUS_TONE = {
  allocated: 'border-white/10 bg-white/[0.04] text-muted-foreground/85',
  contacted: 'border-slate-500/35 bg-slate-500/12 text-slate-100/90',
  won: 'border-slate-200/40 bg-slate-200/10 text-slate-100',
  lost: 'border-rose-500/45 bg-rose-500/12 text-rose-100',
};

const formatCurrency = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
};

const formatDocument = (value) => {
  if (!value) return '—';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return value;
};

const resolveRegistrations = (registrations) => {
  if (!Array.isArray(registrations) || registrations.length === 0) {
    return '—';
  }
  return registrations.join(', ');
};

export const LeadAllocationCard = ({ allocation, isActive, onSelect, onDoubleOpen }) => {
  const status = allocation?.status ?? 'allocated';
  const statusLabel = STATUS_LABEL[status] ?? 'Em acompanhamento';
  const statusTone = STATUS_TONE[status] ?? STATUS_TONE.allocated;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(allocation)}
      onDoubleClick={() => (allocation && onDoubleOpen ? onDoubleOpen(allocation) : null)}
      className={cn(
        'group flex w-full flex-col gap-3.5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
        isActive
          ? 'border-sky-500/45 bg-sky-500/10 shadow-[0_18px_48px_rgba(14,116,144,0.24)] focus-visible:ring-sky-400'
          : 'hover:border-sky-500/25 hover:bg-white/[0.05] focus-visible:ring-sky-400/40'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground/65">Lead</p>
          <div className="space-y-0.5">
            <h3 className="text-base font-semibold leading-snug text-foreground group-hover:text-foreground/95">
              {allocation.fullName}
            </h3>
            <p className="text-[13px] text-muted-foreground/75">{formatDocument(allocation.document)}</p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.24em] transition-colors',
            statusTone
          )}
        >
          {statusLabel}
        </Badge>
      </div>

      <div className="grid gap-2.5 text-[13px] text-muted-foreground/80 sm:grid-cols-3">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/60">Telefone</p>
          <p className="font-medium text-foreground/90">{allocation.phone ?? '—'}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/60">Score</p>
          <p className="font-medium text-foreground/90">{allocation.score ?? '—'}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/60">Registros</p>
          <p className="font-medium text-foreground/90">{resolveRegistrations(allocation.registrations)}</p>
        </div>
      </div>

      <div className="grid gap-2.5 border-t border-white/5 pt-3 text-[13px] sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/60">Margem bruta</p>
          <p className="text-[15px] font-semibold text-foreground/90">{formatCurrency(allocation.margin)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/60">Margem disponível</p>
          <p className="text-[15px] font-semibold text-foreground/90">
            {formatCurrency(allocation.netMargin ?? allocation.margin)}
          </p>
        </div>
      </div>
    </button>
  );
};

export default LeadAllocationCard;
