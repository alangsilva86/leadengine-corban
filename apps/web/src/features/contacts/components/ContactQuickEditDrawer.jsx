import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { formatDocument, maskPhoneInput, toE164 } from '../utils/format.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const buildInitialValues = (contact, canViewSensitiveData) => ({
  name: contact?.name ?? '',
  phone: contact?.phone ? maskPhoneInput(contact.phone) : '',
  email: contact?.email ?? '',
  document: canViewSensitiveData && contact?.document ? formatDocument(contact.document, { reveal: true }) : '',
  notes: contact?.notes ?? '',
  isBlocked: Boolean(contact?.isBlocked),
});

/**
 * Edição rápida do contato (PATCH /api/contacts/:id).
 * Só envia campos alterados e válidos; o CPF só aparece para quem pode ver dados sensíveis.
 */
const ContactQuickEditDrawer = ({ open, onOpenChange, contact, onSubmit, isSubmitting = false, canViewSensitiveData = false }) => {
  const [values, setValues] = useState(() => buildInitialValues(contact, canViewSensitiveData));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setValues(buildInitialValues(contact, canViewSensitiveData));
      setError(null);
    }
  }, [open, contact, canViewSensitiveData]);

  const setField = (field, value) => setValues((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const initial = buildInitialValues(contact, canViewSensitiveData);
    const payload = {};

    const name = values.name.trim();
    if (!name) {
      setError('Informe o nome do contato.');
      return;
    }
    if (name !== initial.name) payload.name = name;

    if (values.phone !== initial.phone) {
      const phone = toE164(values.phone);
      if (!phone) {
        setError('Informe um WhatsApp válido com DDD, ex.: (62) 99977-6655.');
        return;
      }
      payload.phone = phone;
    }

    const email = values.email.trim();
    if (email !== initial.email) {
      if (!email || !EMAIL_PATTERN.test(email)) {
        setError(email ? 'Confira o e-mail digitado.' : 'Para remover o e-mail, fale com o suporte.');
        return;
      }
      payload.email = email;
    }

    if (canViewSensitiveData && values.document !== initial.document) {
      const document = values.document.replace(/\D/g, '');
      if (document) payload.document = document;
    }

    if (values.notes.trim() !== initial.notes.trim()) payload.notes = values.notes.trim();
    if (values.isBlocked !== initial.isBlocked) payload.isBlocked = values.isBlocked;

    if (Object.keys(payload).length === 0) {
      onOpenChange?.(false);
      return;
    }
    setError(null);
    onSubmit?.(payload);
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (!isSubmitting ? onOpenChange?.(next) : undefined)}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Editar contato</SheetTitle>
          <SheetDescription>As alterações valem para o Inbox e o CRM.</SheetDescription>
        </SheetHeader>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit} noValidate>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="space-y-1.5">
              <Label htmlFor="contact-edit-name">Nome</Label>
              <Input id="contact-edit-name" value={values.name} onChange={(event) => setField('name', event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-edit-phone">WhatsApp</Label>
              <Input
                id="contact-edit-phone"
                type="tel"
                inputMode="tel"
                className="tabular-nums"
                placeholder="(62) 99977-6655"
                value={values.phone}
                onChange={(event) => setField('phone', maskPhoneInput(event.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-edit-email">E-mail</Label>
              <Input
                id="contact-edit-email"
                type="email"
                placeholder="cliente@email.com"
                value={values.email}
                onChange={(event) => setField('email', event.target.value)}
              />
            </div>
            {canViewSensitiveData ? (
              <div className="space-y-1.5">
                <Label htmlFor="contact-edit-document">CPF</Label>
                <Input
                  id="contact-edit-document"
                  inputMode="numeric"
                  className="tabular-nums"
                  placeholder="000.000.000-00"
                  value={values.document}
                  onChange={(event) => setField('document', event.target.value.replace(/[^\d.\-/]/g, '').slice(0, 18))}
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="contact-edit-notes">Observações</Label>
              <Textarea
                id="contact-edit-notes"
                rows={4}
                placeholder="Convênio, margem informada, melhor horário para contato…"
                value={values.notes}
                onChange={(event) => setField('notes', event.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={values.isBlocked} onCheckedChange={(next) => setField('isBlocked', Boolean(next))} />
              Bloquear envio de mensagens a este contato
            </label>
            {error ? (
              <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
                {error}
              </p>
            ) : null}
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange?.(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando…' : 'Salvar alterações'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default ContactQuickEditDrawer;
