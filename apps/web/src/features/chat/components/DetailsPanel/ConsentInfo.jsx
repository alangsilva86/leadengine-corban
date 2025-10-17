import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';

export const ConsentInfo = ({ consent }) => {
  if (!consent) {
    return null;
  }
  const grantedAt = consent.grantedAt ? new Date(consent.grantedAt).toLocaleString('pt-BR') : null;
  return (
    <Card className="border-0 bg-surface-overlay-quiet text-foreground shadow-[0_24px_45px_-32px_rgba(15,23,42,0.9)] ring-1 ring-surface-overlay-glass-border backdrop-blur">
      <CardHeader>
        <CardTitle className="text-sm">Consentimento</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-foreground-muted">
        <p>
          Status: <span className="text-success">{consent.granted ? 'Ativo' : 'Revogado'}</span>
        </p>
        <p>Base legal: {consent.base ?? '—'}</p>
        <p>Concedido em: {grantedAt ?? '—'}</p>
      </CardContent>
    </Card>
  );
};

export default ConsentInfo;
