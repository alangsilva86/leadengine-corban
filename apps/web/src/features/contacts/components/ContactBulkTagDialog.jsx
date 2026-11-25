import { useEffect, useId, useState } from 'react';
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

/** Adiciona uma tag a vários contatos (POST /api/contacts/actions/bulk com addTags). */
const ContactBulkTagDialog = ({ open, onOpenChange, count = 0, availableTags = [], onSubmit, isSubmitting = false }) => {
  const [tag, setTag] = useState('');
  const inputId = useId();
  const listId = useId();

  useEffect(() => {
    if (open) setTag('');
  }, [open]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const value = tag.trim();
    if (!value) return;
    onSubmit?.(value);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!isSubmitting ? onOpenChange?.(next) : undefined)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar tag</DialogTitle>
          <DialogDescription>
            {count === 1 ? 'A tag será adicionada ao contato selecionado.' : `A tag será adicionada aos ${count} contatos selecionados.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={inputId}>Tag</Label>
            <Input
              id={inputId}
              list={listId}
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              placeholder="Ex.: INSS, simulação enviada"
              maxLength={60}
              autoFocus
            />
            <datalist id={listId}>
              {availableTags.map(({ tag: existing }) => (
                <option key={existing} value={existing} />
              ))}
            </datalist>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange?.(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!tag.trim() || isSubmitting}>
              {isSubmitting ? 'Aplicando…' : 'Adicionar tag'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ContactBulkTagDialog;
