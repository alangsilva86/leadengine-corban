import { useMemo, useState } from 'react';
import { differenceInHours, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import ContactTimeline from '@/features/contacts/components/ContactTimeline.jsx';
import useCrmTimeline from '../hooks/useCrmTimeline';
import { useCrmViewState } from '../state/view-context';
import type { LeadTimelineEvent } from '../state/leads';

const EVENT_TYPES: Array<{ id: string; label: string }> = [
  { id: 'note', label: 'Notas' },
  { id: 'call', label: 'Chamadas' },
  { id: 'meeting', label: 'Reuniões' },
  { id: 'task', label: 'Tarefas' },
  { id: 'status_change', label: 'Status' },
  { id: 'message', label: 'Mensagens' },
];

const INACTIVITY_THRESHOLD_HOURS = 72;

const LeadTimelineView = () => {
  const { filters } = useCrmViewState();
  const [activeTypes, setActiveTypes] = useState<string[]>([]);

  const { events, isLoading } = useCrmTimeline(filters, {
    eventTypes: activeTypes.length > 0 ? activeTypes : undefined,
    limit: 100,
  });

  const { items, inactivityGaps } = useMemo(() => augmentTimeline(events), [events]);

  const handleToggleType = (typeId: string) => {
    setActiveTypes((current) => {
      if (current.includes(typeId)) {
        return current.filter((item) => item !== typeId);
      }
      return [...current, typeId];
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="border border-border/60 bg-background/80 p-4">
        <header className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-foreground">Linha do tempo consolidada</h2>
          <Badge variant="secondary">{events.length} evento(s)</Badge>
          <Badge variant={inactivityGaps > 0 ? 'destructive' : 'outline'}>{inactivityGaps} lacunas &gt; 72h</Badge>
        </header>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {EVENT_TYPES.map((type) => {
            const active = activeTypes.includes(type.id);
            return (
              <Button
                key={type.id}
                type="button"
                size="sm"
                variant={active ? 'default' : 'outline'}
                onClick={() => handleToggleType(type.id)}
              >
                {type.label}
              </Button>
            );
          })}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setActiveTypes([])}
            disabled={activeTypes.length === 0}
          >
            Limpar filtros
          </Button>
        </div>
      </Card>

      <ContactTimeline items={items} />

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando eventos…</p> : null}
    </div>
  );
};

const augmentTimeline = (events: LeadTimelineEvent[]) => {
  if (!events.length) {
    return { items: [], inactivityGaps: 0 };
  }

  const sorted = [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const mapped = [] as Array<{ id: string; type: string; createdAt: string; description: string; metadata?: Record<string, unknown> | null }>;
  let inactivityGaps = 0;

  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    const prev = sorted[index + 1];

    mapped.push({
      id: current.id,
      type: current.type ?? 'evento',
      createdAt: current.timestamp,
      description: current.description ?? current.title ?? 'Evento registrado.',
      metadata: current.metadata,
    });

    if (prev) {
      const currentDate = safeParse(current.timestamp);
      const prevDate = safeParse(prev.timestamp);
      if (currentDate && prevDate) {
        const diffHours = Math.abs(differenceInHours(currentDate, prevDate));
        if (diffHours >= INACTIVITY_THRESHOLD_HOURS) {
          inactivityGaps += 1;
          mapped.push({
            id: `gap-${current.id}-${prev.id}`,
            type: 'lacuna',
            createdAt: prev.timestamp,
            description: `Período de ${diffHours}h sem atividade registrada. Avalie reengajar o lead.`,
          });
        }
      }
    }
  }

  return { items: mapped, inactivityGaps };
};

const safeParse = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    return typeof value === 'string' ? parseISO(value) : new Date(value);
  } catch {
    return null;
  }
};

export default LeadTimelineView;
