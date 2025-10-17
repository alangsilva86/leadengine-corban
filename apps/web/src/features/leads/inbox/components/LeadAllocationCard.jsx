import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils.js';
import { InboxSurface } from './shared/InboxSurface.jsx';
import { formatCurrency, formatDocument } from '../utils/formatters.js';
import { STATUS_META } from '../constants/statusMeta.js';

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
    <InboxSurface
      as="button"
      type="button"
      tone={isActive ? 'strong' : 'quiet'}
      radius="lg"
      padding="md"
      shadow={isActive ? 'lg' : 'md'}
      border
      data-allocation-id={allocation?.allocationId ?? undefined}
      aria-current={isActive ? 'true' : undefined}
      className={cn(
        'group w-full text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-shell)]',
        'hover:border-primary/40 hover:shadow-[var(--shadow-lg)]',
        isActive && 'border-primary/60'
      )}
      onClick={() => onSelect?.(allocation)}
      onDoubleClick={() => (allocation && onDoubleOpen ? onDoubleOpen(allocation) : null)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-inbox-foreground-muted)]">
            Lead
          </p>
          <div className="space-y-0.5">
            <h3 className="text-base font-semibold leading-tight text-[color:var(--color-inbox-foreground)]">
              {allocation.fullName}
            </h3>
            <p className="text-xs text-[color:var(--color-inbox-foreground-muted)]">
              {formatDocument(allocation.document)}
            </p>
          </div>
        </div>
        <Badge
          variant="status"
          tone={statusMeta.tone}
          className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
        >
          {statusMeta.label}
        </Badge>
      </div>

      <div className="grid gap-3 border border-[color:var(--color-inbox-border)] border-opacity-80 bg-[color:var(--surface-overlay-inbox-bold)] px-4 py-3 text-sm text-[color:var(--color-inbox-foreground)] sm:grid-cols-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-inbox-foreground-muted)]">Telefone</p>
          <p className="font-medium">{allocation.phone ?? '—'}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-inbox-foreground-muted)]">Score</p>
          <p className="font-medium">{allocation.score ?? '—'}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-inbox-foreground-muted)]">Registros</p>
          <p className="font-medium">{resolveRegistrations(allocation.registrations)}</p>
        </div>
      </div>

      <div className="grid gap-3 border-t border-[color:var(--color-inbox-border)] pt-3 text-sm sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-inbox-foreground-muted)]">Margem bruta</p>
          <p className="text-[15px] font-semibold text-[color:var(--color-inbox-foreground)]">
            {formatCurrency(allocation.margin)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-inbox-foreground-muted)]">Margem disponível</p>
          <p className="text-[15px] font-semibold text-[color:var(--color-inbox-foreground)]">
            {formatCurrency(allocation.netMargin ?? allocation.margin)}
          </p>
        </div>
      </div>
    </InboxSurface>
  );
};

export default LeadAllocationCard;
