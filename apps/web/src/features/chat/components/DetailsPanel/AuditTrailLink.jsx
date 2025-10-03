import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { ExternalLink } from 'lucide-react';

export const AuditTrailLink = ({ onOpenAudit }) => {
  return (
    <Card className="border-slate-800/60 bg-slate-950/80 text-slate-200">
      <CardHeader>
        <CardTitle className="text-sm">Compliance & Auditoria</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-xs">
        <p className="text-slate-400">Acesse relatórios, trilha de auditoria (CMN 4.935) e exportações para QA.</p>
        <Button size="sm" variant="outline" className="justify-start gap-2 text-slate-200" onClick={onOpenAudit}>
          <ExternalLink className="h-4 w-4" /> Abrir auditoria completa
        </Button>
      </CardContent>
    </Card>
  );
};

export default AuditTrailLink;
