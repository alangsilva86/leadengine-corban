import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import StatusBadge from '../Shared/StatusBadge.jsx';

export const LeadSummaryCard = ({ lead }) => {
  if (!lead) {
    return (
      <Card className="border-slate-800/60 bg-slate-950/80 text-slate-400">
        <CardHeader>
          <CardTitle className="text-sm text-slate-200">Resumo do lead</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-slate-500">Nenhum lead associado a este ticket.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-800/60 bg-slate-950/80 text-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          Resumo do lead
          <StatusBadge status={lead.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-xs">
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
