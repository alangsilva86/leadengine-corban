import { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';

const formatDueDate = (value) => {
  if (!value) {
    return 'Sem prazo definido';
  }

  try {
    return format(new Date(value), 'dd/MM/yyyy HH:mm');
  } catch {
    return 'Sem prazo definido';
  }
};

const ContactTasks = ({ tasks = [], onCreateTask, onCompleteTask, isCreating = false, isCompleting = false }) => {
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  const handleCreate = (event) => {
    event.preventDefault();
    if (!description.trim()) {
      return;
    }
    onCreateTask?.({ description, dueDate: dueDate || null });
    setDescription('');
    setDueDate('');
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Tarefas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex flex-col gap-3 rounded-lg border border-dashed border-border/60 p-3" onSubmit={handleCreate}>
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Descreva a tarefa"
          />
          <Input
            type="datetime-local"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            aria-label="Data de vencimento"
          />
          <Button type="submit" size="sm" disabled={isCreating || !description.trim()}>
            {isCreating ? 'Criando…' : 'Adicionar tarefa'}
          </Button>
        </form>
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma tarefa atribuída para este contato.</p>
          ) : null}
          {tasks.map((task) => (
            <div key={task.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3 text-sm">
              <div className="flex flex-1 items-start gap-3">
                <Checkbox
                  checked={task.status === 'done'}
                  onCheckedChange={() => onCompleteTask?.(task)}
                  disabled={task.status === 'done' || isCompleting}
                  aria-label="Concluir tarefa"
                  className="mt-1"
                />
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{task.description}</p>
                  <p className="text-xs text-muted-foreground">{formatDueDate(task.dueDate)}</p>
                </div>
              </div>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{task.status ?? 'pendente'}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ContactTasks;
