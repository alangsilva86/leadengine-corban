import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import type { LeadTask } from '../../state/leads.ts';

type LeadTaskListProps = {
  tasks: LeadTask[];
};

const statusConfig: Record<LeadTask['status'], { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  pending: { label: 'Pendente', icon: Clock, className: 'text-amber-500' },
  completed: { label: 'Concluída', icon: CheckCircle, className: 'text-emerald-500' },
  overdue: { label: 'Atrasada', icon: AlertTriangle, className: 'text-rose-500' },
};

const LeadTaskList = ({ tasks }: LeadTaskListProps) => {
  if (!tasks.length) {
    return <p className="text-sm text-muted-foreground">Nenhuma tarefa vinculada ao lead.</p>;
  }

  return (
    <ul className="space-y-2">
      {tasks.map((task) => {
        const config = statusConfig[task.status];
        const Icon = config.icon;
        let dueLabel = 'Sem prazo';
        try {
          dueLabel = format(new Date(task.dueDate), "dd 'de' MMMM", { locale: ptBR });
        } catch {
          dueLabel = task.dueDate;
        }

        return (
          <li key={task.id} className="flex items-start justify-between gap-4 rounded-lg border border-border/50 bg-background/60 p-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{task.title}</p>
              <p className="text-xs text-muted-foreground">Responsável: {task.ownerName ?? 'Não atribuído'}</p>
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <span className="text-xs text-muted-foreground">Prazo: {dueLabel}</span>
              <span className={cn('inline-flex items-center gap-1 text-xs font-medium', config.className)}>
                <Icon className="h-3.5 w-3.5" /> {config.label}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default LeadTaskList;
