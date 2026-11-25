import { CalendarPlus, CheckCircle2, ListTodo } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/page';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { cn } from '@/lib/utils.js';
import { formatDateTime } from '@/features/crm/utils/labels';
import { formatRelativeShort } from '@/lib/relative-time';

const isCompleted = (task) => task?.status === 'COMPLETED';

/** Tarefas do contato (GET /api/tasks/:contactId/tasks); concluir via PATCH /api/tasks/tasks/:id. */
const ContactTasks = ({ tasks = [], isLoading = false, error = null, onRetry, onCreateTask, onCompleteTask, completingId = null }) => {
  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState size="compact" title="Não foi possível carregar as tarefas" error={error} onRetry={onRetry} />;
  }

  const visible = tasks.filter((task) => task?.status !== 'CANCELLED');
  const pending = visible.filter((task) => !isCompleted(task));
  const done = visible.filter(isCompleted);

  if (visible.length === 0) {
    return (
      <EmptyState
        size="compact"
        icon={ListTodo}
        title="Nenhuma tarefa"
        description="Crie o próximo passo com este contato para não perder o timing da proposta."
        action={
          <Button type="button" size="sm" variant="outline" onClick={onCreateTask}>
            <CalendarPlus aria-hidden="true" />
            Nova tarefa
          </Button>
        }
      />
    );
  }

  const renderTask = (task) => {
    const completed = isCompleted(task);
    const due = task.dueAt ? formatDateTime(task.dueAt) : null;
    const overdue = !completed && task.dueAt && new Date(task.dueAt).getTime() < Date.now();
    return (
      <li key={task.id} className="flex items-start gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
        <Checkbox
          checked={completed}
          disabled={completed || completingId === task.id}
          onCheckedChange={() => onCompleteTask?.(task)}
          aria-label={completed ? `Tarefa concluída: ${task.title}` : `Concluir tarefa: ${task.title}`}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm text-foreground', completed && 'text-muted-foreground line-through')}>{task.title}</p>
          {task.description ? <p className="mt-0.5 text-xs text-muted-foreground">{task.description}</p> : null}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {due ? `Prazo ${due}` : `Criada ${formatRelativeShort(task.createdAt) ?? ''}`.trim()}
          </p>
        </div>
        {overdue ? <Badge variant="destructive">Atrasada</Badge> : null}
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground tabular-nums">
          {pending.length === 1 ? '1 pendente' : `${pending.length} pendentes`}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={onCreateTask}>
          <CalendarPlus aria-hidden="true" />
          Nova tarefa
        </Button>
      </div>
      {pending.length ? <ul className="space-y-2">{pending.map(renderTask)}</ul> : null}
      {done.length ? (
        <details className="group">
          <summary className="flex cursor-pointer select-none items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {done.length === 1 ? '1 concluída' : `${done.length} concluídas`}
          </summary>
          <ul className="mt-2 space-y-2">{done.map(renderTask)}</ul>
        </details>
      ) : null}
    </div>
  );
};

export default ContactTasks;
