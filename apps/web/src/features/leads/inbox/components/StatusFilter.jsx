import { cn } from '@/lib/utils.js';

const STATUS_ORDER = ['all', 'contacted', 'won', 'lost'];

const STATUS_LABEL = {
  all: 'Todos',
  contacted: 'Em conversa',
  won: 'Venda realizada',
  lost: 'Sem interesse',
};

export const StatusFilter = ({ value, onChange }) => (
  <div className="inline-flex items-center gap-1 rounded-full bg-[rgba(148,163,184,0.12)] p-1 text-xs text-muted-foreground">
    {STATUS_ORDER.map((status) => (
      <button
        key={status}
        type="button"
        onClick={() => onChange(status)}
        className={cn(
          'filter-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          value === status && 'filter-pill--active focus-visible:ring-primary'
        )}
        aria-pressed={value === status}
      >
        {STATUS_LABEL[status]}
      </button>
    ))}
  </div>
);

export default StatusFilter;
