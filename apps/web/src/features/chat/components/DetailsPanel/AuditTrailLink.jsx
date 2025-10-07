import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { ExternalLink } from 'lucide-react';

export const AuditTrailLink = ({ onOpenAudit }) => {
  return (
    <Card className="border-0 bg-slate-950/25 text-slate-100 shadow-[0_24px_45px_-32px_rgba(15,23,42,0.9)] ring-1 ring-white/5 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-sm">Compliance & Auditoria</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-xs text-slate-300">
        <p className="text-slate-400">Acesse relatórios, trilha de auditoria (CMN 4.935) e exportações para QA.</p>
        <Button
          size="sm"
          className="justify-start gap-2 rounded-full bg-slate-900/40 text-slate-100 ring-1 ring-white/5 hover:bg-slate-900/30"
          onClick={onOpenAudit}
        >
          <ExternalLink className="h-4 w-4" /> Abrir auditoria completa
        </Button>
      </CardContent>
    </Card>
  );
};

export default AuditTrailLink;
