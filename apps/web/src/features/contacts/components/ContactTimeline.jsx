import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';

const formatTimestamp = (value) => {
  if (!value) {
    return 'há instantes';
  }

  try {
    const date = typeof value === 'string' ? parseISO(value) : new Date(value);
    return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
  } catch {
    return 'há instantes';
  }
};

const ContactTimeline = ({ items = [] }) => (
  <Card className="h-full">
    <CardHeader>
      <CardTitle>Timeline</CardTitle>
    </CardHeader>
    <CardContent className="h-full min-h-[300px]">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma interação registrada para este contato.</p>
      ) : (
        <ScrollArea className="h-[360px] pr-4">
          <ol className="space-y-4 text-sm">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border border-border/70 p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium uppercase tracking-wide">{item.type ?? 'interação'}</span>
                  <span>{formatTimestamp(item.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-foreground">
                  {item.description ?? item.message ?? 'Evento registrado na linha do tempo.'}
                </p>
                {item.metadata ? (
                  <pre className="mt-3 overflow-x-auto rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                    {JSON.stringify(item.metadata, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ol>
        </ScrollArea>
      )}
    </CardContent>
  </Card>
);

export default ContactTimeline;
