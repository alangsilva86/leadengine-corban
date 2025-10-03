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
    <Card className="border-slate-800/60 bg-slate-950/80 text-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarClock className="h-4 w-4 text-sky-300" /> Tasks & Follow-ups
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-xs">
        {tasks.length === 0 ? (
          <p className="text-slate-500">Nenhum follow-up agendado.</p>
        ) : (
          tasks.map((task, index) => (
            <div key={task.id ?? index} className="flex flex-col gap-1 rounded-lg border border-slate-800/60 bg-slate-900/70 p-2">
              <div className="flex justify-between text-[11px] text-slate-400">
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
              <p className="text-slate-200">{task.description ?? task.notes ?? 'Sem descrição'}</p>
            </div>
          ))
        )}
        <Button size="sm" variant="outline" onClick={onReopenWindow}>
          Reabrir janela com CTA
        </Button>
      </CardContent>
    </Card>
  );
};

export default TasksSection;
