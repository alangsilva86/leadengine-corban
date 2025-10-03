import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';

export const ConsentInfo = ({ consent }) => {
  if (!consent) {
    return null;
  }
  const grantedAt = consent.grantedAt ? new Date(consent.grantedAt).toLocaleString('pt-BR') : null;
  return (
    <Card className="border-slate-800/60 bg-slate-950/80 text-slate-200">
      <CardHeader>
        <CardTitle className="text-sm">Consentimento</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-slate-300">
        <p>
          Status: <span className="text-emerald-300">{consent.granted ? 'Ativo' : 'Revogado'}</span>
        </p>
        <p>Base legal: {consent.base ?? '—'}</p>
        <p>Concedido em: {grantedAt ?? '—'}</p>
      </CardContent>
    </Card>
  );
};

export default ConsentInfo;
