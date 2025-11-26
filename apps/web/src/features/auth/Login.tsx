import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Separator } from '@/components/ui/separator.jsx';
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
const authProvider = resolveEnvString(getEnvVar('VITE_AUTH_PROVIDER', 'internal')).toLowerCase();

const normalize = (value: string) => value.trim();

const resolveErrorMessage = (error: unknown) => {
  if (!error) return 'Não foi possível concluir a operação.';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || 'Falha ao processar a operação.';
  return 'Falha inesperada ao processar a operação.';
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { status, loading, login, recoverPassword } = useAuth();
  const [mode, setMode] = useState<'login' | 'recover'>('login');
  const [form, setForm] = useState({ email: prefillEmail, password: prefillPassword, tenantSlug: initialTenant });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showOnboardingShortcut = authProvider === 'invite';

  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/', { replace: true });
    }
  }, [navigate, status]);

  const isChecking = status === 'checking' || loading;

  const formDisabled = submitting || isChecking;

  const canSubmit = useMemo(() => {
    if (mode === 'login') {
      return Boolean(form.email && form.password && form.tenantSlug);
    }
    return Boolean(form.email);
  }, [form.email, form.password, form.tenantSlug, mode]);

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
      if (mode === 'login') {
        await login({
          email: normalize(form.email),
          password: form.password,
          tenantSlug: normalize(form.tenantSlug),
        });
        navigate('/', { replace: true });
      } else {
        await recoverPassword({
          email: normalize(form.email),
          tenantSlug: form.tenantSlug ? normalize(form.tenantSlug) : undefined,
        });
        setMode('login');
      }
    } catch (err) {
      setError(resolveErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode((current) => (current === 'login' ? 'recover' : 'login'));
    setError(null);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">
            {mode === 'login' ? 'Acesse sua conta' : 'Recuperar acesso'}
          </CardTitle>
          <CardDescription>
            {mode === 'login'
              ? 'Informe suas credenciais e o tenant para iniciar uma nova sessão segura.'
              : 'Enviaremos um link de redefinição para o e-mail cadastrado.'}
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
            {mode === 'login' ? (
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
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={!canSubmit || formDisabled}>
              {mode === 'login' ? 'Entrar' : 'Enviar instruções'}
            </Button>
          </form>
          <Separator className="my-6" />
          <div className="space-y-2 text-center text-sm text-muted-foreground">
            {mode === 'login' ? (
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={toggleMode}
                disabled={formDisabled}
              >
                Esqueci minha senha
              </button>
            ) : (
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={toggleMode}
                disabled={formDisabled}
              >
                Voltar para o login
              </button>
            )}
            {showOnboardingShortcut ? (
              <p>
                Recebeu um convite?{' '}
                <Link to="/onboarding" className="text-primary underline-offset-2 hover:underline">
                  Iniciar onboarding guiado
                </Link>
                .
              </p>
            ) : (
              <p>
                Precisa de ajuda? Entre em contato com o suporte ou{' '}
                <Link to="/" className="text-primary underline-offset-2 hover:underline">
                  volte para a página inicial
                </Link>
                .
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
