import { ClipboardList } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';

const HistoryCard = ({ history }) => (
  <Card>
    <CardHeader>
      <CardTitle>Histórico de alterações</CardTitle>
      <CardDescription>Auditoria com responsável, o que mudou e quando.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      {history.length === 0 ? (
        <div className="rounded-md border border-border px-4 py-3 text-sm text-muted-foreground">
          Assim que taxas ou janelas forem atualizadas elas aparecem aqui.
        </div>
      ) : (
        history
          .slice()
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 rounded-md border border-border/60 bg-muted/40 p-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <ClipboardList className="h-4 w-4" />
              </div>
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug">{entry.message}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.author} · {entry.createdAt.toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          ))
      )}
    </CardContent>
  </Card>
);

export default HistoryCard;
