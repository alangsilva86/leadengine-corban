import { useMemo, useState } from 'react';
import { addDays, endOfWeek, format, isSameDay, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import useCrmTasks from '../hooks/useCrmTasks';
import { useCrmViewContext, useCrmViewState } from '../state/view-context';
import useCrmPermissions from '../state/permissions';
import emitCrmTelemetry from '../utils/telemetry';
import type { LeadTask } from '../state/leads';

const getDefaultRange = () => {
  const today = new Date();
  return { from: startOfWeek(today, { locale: ptBR }), to: endOfWeek(today, { locale: ptBR }) };
};

const LeadCalendarView = () => {
  const { filters } = useCrmViewState();
  const { openLeadDrawer, selectIds, clearSelection } = useCrmViewContext();
  const permissions = useCrmPermissions();
  const [range, setRange] = useState(getDefaultRange);
  const [focusDay, setFocusDay] = useState(() => range.from);

  const { tasks, isLoading } = useCrmTasks(filters, range);

  const tasksByDate = useMemo(() => {
    const map: Record<string, LeadTask[]> = {};
    tasks.forEach((task) => {
      const dateKey = format(new Date(task.dueDate), 'yyyy-MM-dd');
      if (!map[dateKey]) {
        map[dateKey] = [];
      }
      map[dateKey].push(task);
    });
    return map;
  }, [tasks]);

  const daysInRange = useMemo(() => {
    const days: Date[] = [];
    let current = range.from;
    while (current <= range.to) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }, [range]);

  const focusedTasks = tasks.filter((task) => isSameDay(new Date(task.dueDate), focusDay));

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <Card className="w-full max-w-md border border-border/60 bg-background/90 p-4">
        <Calendar
          mode="range"
          selected={{ from: range.from, to: range.to }}
          onSelect={(value) => {
            if (!value || !value.from || !value.to) {
              return;
            }
            setRange({ from: value.from, to: value.to });
            setFocusDay(value.from);
          }}
          weekStartsOn={1}
          numberOfMonths={1}
          locale={ptBR}
        />
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            Selecionado: {format(range.from, "dd 'de' MMMM", { locale: ptBR })} → {format(range.to, "dd 'de' MMMM", { locale: ptBR })}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const next = getDefaultRange();
              setRange(next);
              setFocusDay(next.from);
              emitCrmTelemetry('crm.metrics.refresh', { source: 'calendar', range: next });
            }}
          >
            Voltar para esta semana
          </Button>
        </div>
      </Card>

      <div className="flex-1 space-y-4">
        <ScrollArea className="max-h-[220px] rounded-xl border border-border/60 bg-background/70 p-4">
          <div className="space-y-3">
            {daysInRange.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayTasks = tasksByDate[key] ?? [];
              return (
                <button
                  key={key}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-background px-4 py-3 text-left text-sm transition hover:border-primary"
                  onClick={() => setFocusDay(day)}
                >
                  <span>
                    <span className="font-medium text-foreground">{format(day, "EEE, dd 'de' MMM", { locale: ptBR })}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{dayTasks.length} tarefa(s)</span>
                  </span>
                  {dayTasks.some((task) => task.status === 'overdue') ? <Badge variant="destructive">Atraso</Badge> : null}
                </button>
              );
            })}
          </div>
        </ScrollArea>

        <Card className="h-[360px] border border-border/60 bg-background/90 p-4">
          <header className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground">{format(focusDay, "dd 'de' MMMM, EEEE", { locale: ptBR })}</h3>
              <p className="text-xs text-muted-foreground">{focusedTasks.length} tarefa(s) planejadas</p>
            </div>
            <Button type="button" size="sm" variant="outline" disabled={!permissions.canManageTasks}>
              Reagendar selecionadas
            </Button>
          </header>

          <div className="mt-4 flex h-full flex-col gap-3 overflow-y-auto">
            {isLoading && focusedTasks.length === 0 ? (
              Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-lg bg-muted/40" />)
            ) : focusedTasks.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Nenhuma tarefa para este dia.
              </div>
            ) : (
              focusedTasks.map((task) => {
                const dueDate = format(new Date(task.dueDate), 'HH:mm');
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-4 py-3 text-sm"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">{task.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {dueDate} • {task.leadName ?? 'Lead sem nome'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={task.status === 'completed' ? 'secondary' : task.status === 'overdue' ? 'destructive' : 'outline'}>
                        {task.status === 'completed' ? 'Concluída' : task.status === 'overdue' ? 'Atrasada' : 'Pendente'}
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!permissions.canManageTasks}
                        onClick={() => {
                          if (!task.leadId || !permissions.canManageTasks) {
                            return;
                          }
                          clearSelection();
                          selectIds([task.leadId]);
                          openLeadDrawer(task.leadId);
                          emitCrmTelemetry('crm.lead.open', {
                            source: 'calendar',
                            leadId: task.leadId,
                            taskId: task.id,
                          });
                        }}
                      >
                        Ver lead
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LeadCalendarView;
