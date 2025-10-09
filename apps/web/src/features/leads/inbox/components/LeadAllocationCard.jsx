import { Badge } from '@/components/ui/badge.jsx';
import { GlassPanel } from '@/components/ui/glass-panel.jsx';
import { cn } from '@/lib/utils.js';

const STATUS_META = {
  allocated: { label: 'Aguardando contato', tone: 'neutral' },
  contacted: { label: 'Em conversa', tone: 'info' },
  won: { label: 'Venda realizada', tone: 'success' },
  lost: { label: 'Sem interesse', tone: 'error' },
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
  const statusMeta = STATUS_META[status] ?? STATUS_META.allocated;

  return (
    <GlassPanel
      as="button"
      type="button"
      onClick={() => onSelect?.(allocation)}
      onDoubleClick={() => (allocation && onDoubleOpen ? onDoubleOpen(allocation) : null)}
      data-allocation-id={allocation?.allocationId ?? undefined}
      aria-current={isActive ? 'true' : undefined}
      tone="surface"
      radius="lg"
      shadow="md"
      className={cn(
        'group flex w-full flex-col gap-4 p-5 text-left text-foreground ring-0 ring-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 hover:border-primary/40 hover:bg-primary/15 hover:shadow-[0_26px_54px_rgba(5,12,30,0.55)]',
        isActive
          ? 'border-primary/60 bg-primary/15 shadow-[0_30px_70px_rgba(15,23,42,0.45)] focus-visible:ring-primary'
          : null
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Lead</p>
          <div className="space-y-0.5">
            <h3 className="text-base font-semibold leading-snug text-foreground">
              {allocation.fullName}
            </h3>
            <p className="text-[13px] text-muted-foreground">{formatDocument(allocation.document)}</p>
          </div>
        </div>
        <Badge
          variant="status"
          tone={statusMeta.tone}
          className="px-2.5 py-1 text-xs font-medium uppercase tracking-[0.24em]"
        >
          {statusMeta.label}
        </Badge>
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[13px] text-muted-foreground sm:grid-cols-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Telefone</p>
          <p className="font-medium text-foreground">{allocation.phone ?? '—'}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Score</p>
          <p className="font-medium text-foreground">{allocation.score ?? '—'}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Registros</p>
          <p className="font-medium text-foreground">{resolveRegistrations(allocation.registrations)}</p>
        </div>
      </div>

      <div className="grid gap-3 border-t border-white/10 pt-4 text-[13px] sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Margem bruta</p>
          <p className="text-[15px] font-semibold text-foreground">{formatCurrency(allocation.margin)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Margem disponível</p>
          <p className="text-[15px] font-semibold text-foreground">
            {formatCurrency(allocation.netMargin ?? allocation.margin)}
          </p>
        </div>
      </div>
    </GlassPanel>
  );
};

export default LeadAllocationCard;
