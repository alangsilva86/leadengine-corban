import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';

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
import { Checkbox } from '@/components/ui/checkbox.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Ativo' },
  { value: 'INACTIVE', label: 'Inativo' },
  { value: 'ARCHIVED', label: 'Arquivado' },
];

const DEFAULT_VALUES = {
  name: '',
  phone: '',
  email: '',
  document: '',
  status: 'ACTIVE',
  notes: '',
  isBlocked: false,
};

const ContactCreateDialog = ({ open, onOpenChange, onSubmit }) => {
  const [values, setValues] = useState(DEFAULT_VALUES);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setValues(DEFAULT_VALUES);
    setError(null);
    setSubmitting(false);
  }, [open]);

  const canSubmit = useMemo(() => values.name.trim().length > 0, [values.name]);

  const handleClose = (nextOpen) => {
    if (submitting) {
      return;
    }
    onOpenChange?.(nextOpen);
  };

  const setField = (field, nextValue) => {
    setValues((prev) => ({ ...prev, [field]: nextValue }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      name: values.name.trim(),
      phone: values.phone.trim() || undefined,
      email: values.email.trim() || undefined,
      document: values.document.trim() || undefined,
      status: values.status,
      isBlocked: values.isBlocked || undefined,
      notes: values.notes.trim() || undefined,
    };

    try {
      await onSubmit?.(payload);
      onOpenChange?.(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível criar o contato. Tente novamente.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo contato</DialogTitle>
          <DialogDescription>
            Cadastre rapidamente um contato para iniciar um atendimento ou disparar uma campanha.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="contact-create-name">Nome completo</Label>
            <Input
              id="contact-create-name"
              value={values.name}
              onChange={(event) => setField('name', event.target.value)}
              placeholder="Nome do contato"
              required
              autoFocus
              disabled={submitting}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact-create-phone">Telefone</Label>
              <Input
                id="contact-create-phone"
                value={values.phone}
                onChange={(event) => setField('phone', event.target.value)}
                placeholder="(11) 99999-0000"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-create-email">E-mail</Label>
              <Input
                id="contact-create-email"
                type="email"
                value={values.email}
                onChange={(event) => setField('email', event.target.value)}
                placeholder="cliente@empresa.com"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact-create-document">Documento</Label>
              <Input
                id="contact-create-document"
                value={values.document}
                onChange={(event) => setField('document', event.target.value)}
                placeholder="CPF/CNPJ (opcional)"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-create-status">Status</Label>
              <Select
                value={values.status}
                onValueChange={(nextStatus) => setField('status', nextStatus)}
                disabled={submitting}
              >
                <SelectTrigger id="contact-create-status">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-create-notes">Notas internas</Label>
            <Textarea
              id="contact-create-notes"
              value={values.notes}
              onChange={(event) => setField('notes', event.target.value)}
              placeholder="Contexto inicial, preferências ou instruções importantes."
              rows={4}
              disabled={submitting}
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={values.isBlocked}
              onCheckedChange={(nextValue) => setField('isBlocked', Boolean(nextValue))}
              disabled={submitting}
            />
            Bloquear contato para campanhas automáticas
          </label>

          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
              <span>{error}</span>
            </div>
          ) : null}

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={submitting} onClick={() => handleClose(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit || submitting}>
              {submitting ? 'Criando...' : 'Criar contato'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ContactCreateDialog;
