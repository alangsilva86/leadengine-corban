import { useEffect, useState } from 'react';

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
import type { CreateUserInput, UserRole } from '../types';
import { normalizePersonName } from '@/features/onboarding/utils/normalizers.ts';

type CreateUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateUserInput) => void;
  submitting?: boolean;
};

type CreateUserForm = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
};

const defaultForm: CreateUserForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'AGENT',
};

const CreateUserDialog = ({ open, onOpenChange, onSubmit, submitting = false }: CreateUserDialogProps) => {
  const [form, setForm] = useState<CreateUserForm>(defaultForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      return;
    }
    setForm(defaultForm);
    setError(null);
  }, [open]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Informe o nome completo.');
      return;
    }
    if (!form.email.trim()) {
      setError('Informe o e-mail corporativo.');
      return;
    }
    if (form.password.length < 8) {
      setError('A senha precisa ter ao menos 8 caracteres.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('As senhas informadas não coincidem.');
      return;
    }

    setError(null);

    onSubmit({
      name: normalizePersonName(form.name),
      email: form.email.trim(),
      password: form.password,
      role: form.role,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>Conceda acesso imediato a um operador interno.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="user-name">Nome completo</Label>
            <Input id="user-name" name="name" value={form.name} onChange={handleChange} disabled={submitting} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-email">E-mail corporativo</Label>
            <Input
              id="user-email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              disabled={submitting}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-role">Função</Label>
            <Select
              value={form.role}
              onValueChange={(value) => setForm((prev) => ({ ...prev, role: value as UserRole }))}
              disabled={submitting}
            >
              <SelectTrigger id="user-role">
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
              <Label htmlFor="user-password">Senha provisória</Label>
              <Input
                id="user-password"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                disabled={submitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password-confirm">Confirme a senha</Label>
              <Input
                id="user-password-confirm"
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                disabled={submitting}
                required
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Criando usuário...' : 'Criar usuário'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateUserDialog;
