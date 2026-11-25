import { useMemo, useState } from 'react';
import { addDays, addWeeks, endOfWeek, format, isSameDay, isToday, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarCheck2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { EmptyState, ErrorState } from '@/components/page';
import { cn } from '@/lib/utils.js';
import useCrmTasks from '../hooks/useCrmTasks';
import { useCrmViewContext, useCrmViewState } from '../state/view-context';
import emitCrmTelemetry from '../utils/telemetry';
import type { LeadTask } from '../state/leads';

const WEEK_OPTIONS = { weekStartsOn: 1 as const, locale: ptBR };

const weekOf = (date: Date) => ({ from: startOfWeek(date, WEEK_OPTIONS), to: endOfWeek(date, WEEK_OPTIONS) });

const TASK_STATUS = {
  completed: { label: 'Concluída', variant: 'success' },
  overdue: { label: 'Atrasada', variant: 'destructive' },
  pending: { label: 'Pendente', variant: 'secondary' },
} as const;

/**
 * Agenda: tarefas com prazo dos leads filtrados, por semana (segunda a domingo).
 * O calendário escolhe o dia; a faixa mostra a semana; a lista mostra as tarefas do dia.
 */
const LeadCalendarView = () => {
  const { filters } = useCrmViewState();
  const { openLeadDrawer } = useCrmViewContext();
  const [focusDay, setFocusDay] = useState(() => new Date());
  const range = useMemo(() => weekOf(focusDay), [focusDay]);

  const { tasks, isLoading, error, refetch } = useCrmTasks(filters, range);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, LeadTask[]>();
    tasks.forEach((task) => {
      const key = format(new Date(task.dueDate), 'yyyy-MM-dd');
      map.set(key, [...(map.get(key) ?? []), task]);
    });
    return map;
  }, [tasks]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(range.from, index)), [range.from]);
  const daysWithTasks = useMemo(() => weekDays.filter((day) => tasksByDay.has(format(day, 'yyyy-MM-dd'))), [weekDays, tasksByDay]);
  const focusedTasks = [...(tasksByDay.get(format(focusDay, 'yyyy-MM-dd')) ?? [])].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  const goToWeek = (offset: number) => setFocusDay((current) => addWeeks(current, offset));

  return (
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
      <div className="hidden rounded-lg border border-border bg-surface lg:block">
        <Calendar
          mode="single"
          selected={focusDay}
          onSelect={(value: Date | undefined) => value && setFocusDay(value)}
          month={focusDay}
          onMonthChange={(month: Date) => setFocusDay(month)}
          modifiers={{ hasTasks: daysWithTasks }}
          modifiersClassNames={{
            hasTasks:
              'after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary',
          }}
        />
        <div className="border-t border-border p-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              setFocusDay(new Date());
              emitCrmTelemetry('crm.metrics.refresh', { source: 'calendar' });
            }}
          >
            Hoje
          </Button>
        </div>
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-foreground">
            Semana de {format(range.from, "d 'de' MMM", { locale: ptBR })} a {format(range.to, "d 'de' MMM", { locale: ptBR })}
          </h2>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Semana anterior" onClick={() => goToWeek(-1)}>
              <ChevronLeft />
            </Button>
            <Button type="button" variant="outline" size="sm" className="lg:hidden" onClick={() => setFocusDay(new Date())}>
              Hoje
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Próxima semana" onClick={() => goToWeek(1)}>
              <ChevronRight />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1" role="group" aria-label="Dias da semana">
          {weekDays.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayTasks = tasksByDay.get(key) ?? [];
            const hasOverdue = dayTasks.some((task) => task.status === 'overdue');
            const selected = isSameDay(day, focusDay);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                aria-label={`${format(day, "EEEE, d 'de' MMMM", { locale: ptBR })}: ${dayTasks.length} tarefa(s)`}
                onClick={() => setFocusDay(day)}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-md border px-1 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border bg-surface hover:bg-surface-hover'
                )}
              >
                <span className="text-2xs uppercase text-muted-foreground">{format(day, 'EEEEEE', { locale: ptBR })}</span>
                <span className={cn('text-base font-medium tabular-nums', isToday(day) && !selected && 'text-primary')}>
                  {format(day, 'd')}
                </span>
                <span
                  className={cn(
                    'min-h-4 text-2xs tabular-nums',
                    hasOverdue ? 'font-medium text-danger-soft-foreground' : 'text-muted-foreground'
                  )}
                >
                  {isLoading ? '' : dayTasks.length > 0 ? `${dayTasks.length} tarefa${dayTasks.length > 1 ? 's' : ''}` : '—'}
                </span>
              </button>
            );
          })}
        </div>

        <section className="rounded-lg border border-border bg-surface" aria-labelledby="crm-agenda-day">
          <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h3 id="crm-agenda-day" className="text-sm font-medium text-foreground first-letter:uppercase">
              {format(focusDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              {focusedTasks.length === 1 ? '1 tarefa' : `${focusedTasks.length} tarefas`}
            </span>
          </header>
          {error ? (
            <ErrorState size="compact" title="Não foi possível carregar a agenda" error={error} onRetry={() => void refetch()} />
          ) : isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : focusedTasks.length === 0 ? (
            <EmptyState
              size="compact"
              icon={CalendarCheck2}
              title="Nenhuma tarefa neste dia"
              description="Tarefas com prazo dos leads filtrados aparecem aqui."
            />
          ) : (
            <ul className="divide-y divide-border">
              {focusedTasks.map((task) => {
                const status = TASK_STATUS[task.status] ?? TASK_STATUS.pending;
                return (
                  <li key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-12 shrink-0 text-sm font-medium tabular-nums text-foreground">
                      {format(new Date(task.dueDate), 'HH:mm')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{task.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {task.leadName ?? 'Lead sem nome'}
                        {task.ownerName ? ` · ${task.ownerName}` : ''}
                      </p>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                    {task.leadId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (!task.leadId) return;
                          openLeadDrawer(task.leadId);
                          emitCrmTelemetry('crm.lead.open', { source: 'calendar', leadId: task.leadId, taskId: task.id });
                        }}
                      >
                        Ver lead
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default LeadCalendarView;
