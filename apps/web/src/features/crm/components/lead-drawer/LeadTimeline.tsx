import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils.js';
import type { LeadTimelineEvent } from '../../state/leads';

type LeadTimelineProps = {
  events: LeadTimelineEvent[];
};

const iconMap: Record<LeadTimelineEvent['type'], string> = {
  note: '📝',
  call: '📞',
  meeting: '📅',
  task: '✅',
  status_change: '🔄',
  message: '💬',
};

const LeadTimeline = ({ events }: LeadTimelineProps) => {
  if (!events.length) {
    return <p className="text-sm text-muted-foreground">Nenhum evento registrado para este lead.</p>;
  }

  return (
    <ol className="space-y-3">
      {events.map((event) => {
        const icon = iconMap[event.type] ?? '•';
        let timestamp = '';
        try {
          timestamp = format(new Date(event.timestamp), "dd 'de' MMM 'às' HH:mm", { locale: ptBR });
        } catch {
          timestamp = event.timestamp;
        }

        return (
          <li key={event.id} className="rounded-lg border border-border/50 bg-background/60 p-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-base" aria-hidden>{icon}</span>
              <span>{timestamp}</span>
              {event.author ? <span className="text-muted-foreground/80">• {event.author}</span> : null}
            </div>
            <h4 className="mt-2 text-sm font-semibold text-foreground">{event.title}</h4>
            {event.description ? <p className="text-sm text-muted-foreground">{event.description}</p> : null}
          </li>
        );
      })}
    </ol>
  );
};

export default LeadTimeline;
