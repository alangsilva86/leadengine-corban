import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { useAuth } from './AuthProvider.jsx';
import { getTenantId, getTenantSlugHint } from '@/lib/auth.js';
import { getEnvVar } from '@/lib/runtime-env.js';

const resolveEnvString = (value: unknown) => (typeof value === 'string' ? value : '');

const storedTenantSlugHint = getTenantSlugHint() ?? '';
const storedTenantId = getTenantId() ?? '';
const defaultTenantHint = resolveEnvString(getEnvVar('VITE_DEFAULT_TENANT_HINT', ''));
const initialTenant = storedTenantSlugHint || defaultTenantHint || storedTenantId;
const prefillEmail = resolveEnvString(getEnvVar('VITE_AUTH_PREFILL_EMAIL', ''));
const prefillPassword = resolveEnvString(getEnvVar('VITE_AUTH_PREFILL_PASSWORD', ''));

const normalize = (value: string) => value.trim();

const resolveErrorMessage = (error: unknown) => {
  if (!error) return 'Não foi possível concluir a operação.';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || 'Falha ao processar a operação.';
  return 'Falha inesperada ao processar a operação.';
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { status, loading, login } = useAuth();
  const [form, setForm] = useState({
    email: prefillEmail,
    password: prefillPassword,
    tenantSlug: initialTenant,
    remember: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/', { replace: true });
    }
  }, [navigate, status]);

  const isChecking = status === 'checking' || loading;

  const formDisabled = submitting || isChecking;

  const canSubmit = Boolean(form.email && form.password && form.tenantSlug);

  const handleChange = (field: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formDisabled || !canSubmit) {
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      await login({ email: normalize(form.email), password: form.password, tenantSlug: normalize(form.tenantSlug), remember: form.remember });
      navigate('/', { replace: true });
    } catch (err) {
      setError(resolveErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">
            Acesse sua conta
          </CardTitle>
          <CardDescription>
            Informe suas credenciais e a organização.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail corporativo</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="voce@empresa.com"
                value={form.email}
                onChange={handleChange('email')}
                disabled={formDisabled}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant">Tenant / empresa</Label>
              <Input
                id="tenant"
                placeholder="ex.: leadengine"
                value={form.tenantSlug}
                onChange={handleChange('tenantSlug')}
                disabled={formDisabled}
                required
              />
            </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange('password')}
                  disabled={formDisabled}
                  required
                />
              </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  className=""
                  checked={form.remember}
                  onCheckedChange={(checked: boolean | 'indeterminate') =>
                    setForm((prev) => ({ ...prev, remember: Boolean(checked) }))
                  }
                  disabled={formDisabled}
                />
                <Label htmlFor="remember" className="cursor-pointer text-sm">
                  Lembrar de mim
                </Label>
              </div>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={!canSubmit || formDisabled}>
              Entrar
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Para recuperar o acesso, fale com o administrador da sua organização.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
