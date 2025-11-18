import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.jsx';
import type { TenantFormState } from '../types';

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const normalizeSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const defaultState: TenantFormState = {
  name: '',
  slug: '',
  isActive: true,
  adminEmail: '',
  adminPassword: '',
  settingsText: '{\n  "timezone": "America/Sao_Paulo"\n}',
};

export interface TenantFormProps {
  mode: 'create' | 'edit';
  defaultValues?: TenantFormState | null;
  loading?: boolean;
  submitting?: boolean;
  toggleLoading?: boolean;
  onSubmit: (values: TenantFormState) => Promise<void> | void;
  onToggleActive?: (isActive: boolean) => Promise<void> | void;
}

const TenantForm = ({
  mode,
  defaultValues,
  loading,
  submitting,
  toggleLoading,
  onSubmit,
  onToggleActive,
}: TenantFormProps) => {
  const [formState, setFormState] = useState<TenantFormState>(defaultState);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultValues) {
      setFormState(defaultValues);
    }
  }, [defaultValues]);

  const handleChange = (field: keyof TenantFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      if (field === 'slug') {
        setFormState((prev) => ({ ...prev, slug: normalizeSlug(value) }));
      } else {
        setFormState((prev) => ({ ...prev, [field]: value }));
      }
    };

  const handleStatusChange = (checked: boolean) => {
    setFormState((prev) => ({ ...prev, isActive: checked }));
    if (mode === 'edit') {
      onToggleActive?.(checked);
    }
  };

  const validate = (): boolean => {
    if (!formState.name.trim()) {
      setError('Informe o nome do tenant.');
      return false;
    }
    if (!slugRegex.test(formState.slug)) {
      setError('Slug inválido. Utilize apenas letras minúsculas, números e hifens.');
      return false;
    }
    if (mode === 'create') {
      if (!formState.adminEmail.trim()) {
        setError('Informe o e-mail do administrador do tenant.');
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.adminEmail.trim())) {
        setError('Informe um e-mail válido para o administrador.');
        return false;
      }
      if (!formState.adminPassword || formState.adminPassword.length < 8) {
        setError('Defina uma senha com pelo menos 8 caracteres para o administrador.');
        return false;
      }
    }
    if (formState.settingsText.trim()) {
      try {
        JSON.parse(formState.settingsText);
      } catch (err) {
        setError('JSON de settings inválido.');
        console.error(err);
        return false;
      }
    }
    setError(null);
    return true;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }
    await onSubmit(formState);
  };

  const isLoading = loading && !defaultValues;

  const statusHint = useMemo(
    () => (formState.isActive ? 'Tenant estará disponível imediatamente após salvar.' : 'Tenant ficará suspenso.'),
    [formState.isActive]
  );

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tenant-name">Nome</Label>
          <Input
            id="tenant-name"
            value={formState.name}
            onChange={handleChange('name')}
            placeholder="Lead Engine Corp"
            required
            disabled={isLoading || submitting}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tenant-slug">Slug</Label>
          <Input
            id="tenant-slug"
            value={formState.slug}
            onChange={handleChange('slug')}
            placeholder="lead-engine-corp"
            required
            disabled={isLoading || submitting}
          />
          <p className="text-xs text-muted-foreground">Usado em URLs e integrações. Somente minúsculas, números e hifens.</p>
        </div>
      </div>

      {mode === 'create' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tenant-admin-email">E-mail do administrador</Label>
            <Input
              id="tenant-admin-email"
              type="email"
              value={formState.adminEmail}
              onChange={handleChange('adminEmail')}
              placeholder="admin@tenant.com"
              required
              disabled={isLoading || submitting}
            />
            <p className="text-xs text-muted-foreground">Será usado como login inicial do tenant.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenant-admin-password">Senha provisória</Label>
            <Input
              id="tenant-admin-password"
              type="password"
              value={formState.adminPassword}
              onChange={handleChange('adminPassword')}
              placeholder="********"
              required
              disabled={isLoading || submitting}
            />
            <p className="text-xs text-muted-foreground">O admin poderá trocá-la depois.</p>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Status</p>
            <p className="text-xs text-muted-foreground">{statusHint}</p>
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Inativo</span>
            <Switch
              checked={formState.isActive}
              onCheckedChange={handleStatusChange}
              disabled={toggleLoading || (mode === 'create' && submitting)}
              aria-label="Alternar status do tenant"
            />
            <span className="text-xs text-muted-foreground">Ativo</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tenant-settings">Settings (JSON)</Label>
        <Textarea
          id="tenant-settings"
          value={formState.settingsText}
          onChange={handleChange('settingsText')}
          rows={10}
          disabled={submitting}
        />
        <p className="text-xs text-muted-foreground">
          Campo genérico para preferências e feature flags simples. A área de planos & capabilities consumirá estes dados futuramente.
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Plano & Recursos (em breve)</p>
        <p>
          Assim que os módulos de Plan/Feature estiverem disponíveis, esta seção exibirá o plano atual, limites e feature flags do tenant.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Não foi possível salvar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={submitting || isLoading}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
            </>
          ) : mode === 'create' ? (
            'Criar tenant'
          ) : (
            'Salvar alterações'
          )}
        </Button>
      </div>
    </form>
  );
};

export default TenantForm;
