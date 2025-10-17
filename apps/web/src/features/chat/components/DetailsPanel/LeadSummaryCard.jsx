import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import StatusBadge from '../Shared/StatusBadge.jsx';

export const LeadSummaryCard = ({ lead }) => {
  if (!lead) {
    return (
      <Card className="border-0 bg-surface-overlay-quiet text-foreground-muted shadow-[0_24px_45px_-32px_rgba(15,23,42,0.9)] ring-1 ring-surface-overlay-glass-border backdrop-blur">
        <CardHeader>
          <CardTitle className="text-sm text-foreground">Resumo do lead</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-foreground-muted">Nenhum lead associado a este ticket.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 bg-surface-overlay-quiet text-foreground shadow-[0_24px_45px_-32px_rgba(15,23,42,0.9)] ring-1 ring-surface-overlay-glass-border backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          Resumo do lead
          <StatusBadge status={lead.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-xs text-foreground-muted">
        <div className="flex justify-between">
          <span>Valor estimado</span>
          <span>{lead.value ? `R$ ${lead.value}` : '—'}</span>
        </div>
        <div className="flex justify-between">
          <span>Probabilidade</span>
          <span>{lead.probability ? `${lead.probability}%` : '—'}</span>
        </div>
        <div className="flex justify-between">
          <span>Origem</span>
          <span>{lead.source ?? '—'}</span>
        </div>
        <div className="flex justify-between">
          <span>Quality rating</span>
          <span>{lead.qualityRating ?? '—'}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default LeadSummaryCard;
