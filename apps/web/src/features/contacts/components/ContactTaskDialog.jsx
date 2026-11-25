import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { getFriendlyErrorMessage } from '@/lib/errors.js';
import { useCreateContactTaskMutation } from '../hooks/useContactsApi.js';

const SUGGESTIONS = ['Ligar para o cliente', 'Enviar simulação', 'Pedir documentos', 'Retomar conversa'];

/**
 * Cria uma tarefa para o contato (POST /api/tasks/:contactId/tasks).
 * `contact` precisa de { id, name }.
 */
const ContactTaskDialog = ({ open, onOpenChange, contact, onCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const mutation = useCreateContactTaskMutation();
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !contact?.id || mutation.isPending) {
      return;
    }
    setError(null);
    try {
      const task = await mutation.mutateAsync({
        contactId: contact.id,
        title: trimmed,
        description: description.trim() || undefined,
      });
      toast.success('Tarefa criada.', { description: contact.name ? `Para ${contact.name}.` : undefined });
      onCreated?.(task);
      onOpenChange?.(false);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Não foi possível criar a tarefa.'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!mutation.isPending ? onOpenChange?.(next) : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>
            {contact?.name ? `Próximo passo com ${contact.name}.` : 'Registre o próximo passo com o contato.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={titleId}>O que precisa ser feito</Label>
            <Input
              id={titleId}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Ligar amanhã às 10h para enviar a simulação"
              maxLength={200}
              autoFocus
              required
            />
            <div className="flex flex-wrap gap-1.5" aria-label="Sugestões">
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  size="xs"
                  variant="secondary"
                  onClick={() => setTitle(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={descriptionId}>
              Detalhes <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id={descriptionId}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Contexto para quem for executar a tarefa."
            />
          </div>
          {error ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange?.(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!title.trim() || mutation.isPending}>
              {mutation.isPending ? 'Criando…' : 'Criar tarefa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ContactTaskDialog;
