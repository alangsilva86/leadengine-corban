import { ChangeEvent, FormEvent, useMemo, useState } from 'react';

import OnboardingPortalLayout from './OnboardingPortalLayout.tsx';
import type { InviteDetails } from './AcceptInviteStep.tsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.jsx';
import { apiPost } from '@/lib/api.js';
import { setAuthToken, setTenantId } from '@/lib/auth.js';
import { useAuth } from '@/features/auth/AuthProvider.jsx';
import { Badge } from '@/components/ui/badge.jsx';

export type TeamSetupResult = {
  tenant: { id: string; name: string; slug: string };
  operator: { id: string; name: string; email: string };
  queue?: { id: string; name: string };
  campaign?: { id: string; name: string };
  session?: { token?: { accessToken?: string } };
};

export type TeamSetupStepProps = {
  invite: InviteDetails;
  onboarding?: {
    stages: { id: string; label: string }[];
    activeStep: number;
  };
  onBack: () => void;
  onProvisioned: (result: TeamSetupResult) => void;
  onContinue: () => void;
};

const normalizeSlugInput = (value: string): string => value.replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-');

const TeamSetupStep = ({ invite, onboarding, onBack, onProvisioned, onContinue }: TeamSetupStepProps) => {
  const { refresh, selectTenant } = useAuth();
  const [form, setForm] = useState({
    tenantName: invite.organization ?? 'Nova equipe',
    tenantSlug: invite.tenantSlugHint ?? (invite.organization ? normalizeSlugInput(invite.organization.toLowerCase()) : ''),
    operatorName: invite.organization ? `${invite.organization} Admin` : '',
    password: '',
    confirmPassword: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accent = useMemo(
    () => (
      <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">Etapa 2 de 3</div>
    ),
    []
  );

  const handleChange = (field: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = field === 'tenantSlug' ? normalizeSlugInput(event.target.value) : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (form.password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('As senhas informadas não coincidem.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = await apiPost('/api/onboarding/setup', {
        token: invite.token,
        tenant: { name: form.tenantName, slug: form.tenantSlug || undefined },
        operator: {
          name: form.operatorName || invite.email,
          email: invite.email,
          password: form.password,
        },
      });

      const data = payload?.data as TeamSetupResult;
      if (data?.session?.token?.accessToken) {
        setAuthToken(data.session.token.accessToken);
        if (data.tenant?.id) {
          setTenantId(data.tenant.id);
          selectTenant?.(data.tenant.id);
        }
        await refresh?.();
      }

      onProvisioned(data);
      onContinue();
    } catch (err) {
      setError(err?.message ?? 'Não foi possível finalizar o cadastro agora.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingPortalLayout
      title="Configure sua equipe"
      description="Informe o nome da empresa e defina a senha do primeiro operador para liberar o workspace."
      onboarding={onboarding}
      accent={accent}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tenant-name">Nome da empresa</Label>
            <Input
              id="tenant-name"
              value={form.tenantName}
              onChange={handleChange('tenantName')}
              disabled={submitting}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenant-slug">Identificador (slug)</Label>
            <Input
              id="tenant-slug"
              value={form.tenantSlug}
              onChange={handleChange('tenantSlug')}
              disabled={submitting}
              required
            />
            <p className="text-xs text-muted-foreground">Usamos este identificador nos links e QR Codes.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="operator-name">Nome do operador</Label>
            <Input
              id="operator-name"
              value={form.operatorName}
              onChange={handleChange('operatorName')}
              disabled={submitting}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="operator-email">E-mail corporativo</Label>
            <Input id="operator-email" value={invite.email} disabled />
            <p className="text-xs text-muted-foreground">Precisamos utilizar o mesmo endereço do convite.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="operator-password">Senha</Label>
            <Input
              id="operator-password"
              type="password"
              value={form.password}
              onChange={handleChange('password')}
              disabled={submitting}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="operator-password-confirm">Confirmar senha</Label>
            <Input
              id="operator-password-confirm"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange('confirmPassword')}
              disabled={submitting}
              required
            />
          </div>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Algo saiu do previsto</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>
            Voltar
          </Button>
          <Button type="submit" className="flex-1" disabled={submitting}>
            {submitting ? 'Criando workspace…' : 'Criar workspace'}
          </Button>
        </div>
        <Badge variant="outline" className="w-full justify-center border-muted-foreground/30 text-xs text-muted-foreground">
          Um workspace ativo = um operador administrador com acesso imediato
        </Badge>
      </form>
    </OnboardingPortalLayout>
  );
};

export default TeamSetupStep;
