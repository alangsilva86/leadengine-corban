import { useEffect, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { hasDateOverlap } from '@/features/agreements/utils/dailyCoefficient.js';
import { generateId, parseDate, toInputValue } from '@/features/agreements/convenioSettings.utils.ts';

const WindowDialog = ({ open, onClose, onSubmit, initialValue, windows, disabled }) => {
  const [form, setForm] = useState(() => ({
    id: initialValue?.id ?? null,
    label: initialValue?.label ?? '',
    start: initialValue ? toInputValue(initialValue.start) : '',
    end: initialValue ? toInputValue(initialValue.end) : '',
    firstDueDate: initialValue ? toInputValue(initialValue.firstDueDate) : '',
  }));
  const [error, setError] = useState(null);

  useEffect(() => {
    setForm({
      id: initialValue?.id ?? null,
      label: initialValue?.label ?? '',
      start: initialValue ? toInputValue(initialValue.start) : '',
      end: initialValue ? toInputValue(initialValue.end) : '',
      firstDueDate: initialValue ? toInputValue(initialValue.firstDueDate) : '',
    });
    setError(null);
  }, [initialValue, open]);

  const handleSubmit = (event) => {
    event.preventDefault();

    const start = form.start ? parseDate(form.start) : null;
    const end = form.end ? parseDate(form.end) : null;
    const firstDueDate = form.firstDueDate ? parseDate(form.firstDueDate) : null;

    if (!start || !end || !firstDueDate) {
      setError('Preencha todas as datas.');
      return;
    }

    if (end < start) {
      setError('Último dia deve ser maior que o primeiro.');
      return;
    }

    if (firstDueDate <= end) {
      setError('1º vencimento precisa ser posterior ao fim da janela.');
      return;
    }

    const candidate = { start, end, firstDueDate };
    const other = windows.filter((window) => window.id !== form.id);
    if (hasDateOverlap(other, candidate)) {
      setError('Existe sobreposição com outra janela.');
      return;
    }

    onSubmit({
      id: form.id ?? generateId(),
      label: form.label || 'Janela',
      ...candidate,
      mode: form.id ? 'update' : 'create',
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar janela' : 'Nova janela de contratação'}</DialogTitle>
            <DialogDescription>Cadastre o intervalo em que o banco aceita contratos e o 1º vencimento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="window-label">Nome da janela (opcional)</Label>
            <Input
              id="window-label"
              value={form.label}
              onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
              disabled={disabled}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>1º dia</Label>
              <Input
                type="date"
                value={form.start}
                onChange={(event) => setForm((current) => ({ ...current, start: event.target.value }))}
                required
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>Último dia</Label>
              <Input
                type="date"
                value={form.end}
                onChange={(event) => setForm((current) => ({ ...current, end: event.target.value }))}
                required
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>1º vencimento</Label>
              <Input
                type="date"
                value={form.firstDueDate}
                onChange={(event) => setForm((current) => ({ ...current, firstDueDate: event.target.value }))}
                required
                disabled={disabled}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={disabled}>
              <CalendarCheck className="mr-2 h-4 w-4" /> Salvar janela
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default WindowDialog;
