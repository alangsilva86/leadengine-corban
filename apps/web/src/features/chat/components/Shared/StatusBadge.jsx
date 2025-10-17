import { Badge } from '@/components/ui/badge.jsx';

const STATUS_STYLES = {
  OPEN: 'bg-accent text-accent-foreground border-accent',
  PENDING: 'bg-warning-soft text-warning-strong border-warning-soft-border',
  ASSIGNED: 'bg-success-soft text-success-strong border-success-soft-border',
  RESOLVED: 'bg-success-soft text-success-strong border-success-soft-border',
  CLOSED: 'bg-surface-overlay-quiet text-foreground-muted border-border',
};

const toLabel = (status) => {
  if (!status) return '—';
  const normalized = String(status).toUpperCase();
  switch (normalized) {
    case 'OPEN':
      return 'Aberto';
    case 'PENDING':
      return 'Pendente';
    case 'ASSIGNED':
      return 'Em atendimento';
    case 'RESOLVED':
      return 'Resolvido';
    case 'CLOSED':
      return 'Fechado';
    default:
      return normalized;
  }
};

export const StatusBadge = ({ status }) => {
  const normalized = status ? String(status).toUpperCase() : 'OPEN';
  const className = STATUS_STYLES[normalized] ?? 'bg-surface-overlay-quiet text-foreground-muted border-border';
  return (
    <Badge variant="outline" className={`border ${className}`}>
      {toLabel(status)}
    </Badge>
  );
};

export default StatusBadge;
