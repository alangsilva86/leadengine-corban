import { useEffect, useMemo, useState } from 'react';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog.jsx';
import {
  getAuthToken,
  getTenantId,
  loginWithCredentials,
  onAuthTokenChange,
  onTenantIdChange,
} from '@/lib/auth.js';

const defaultEmail = import.meta.env.VITE_DEMO_OPERATOR_EMAIL || '';
const defaultPassword = import.meta.env.VITE_DEMO_OPERATOR_PASSWORD || '';
const fallbackTenant =
  import.meta.env.VITE_DEMO_TENANT_ID || import.meta.env.VITE_API_TENANT_ID || import.meta.env.VITE_TENANT_ID || '';

const initialTenant = () => getTenantId() || fallbackTenant;

const sanitizeTenant = (value) => value?.trim().toLowerCase() || '';

export default function DemoAuthDialog() {
  const [open, setOpen] = useState(false);
  const [hasToken, setHasToken] = useState(() => Boolean(getAuthToken()));
  const [activeTenant, setActiveTenant] = useState(() => sanitizeTenant(initialTenant()));
  const [formData, setFormData] = useState(() => ({
    email: defaultEmail,
    password: defaultPassword,
    tenantId: sanitizeTenant(initialTenant()),
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const unsubToken = onAuthTokenChange((token) => {
      setHasToken(Boolean(token));
    });
    const unsubTenant = onTenantIdChange((tenant) => {
      const normalized = sanitizeTenant(tenant);
      setActiveTenant(normalized);
      setFormData((previous) => {
        if (previous.tenantId) {
          return previous;
        }
        return { ...previous, tenantId: normalized };
      });
    });
    return () => {
      unsubToken();
      unsubTenant();
    };
  }, []);

  const handleChange = (field) => (event) => {
    const value = field === 'tenantId' ? sanitizeTenant(event.target.value) : event.target.value;
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        email: formData.email,
        password: formData.password,
        tenantId: sanitizeTenant(formData.tenantId),
      };
      await loginWithCredentials(payload);
      setSuccess('Login realizado com sucesso. Token ativo para chamadas subsequentes.');
      setOpen(false);
    } catch (submitError) {
      setError(submitError?.message || 'Falha ao autenticar. Verifique as credenciais.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusLabel = useMemo(() => {
    if (hasToken) {
      return activeTenant ? `Sessão ativa (${activeTenant})` : 'Sessão ativa';
    }
    return 'Sem sessão ativa';
  }, [hasToken, activeTenant]);

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next);
      if (next) {
        setError('');
        setSuccess('');
        setFormData((previous) => ({
          ...previous,
          tenantId: previous.tenantId || sanitizeTenant(initialTenant()),
        }));
      }
    }}>
      <DialogTrigger asChild>
        <Button variant={hasToken ? 'secondary' : 'default'} size="sm" className="gap-2">
          <LogIn className="h-4 w-4" />
          {hasToken ? 'Atualizar sessão demo' : 'Login demo'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Autenticar operador demo</DialogTitle>
          <DialogDescription>
            Informe as credenciais do operador demo para gerar um token de API e persistir o tenant ativo no navegador.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="demo-tenant">Tenant</Label>
            <Input
              id="demo-tenant"
              autoComplete="off"
              value={formData.tenantId}
              onChange={handleChange('tenantId')}
              placeholder="ex.: demo-tenant"
              required
            />
            <p className="text-xs text-muted-foreground">
              Tenant atual: {activeTenant || 'não definido'}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-email">E-mail</Label>
            <Input
              id="demo-email"
              type="email"
              autoComplete="username"
              value={formData.email}
              onChange={handleChange('email')}
              placeholder="operador@exemplo.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-password">Senha</Label>
            <Input
              id="demo-password"
              type="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange('password')}
              placeholder="••••••••"
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-500">{success}</p> : null}
          <DialogFooter className="flex-row-reverse justify-between gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Autenticando...' : 'Gerar token'}
            </Button>
            <p className="text-xs text-muted-foreground">{statusLabel}</p>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
