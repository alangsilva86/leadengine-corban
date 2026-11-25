import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle } from 'lucide-react';

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
import { apiGet } from '@/lib/api.js';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import { formatPhone, maskPhoneInput, toE164 } from '@/lib/phone';

const DEFAULT_VALUES = {
  name: '',
  phone: '',
  email: '',
  document: '',
  notes: '',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Procura contato existente com o mesmo telefone (a busca da API compara o telefone por trecho). */
const useDuplicatePhone = (e164, enabled) => {
  const debounced = useDebouncedValue(e164, 400);
  return useQuery({
    queryKey: ['contacts', 'duplicate-check', debounced],
    enabled: enabled && Boolean(debounced),
    staleTime: 30_000,
    queryFn: async () => {
      const digits = String(debounced).replace(/\D/g, '');
      const response = await apiGet(`/api/contacts?${new URLSearchParams({ search: digits.slice(-11), limit: '3' })}`);
      const data = response?.data ?? response;
      const items = Array.isArray(data?.items) ? data.items : [];
      return items.find((item) => String(item.phone ?? '').replace(/\D/g, '').endsWith(digits.slice(-11))) ?? null;
    },
  });
};

const ContactCreateDialog = ({ open, onOpenChange, onSubmit }) => {
  const [values, setValues] = useState(DEFAULT_VALUES);
  const [touched, setTouched] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setValues(DEFAULT_VALUES);
    setTouched({});
    setError(null);
    setSubmitting(false);
  }, [open]);

  const phoneE164 = useMemo(() => toE164(values.phone), [values.phone]);
  const emailValid = !values.email.trim() || EMAIL_PATTERN.test(values.email.trim());
  const duplicate = useDuplicatePhone(phoneE164, open);
  const existing = duplicate.data;

  const errors = {
    name: values.name.trim() ? null : 'Informe o nome do contato.',
    phone: phoneE164 ? null : 'Informe um WhatsApp válido com DDD, ex.: (62) 99977-6655.',
    email: emailValid ? null : 'Confira o e-mail digitado.',
  };
  const canSubmit = !errors.name && !errors.phone && !errors.email;

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
    setTouched({ name: true, phone: true, email: true });
    if (!canSubmit || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      name: values.name.trim(),
      phone: phoneE164,
      email: values.email.trim() || undefined,
      document: values.document.replace(/\D/g, '') || undefined,
      notes: values.notes.trim() || undefined,
    };

    try {
      await onSubmit?.(payload);
      onOpenChange?.(false);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Não foi possível criar o contato. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldError = (field) =>
    touched[field] && errors[field] ? (
      <p id={`contact-create-${field}-error`} className="text-xs text-danger-soft-foreground">
        {errors[field]}
      </p>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo contato</DialogTitle>
          <DialogDescription>Cadastre o cliente com o WhatsApp para poder iniciar a conversa.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="contact-create-name">Nome completo</Label>
            <Input
              id="contact-create-name"
              value={values.name}
              onChange={(event) => setField('name', event.target.value)}
                            placeholder="Nome do cliente"
              autoComplete="off"
              required
              autoFocus
              disabled={submitting}
              aria-invalid={Boolean(touched.name && errors.name)}
              aria-describedby={touched.name && errors.name ? 'contact-create-name-error' : undefined}
            />
            {fieldError('name')}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact-create-phone">WhatsApp</Label>
              <Input
                id="contact-create-phone"
                type="tel"
                inputMode="tel"
                value={values.phone}
                onChange={(event) => setField('phone', maskPhoneInput(event.target.value))}
                onBlur={() => values.phone && setTouched((prev) => ({ ...prev, phone: true }))}
                placeholder="(62) 99977-6655"
                autoComplete="off"
                required
                disabled={submitting}
                className="tabular-nums"
                aria-invalid={Boolean(touched.phone && errors.phone)}
                aria-describedby={touched.phone && errors.phone ? 'contact-create-phone-error' : undefined}
              />
              {fieldError('phone')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-create-email">
                E-mail <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="contact-create-email"
                type="email"
                value={values.email}
                onChange={(event) => setField('email', event.target.value)}
                onBlur={() => values.email && setTouched((prev) => ({ ...prev, email: true }))}
                placeholder="cliente@email.com"
                disabled={submitting}
                aria-invalid={Boolean(touched.email && errors.email)}
                aria-describedby={touched.email && errors.email ? 'contact-create-email-error' : undefined}
              />
              {fieldError('email')}
            </div>
          </div>

          {existing ? (
            <div role="status" className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning-soft-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                Já existe um contato com este WhatsApp: <strong>{existing.name}</strong>
                {existing.phone ? ` (${formatPhone(existing.phone)})` : ''}.{' '}
                <Link to={`/contacts/${existing.id}`} className="font-medium underline" onClick={() => onOpenChange?.(false)}>
                  Abrir contato existente
                </Link>
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="contact-create-document">
              CPF <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="contact-create-document"
              value={values.document}
              onChange={(event) => setField('document', event.target.value.replace(/[^\d.\-/]/g, '').slice(0, 18))}
              placeholder="000.000.000-00"
              inputMode="numeric"
              autoComplete="off"
              disabled={submitting}
              className="tabular-nums"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-create-notes">
              Observações <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="contact-create-notes"
              value={values.notes}
              onChange={(event) => setField('notes', event.target.value)}
              placeholder="Convênio, margem informada, melhor horário para contato…"
              rows={3}
              disabled={submitting}
            />
          </div>

          {error ? (
            <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft p-3 text-sm text-danger-soft-foreground">
              <AlertCircle className="mt-0.5 size-4 flex-none" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" disabled={submitting} onClick={() => handleClose(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Criando…' : 'Criar contato'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ContactCreateDialog;
