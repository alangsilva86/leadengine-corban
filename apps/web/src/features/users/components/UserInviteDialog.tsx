import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import type { InviteUserInput, UserRole } from '../types';
import { normalizeSlugInput } from '@/features/onboarding/utils/normalizers.ts';

type InviteUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: InviteUserInput) => void;
  submitting?: boolean;
  defaultSlug?: string;
};

type InviteForm = {
  email: string;
  role: UserRole;
  expiresInDays: string;
  tenantSlugHint: string;
};

const defaultForm: InviteForm = {
  email: '',
  role: 'AGENT',
  expiresInDays: '7',
  tenantSlugHint: '',
};

const INVITE_FALLBACK_BASE_URL = 'https://app.leadengine.com';

const UserInviteDialog = ({ open, onOpenChange, onSubmit, submitting = false, defaultSlug = '' }: InviteUserDialogProps) => {
  const [form, setForm] = useState<InviteForm>({ ...defaultForm, tenantSlugHint: defaultSlug });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm((prev) => ({ ...prev, tenantSlugHint: defaultSlug || prev.tenantSlugHint }));
      return;
    }
    setForm({ ...defaultForm, tenantSlugHint: defaultSlug });
    setError(null);
  }, [open, defaultSlug]);

  const inviteLinkPreview = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : INVITE_FALLBACK_BASE_URL;
    const normalizedBase = base.replace(/\/$/, '');
    const slug = form.tenantSlugHint || 'seu-workspace';
    return `${normalizedBase}/${slug}/entrar`;
  }, [form.tenantSlugHint]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'tenantSlugHint' ? normalizeSlugInput(value) : value,
    }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.email.trim()) {
      setError('Informe o e-mail do convidado.');
      return;
    }

    const payload: InviteUserInput = {
      email: form.email.trim(),
      role: form.role,
    };

    const expires = Number(form.expiresInDays);
    if (!Number.isNaN(expires) && expires > 0) {
      payload.expiresInDays = expires;
    }
    if (form.tenantSlugHint) {
      payload.tenantSlugHint = form.tenantSlugHint;
    }

    setError(null);
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Enviar convite</DialogTitle>
            <DialogDescription>Compartilhe um link com expiração controlada para novos operadores.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="invite-email">E-mail corporativo</Label>
            <Input
              id="invite-email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              disabled={submitting}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">Função desejada</Label>
            <Select
              value={form.role}
              onValueChange={(value) => setForm((prev) => ({ ...prev, role: value as UserRole }))}
              disabled={submitting}
            >
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Administrador</SelectItem>
                <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                <SelectItem value="AGENT">Agente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invite-expires">Validade (dias)</Label>
              <Input
                id="invite-expires"
                type="number"
                name="expiresInDays"
                min={1}
                max={30}
                value={form.expiresInDays}
                onChange={handleChange}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-slug">Slug do workspace</Label>
              <Input
                id="invite-slug"
                name="tenantSlugHint"
                value={form.tenantSlugHint}
                onChange={handleChange}
                disabled={submitting}
                placeholder="seu-workspace"
              />
              <p className="text-xs text-muted-foreground">Utilizamos o mesmo formato do onboarding para gerar o link.</p>
            </div>
          </div>
          <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Prévia do link</p>
            <code className="mt-1 block truncate text-[11px]">{inviteLinkPreview}</code>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Enviando convite...' : 'Enviar convite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UserInviteDialog;
