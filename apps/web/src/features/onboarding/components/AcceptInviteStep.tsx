import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

import OnboardingPortalLayout from './OnboardingPortalLayout.tsx';
import { Input } from '@/components/ui/input.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.jsx';
import { apiPost } from '@/lib/api.js';

export type InviteDetails = {
  token: string;
  email: string;
  channel?: string | null;
  organization?: string | null;
  tenantSlugHint?: string | null;
  expiresAt?: string | null;
  acceptedAt?: string | null;
};

export type AcceptInviteStepProps = {
  invite: InviteDetails | null;
  onboarding?: {
    stages: { id: string; label: string }[];
    activeStep: number;
  };
  initialToken?: string | null;
  onInviteValidated: (invite: InviteDetails) => void;
  onContinue: () => void;
};

const readQueryToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const url = new URL(window.location.href);
  return url.searchParams.get('token') ?? url.searchParams.get('invite');
};

const AcceptInviteStep = ({ invite, onboarding, initialToken, onInviteValidated, onContinue }: AcceptInviteStepProps) => {
  const [token, setToken] = useState(() => initialToken ?? readQueryToken() ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedOrganization = invite?.organization ?? 'sua operação';

  const disableSubmit = loading || !token.trim();

  const handleValidate = async (overrideToken?: string) => {
    const normalized = (overrideToken ?? token).trim();
    if (!normalized) {
      setError('Informe o token enviado no convite.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiPost('/api/onboarding/invites/validate', { token: normalized });
      const payload = response?.data;
      if (payload) {
        onInviteValidated(payload);
        setToken(payload.token);
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.delete('token');
          url.searchParams.delete('invite');
          window.history.replaceState({}, '', `${url.pathname}${url.search}`);
        }
        onContinue();
      }
    } catch (err) {
      const message = err?.message ?? 'Não foi possível validar o convite agora.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!invite && initialToken) {
      handleValidate(initialToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialToken]);

  const accent = useMemo(() => (
    <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-600">
      Etapa 1 de 3
    </div>
  ), []);

  return (
    <OnboardingPortalLayout
      title="Valide seu convite"
      description="Confirme o token enviado por e-mail ou SMS para destravar o setup assistido."
      onboarding={onboarding}
      accent={accent}
    >
      {invite ? (
        <div className="space-y-4 rounded-lg border border-emerald-200/70 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4" />
            Convite validado para {invite.email}
          </div>
          <p>
            Vamos criar o workspace de <strong>{resolvedOrganization}</strong> utilizando o token{' '}
            <code className="rounded bg-background/80 px-1 py-0.5 text-xs">{invite.token}</code>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => handleValidate(invite.token)} disabled={loading}>
              Revalidar token
            </Button>
            <Button type="button" onClick={onContinue}>
              Continuar para configuração
            </Button>
          </div>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
          <div className="space-y-2">
            <Label htmlFor="invite-token">Token do convite</Label>
            <Input
              id="invite-token"
              placeholder="ex.: ticketz-123-456"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              disabled={loading}
              required
            />
            <p className="text-xs text-muted-foreground">
              Copie o código recebido no e-mail/SMS e cole acima. Tokens expiram após 72 horas.
            </p>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Não foi possível validar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="button" className="w-full" disabled={disableSubmit} onClick={() => handleValidate()}>
            Validar convite
          </Button>
        </form>
      )}
    </OnboardingPortalLayout>
  );
};

export default AcceptInviteStep;
