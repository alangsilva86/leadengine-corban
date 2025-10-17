import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { CalendarClock } from 'lucide-react';

const normalizeTasks = (ticket) => {
  const metadataTasks = ticket?.metadata?.tasks;
  if (Array.isArray(metadataTasks)) {
    return metadataTasks;
  }
  return [];
};

export const TasksSection = ({ ticket, onReopenWindow }) => {
  const tasks = normalizeTasks(ticket);

  return (
    <Card className="border-0 bg-surface-overlay-quiet text-foreground shadow-[0_24px_45px_-32px_rgba(15,23,42,0.9)] ring-1 ring-surface-overlay-glass-border backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarClock className="h-4 w-4 text-accent" /> Tasks & Follow-ups
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-xs text-foreground-muted">
        {tasks.length === 0 ? (
          <p className="text-foreground-muted">Nenhum follow-up agendado.</p>
        ) : (
          tasks.map((task, index) => (
            <div
              key={task.id ?? index}
              className="flex flex-col gap-1 rounded-2xl bg-surface-overlay-quiet p-3 ring-1 ring-surface-overlay-glass-border"
            >
              <div className="flex justify-between text-xs text-foreground-muted">
                <span>{task.type ?? 'Follow-up'}</span>
                <span>
                  {task.dueAt
                    ? new Date(task.dueAt).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Sem prazo'}
                </span>
              </div>
              <p className="text-foreground">{task.description ?? task.notes ?? 'Sem descrição'}</p>
            </div>
          ))
        )}
        <Button
          size="sm"
          className="w-full rounded-full bg-surface-overlay-quiet text-foreground ring-1 ring-surface-overlay-glass-border hover:bg-surface-overlay-strong"
          onClick={onReopenWindow}
        >
          Reabrir janela com CTA
        </Button>
      </CardContent>
    </Card>
  );
};

export default TasksSection;
