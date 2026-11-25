import { useState } from 'react';
import { ErrorState } from '@/components/page';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import LeadTimeline from '../components/lead-drawer/LeadTimeline';
import useCrmTimeline from '../hooks/useCrmTimeline';
import { useCrmViewState } from '../state/view-context';
import { TIMELINE_EVENT_TYPES, formatCount } from '../utils/labels';

/** Atividades recentes dos leads filtrados, com filtro por tipo (rótulos e ícones, sem JSON). */
const LeadTimelineView = () => {
  const { filters } = useCrmViewState();
  const [activeTypes, setActiveTypes] = useState<string[]>([]);

  const { events, isLoading, error, refetch } = useCrmTimeline(filters, {
    eventTypes: activeTypes.length > 0 ? activeTypes : undefined,
    limit: 100,
  });

  const toggleType = (typeId: string) =>
    setActiveTypes((current) => (current.includes(typeId) ? current.filter((item) => item !== typeId) : [...current, typeId]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por tipo de atividade">
        {TIMELINE_EVENT_TYPES.map((type) => {
          const active = activeTypes.includes(type.id);
          const Icon = type.icon;
          return (
            <Button
              key={type.id}
              type="button"
              size="xs"
              variant={active ? 'soft' : 'outline'}
              aria-pressed={active}
              onClick={() => toggleType(type.id)}
              className="rounded-full px-2.5"
            >
              <Icon aria-hidden="true" />
              {type.label}
            </Button>
          );
        })}
        {activeTypes.length > 0 ? (
          <Button type="button" size="xs" variant="link" className="text-muted-foreground" onClick={() => setActiveTypes([])}>
            Limpar
          </Button>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {isLoading ? '' : `${formatCount(events.length)} atividade${events.length === 1 ? '' : 's'}`}
        </span>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        {error ? (
          <ErrorState size="compact" title="Não foi possível carregar as atividades" error={error} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : (
          <LeadTimeline
            events={events}
            emptyTitle={activeTypes.length ? 'Nenhuma atividade desse tipo' : 'Nenhuma atividade registrada'}
          />
        )}
      </div>
    </div>
  );
};

export default LeadTimelineView;
