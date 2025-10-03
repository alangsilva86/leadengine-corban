import { Badge } from '@/components/ui/badge.jsx';

const STATUS_STYLES = {
  OPEN: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  PENDING: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
  ASSIGNED: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  RESOLVED: 'bg-blue-500/15 text-blue-200 border-blue-500/40',
  CLOSED: 'bg-slate-500/20 text-slate-200 border-slate-500/40',
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
  const className = STATUS_STYLES[normalized] ?? 'bg-slate-500/15 text-slate-200 border-slate-500/30';
  return (
    <Badge variant="outline" className={`border ${className}`}>
      {toLabel(status)}
    </Badge>
  );
};

export default StatusBadge;
