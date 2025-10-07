import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils.js';

const STATUS_LABEL = {
  allocated: 'Aguardando contato',
  contacted: 'Em conversa',
  won: 'Venda realizada',
  lost: 'Sem interesse',
};

const STATUS_TONE = {
  allocated: 'border-white/20 bg-white/[0.08] text-white/80',
  contacted: 'border-sky-400/40 bg-sky-500/20 text-sky-100',
  won: 'border-emerald-400/45 bg-emerald-400/20 text-emerald-100',
  lost: 'border-rose-500/50 bg-rose-500/18 text-rose-100',
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
        'group flex w-full flex-col gap-4 rounded-[24px] border border-white/12 bg-[#101d33] p-5 text-left shadow-[0_18px_44px_rgba(3,9,24,0.45)] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070f1f] hover:border-white/20 hover:shadow-[0_26px_54px_rgba(5,12,30,0.55)]',
        isActive
          ? 'border-sky-400/60 bg-sky-500/20 shadow-[0_30px_70px_rgba(14,116,144,0.35)] focus-visible:ring-sky-300'
          : 'hover:bg-[#13223d]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/65">Lead</p>
          <div className="space-y-0.5">
            <h3 className="text-base font-semibold leading-snug text-white/95 group-hover:text-white">
              {allocation.fullName}
            </h3>
            <p className="text-[13px] text-white/75">{formatDocument(allocation.document)}</p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-white/80 transition-colors',
            statusTone
          )}
        >
          {statusLabel}
        </Badge>
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[13px] text-white/80 sm:grid-cols-3">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/60">Telefone</p>
          <p className="font-medium text-white/90">{allocation.phone ?? '—'}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/60">Score</p>
          <p className="font-medium text-white/90">{allocation.score ?? '—'}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/60">Registros</p>
          <p className="font-medium text-white/90">{resolveRegistrations(allocation.registrations)}</p>
        </div>
      </div>

      <div className="grid gap-3 border-t border-white/10 pt-4 text-[13px] sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/60">Margem bruta</p>
          <p className="text-[15px] font-semibold text-white/92">{formatCurrency(allocation.margin)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/60">Margem disponível</p>
          <p className="text-[15px] font-semibold text-white/92">
            {formatCurrency(allocation.netMargin ?? allocation.margin)}
          </p>
        </div>
      </div>
    </button>
  );
};

export default LeadAllocationCard;
