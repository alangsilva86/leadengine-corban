import { History } from 'lucide-react';
import { EmptyState } from '@/components/page';
import type { LeadTimelineEvent } from '../../state/leads';
import {
  formatDateTime,
  formatRelativeShort,
  getTimelineEventIcon,
  getTimelineEventLabel,
} from '../../utils/labels';

type LeadTimelineProps = {
  events: LeadTimelineEvent[];
  emptyTitle?: string;
  emptyDescription?: string;
};

/** Linha do tempo do lead: tipo traduzido, ícone, título e descrição. Nunca exibe metadados crus. */
const LeadTimeline = ({
  events,
  emptyTitle = 'Nenhuma atividade registrada',
  emptyDescription = 'Mensagens, ligações e mudanças de etapa aparecem aqui.',
}: LeadTimelineProps) => {
  if (!events.length) {
    return <EmptyState size="compact" icon={History} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ol className="relative space-y-4 before:absolute before:inset-y-2 before:left-4 before:w-px before:bg-border">
      {events.map((event) => {
        const Icon = getTimelineEventIcon(event.type);
        const typeLabel = getTimelineEventLabel(event.type);
        const description = event.description && event.description !== event.title ? event.description : null;
        return (
          <li key={event.id} className="relative flex gap-3">
            <span className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{typeLabel}</span>
                {event.timestamp ? (
                  <>
                    {' · '}
                    <time dateTime={String(event.timestamp)} title={formatDateTime(event.timestamp) ?? undefined}>
                      {formatRelativeShort(event.timestamp)}
                    </time>
                  </>
                ) : null}
                {event.author ? ` · ${event.author}` : null}
              </p>
              <p className="mt-1 text-sm text-foreground">{event.title}</p>
              {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default LeadTimeline;
