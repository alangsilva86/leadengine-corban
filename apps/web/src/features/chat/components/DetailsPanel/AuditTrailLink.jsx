import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { ExternalLink } from 'lucide-react';

export const AuditTrailLink = ({ onOpenAudit }) => {
  return (
    <Card className="border-0 bg-surface-overlay-quiet text-foreground shadow-[0_24px_45px_-32px_rgba(15,23,42,0.9)] ring-1 ring-surface-overlay-glass-border backdrop-blur">
      <CardHeader>
        <CardTitle className="text-sm">Compliance & Auditoria</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-xs text-foreground-muted">
        <p className="text-foreground-muted">Acesse relatórios, trilha de auditoria (CMN 4.935) e exportações para QA.</p>
        <Button
          size="sm"
          className="justify-start gap-2 rounded-full bg-surface-overlay-quiet text-foreground ring-1 ring-surface-overlay-glass-border hover:bg-surface-overlay-strong"
          onClick={onOpenAudit}
        >
          <ExternalLink className="h-4 w-4" /> Abrir auditoria completa
        </Button>
      </CardContent>
    </Card>
  );
};

export default AuditTrailLink;
