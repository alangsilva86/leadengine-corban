import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import BrandMark from '@/components/shell/BrandMark.jsx';
import { useDocumentTitle } from '@/hooks/use-document-title.js';
import { getFriendlyErrorMessage } from '@/lib/errors.js';
import { getHomePath } from '@/features/navigation/routes';
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

type FieldErrors = Partial<Record<'email' | 'password' | 'tenantSlug', string>>;

const validate = (form: { email: string; password: string; tenantSlug: string }): FieldErrors => {
  const errors: FieldErrors = {};
  if (!normalize(form.email)) errors.email = 'Informe seu e-mail.';
  else if (!/^\S+@\S+\.\S+$/.test(normalize(form.email))) errors.email = 'Confira o e-mail digitado.';
  if (!form.password) errors.password = 'Informe sua senha.';
  if (!normalize(form.tenantSlug)) errors.tenantSlug = 'Informe o código da empresa.';
  return errors;
};

const resolveLoginError = (error: unknown) => {
  const status = (error as { status?: number } | null)?.status;
  if (status === 401 || status === 403) return 'E-mail, senha ou código da empresa incorretos.';
  return getFriendlyErrorMessage(error, 'Não foi possível entrar agora. Tente de novo.');
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, loading, login, user } = useAuth();
  useDocumentTitle('Entrar');
  const [form, setForm] = useState({
    email: prefillEmail,
    password: prefillPassword,
    tenantSlug: initialTenant,
    remember: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);

  // Volta para a página que a pessoa tentou abrir antes do login.
  const redirectTo = (location.state as { from?: string } | null)?.from;

  useEffect(() => {
    if (status === 'authenticated') {
      navigate(redirectTo || getHomePath(user?.role), { replace: true });
    }
  }, [navigate, status, redirectTo, user?.role]);

  const isChecking = status === 'checking' || loading;
  const formDisabled = submitting || isChecking;

  const handleChange = (field: 'email' | 'password' | 'tenantSlug') => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formDisabled) return;
    const nextErrors = validate(form);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const firstInvalid = (['email', 'password', 'tenantSlug'] as const).find((key) => nextErrors[key]);
      const id = firstInvalid === 'tenantSlug' ? 'tenant' : firstInvalid;
      if (id) document.getElementById(id)?.focus();
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const signedUser: { role?: string } | null = await login({
        email: normalize(form.email),
        password: form.password,
        tenantSlug: normalize(form.tenantSlug),
        remember: form.remember,
      });
      navigate(redirectTo || getHomePath(signedUser?.role), { replace: true });
    } catch (err) {
      setError(resolveLoginError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const fieldError = (key: keyof FieldErrors, id: string) =>
    fieldErrors[key] ? (
      <p id={`${id}-error`} className="text-xs text-danger-soft-foreground">
        {fieldErrors[key]}
      </p>
    ) : null;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandMark className="size-11" />
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Entrar no Lead Engine</h1>
            <p className="text-sm text-muted-foreground">Use o e-mail e a senha da sua conta.</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                autoFocus
                id="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                placeholder="voce@empresa.com.br"
                value={form.email}
                onChange={handleChange('email')}
                disabled={formDisabled}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                required
              />
              {fieldError('email', 'email')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange('password')}
                  disabled={formDisabled}
                  className="pr-10"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                </button>
              </div>
              {fieldError('password', 'password')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tenant">Código da empresa</Label>
              <Input
                id="tenant"
                autoComplete="organization"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="ex.: minha-empresa"
                value={form.tenantSlug}
                onChange={handleChange('tenantSlug')}
                disabled={formDisabled}
                aria-invalid={Boolean(fieldErrors.tenantSlug)}
                aria-describedby={fieldErrors.tenantSlug ? 'tenant-error' : 'tenant-hint'}
                required
              />
              {fieldErrors.tenantSlug ? (
                fieldError('tenantSlug', 'tenant')
              ) : (
                <p id="tenant-hint" className="text-xs text-muted-foreground">
                  Está no convite que você recebeu por e-mail.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={form.remember}
                onCheckedChange={(checked: boolean | 'indeterminate') =>
                  setForm((prev) => ({ ...prev, remember: Boolean(checked) }))
                }
                disabled={formDisabled}
              />
              <Label htmlFor="remember" className="cursor-pointer text-sm font-normal">
                Manter conectado neste computador
              </Label>
            </div>
            {error ? (
              <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={formDisabled} aria-busy={submitting}>
              {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {submitting ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Esqueceu a senha? Peça ao administrador da sua empresa para redefinir.
        </p>
      </div>
    </div>
  );
}
