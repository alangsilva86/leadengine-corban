import { cn } from '@/lib/utils.js';

const toneMap = {
  healthy: {
    label: 'Saudável',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  },
  warning: {
    label: 'Atenção',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  },
  critical: {
    label: 'Crítico',
    className: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
  },
  default: {
    label: 'Indefinido',
    className: 'bg-muted text-muted-foreground',
  },
};

type LeadHealthBadgeProps = {
  status: 'healthy' | 'warning' | 'critical' | undefined | null;
};

const LeadHealthBadge = ({ status }: LeadHealthBadgeProps) => {
  const tone = status ? toneMap[status] ?? toneMap.default : toneMap.default;
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', tone.className)}
      aria-label={`Saúde do lead: ${tone.label}`}
    >
      {tone.label}
    </span>
  );
};

export default LeadHealthBadge;
