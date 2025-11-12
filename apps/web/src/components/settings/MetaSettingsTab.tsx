import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { AlertCircle, Loader2, Save } from 'lucide-react';

type MetaOfflineConfig = {
  offlineEventSetId: string | null;
  pixelId: string | null;
  businessId: string | null;
  appId: string | null;
  actionSource: string | null;
  eventName: string | null;
  reprocessUnmatched: boolean;
  reprocessUnsent: boolean;
  reprocessWindowDays: number | null;
  connected: boolean;
  lastValidatedAt: string | null;
  lastValidationError: string | null;
  accessTokenConfigured: boolean;
  appSecretConfigured: boolean;
};

type MetaFormState = {
  offlineEventSetId: string;
  pixelId: string;
  businessId: string;
  appId: string;
  actionSource: string;
  eventName: string;
  reprocessUnmatched: boolean;
  reprocessUnsent: boolean;
  reprocessWindowDays: string;
  accessToken: string;
  appSecret: string;
};

const DEFAULT_CONFIG: MetaOfflineConfig = {
  offlineEventSetId: null,
  pixelId: null,
  businessId: null,
  appId: null,
  actionSource: null,
  eventName: null,
  reprocessUnmatched: false,
  reprocessUnsent: false,
  reprocessWindowDays: null,
  connected: false,
  lastValidatedAt: null,
  lastValidationError: null,
  accessTokenConfigured: false,
  appSecretConfigured: false,
};

const EMPTY_FORM: MetaFormState = {
  offlineEventSetId: '',
  pixelId: '',
  businessId: '',
  appId: '',
  actionSource: '',
  eventName: '',
  reprocessUnmatched: false,
  reprocessUnsent: false,
  reprocessWindowDays: '',
  accessToken: '',
  appSecret: '',
};

const formatTimestamp = (value: string | null): string | null => {
  if (!value) return null;
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toLocaleString();
  } catch {
    return null;
  }
};

const MetaSettingsTab = () => {
  const [config, setConfig] = useState<MetaOfflineConfig>(DEFAULT_CONFIG);
  const [form, setForm] = useState<MetaFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [accessTokenChanged, setAccessTokenChanged] = useState(false);
  const [appSecretChanged, setAppSecretChanged] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      setStatusMessage(null);
      try {
        const response = await fetch('/api/integrations/meta/offline-conversions/config');
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message =
            (payload && typeof payload === 'object' && payload !== null && 'message' in payload
              ? (payload as { message?: string }).message
              : null) ?? `Falha ao carregar configurações (${response.status})`;
          throw new Error(message);
        }
        const payload = await response.json();
        const data = (payload?.data ?? DEFAULT_CONFIG) as MetaOfflineConfig;
        if (!mounted) return;
        setConfig({ ...DEFAULT_CONFIG, ...data });
        setForm({
          offlineEventSetId: data.offlineEventSetId ?? '',
          pixelId: data.pixelId ?? '',
          businessId: data.businessId ?? '',
          appId: data.appId ?? '',
          actionSource: data.actionSource ?? '',
          eventName: data.eventName ?? '',
          reprocessUnmatched: Boolean(data.reprocessUnmatched),
          reprocessUnsent: Boolean(data.reprocessUnsent),
          reprocessWindowDays:
            typeof data.reprocessWindowDays === 'number' && Number.isFinite(data.reprocessWindowDays)
              ? String(data.reprocessWindowDays)
              : '',
          accessToken: '',
          appSecret: '',
        });
        setAccessTokenChanged(false);
        setAppSecretChanged(false);
      } catch (err) {
        if (!mounted) return;
        setError((err as Error).message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const connectedBadge = useMemo(() => {
    return config.connected ? (
      <Badge variant="default">Meta conectado</Badge>
    ) : (
      <Badge variant="secondary">Meta desconectado</Badge>
    );
  }, [config.connected]);

  const lastValidationText = useMemo(() => formatTimestamp(config.lastValidatedAt), [config.lastValidatedAt]);

  const handleFieldChange = <K extends keyof MetaFormState>(key: K, value: MetaFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSecretChange = (key: 'accessToken' | 'appSecret', value: string) => {
    handleFieldChange(key, value);
    if (key === 'accessToken') {
      setAccessTokenChanged(true);
    }
    if (key === 'appSecret') {
      setAppSecretChanged(true);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setStatusMessage(null);

    const payload: Record<string, unknown> = {
      offlineEventSetId: form.offlineEventSetId.trim() || null,
      pixelId: form.pixelId.trim() || null,
      businessId: form.businessId.trim() || null,
      appId: form.appId.trim() || null,
      actionSource: form.actionSource.trim() || null,
      eventName: form.eventName.trim() || null,
      reprocessUnmatched: form.reprocessUnmatched,
      reprocessUnsent: form.reprocessUnsent,
    };

    const windowDaysRaw = form.reprocessWindowDays.trim();
    if (windowDaysRaw) {
      const parsedWindow = Number(windowDaysRaw);
      if (!Number.isFinite(parsedWindow) || parsedWindow < 1) {
        setError('Informe um número válido de dias para reprocessamento.');
        setSaving(false);
        return;
      }
      payload.reprocessWindowDays = parsedWindow;
    } else {
      payload.reprocessWindowDays = null;
    }

    if (accessTokenChanged) {
      payload.accessToken = form.accessToken.trim() || null;
    }
    if (appSecretChanged) {
      payload.appSecret = form.appSecret.trim() || null;
    }

    try {
      const response = await fetch('/api/integrations/meta/offline-conversions/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message =
          (body && typeof body === 'object' && body !== null && 'message' in body
            ? (body as { message?: string }).message
            : null) ?? 'Não foi possível salvar as configurações Meta.';
        throw new Error(message);
      }

      const result = await response.json();
      const data = (result?.data ?? DEFAULT_CONFIG) as MetaOfflineConfig;
      setConfig({ ...DEFAULT_CONFIG, ...data });
      setForm({
        offlineEventSetId: data.offlineEventSetId ?? '',
        pixelId: data.pixelId ?? '',
        businessId: data.businessId ?? '',
        appId: data.appId ?? '',
        actionSource: data.actionSource ?? '',
        eventName: data.eventName ?? '',
        reprocessUnmatched: Boolean(data.reprocessUnmatched),
        reprocessUnsent: Boolean(data.reprocessUnsent),
        reprocessWindowDays:
          typeof data.reprocessWindowDays === 'number' && Number.isFinite(data.reprocessWindowDays)
            ? String(data.reprocessWindowDays)
            : '',
        accessToken: '',
        appSecret: '',
      });
      setAccessTokenChanged(false);
      setAppSecretChanged(false);
      setStatusMessage('Configurações salvas com sucesso!');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const disabled = loading || saving;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <CardTitle>Conversões offline da Meta</CardTitle>
            <CardDescription>
              Configure as credenciais para enviar eventos offline ao Meta Ads Manager e acompanhe o status da integração.
            </CardDescription>
            {lastValidationText && (
              <p className="text-xs textForegroundMuted">Última validação: {lastValidationText}</p>
            )}
            {config.lastValidationError && (
              <p className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" /> Último erro: {config.lastValidationError}
              </p>
            )}
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            {connectedBadge}
            <Button onClick={handleSave} disabled={disabled}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? 'Salvando...' : 'Salvar configurações'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {statusMessage && (
            <p className="text-sm text-emerald-600">{statusMessage}</p>
          )}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="offline-event-set-id">Offline Event Set ID</Label>
                <Input
                  id="offline-event-set-id"
                  value={form.offlineEventSetId}
                  onChange={(event) => handleFieldChange('offlineEventSetId', event.target.value)}
                  placeholder="Ex.: 1234567890"
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pixel-id">Pixel ID</Label>
                <Input
                  id="pixel-id"
                  value={form.pixelId}
                  onChange={(event) => handleFieldChange('pixelId', event.target.value)}
                  placeholder="Ex.: 1234567890"
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-id">Business Manager ID</Label>
                <Input
                  id="business-id"
                  value={form.businessId}
                  onChange={(event) => handleFieldChange('businessId', event.target.value)}
                  placeholder="Ex.: 123456789012345"
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="app-id">App ID</Label>
                <Input
                  id="app-id"
                  value={form.appId}
                  onChange={(event) => handleFieldChange('appId', event.target.value)}
                  placeholder="Ex.: 123456789012345"
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="action-source">Fonte da ação</Label>
                <Input
                  id="action-source"
                  value={form.actionSource}
                  onChange={(event) => handleFieldChange('actionSource', event.target.value)}
                  placeholder="Ex.: phone_call, chat, website"
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-name">Nome do evento</Label>
                <Input
                  id="event-name"
                  value={form.eventName}
                  onChange={(event) => handleFieldChange('eventName', event.target.value)}
                  placeholder="Ex.: Lead" 
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reprocess-window">Janela de reprocessamento (dias)</Label>
                <Input
                  id="reprocess-window"
                  type="number"
                  min={1}
                  value={form.reprocessWindowDays}
                  onChange={(event) => handleFieldChange('reprocessWindowDays', event.target.value)}
                  placeholder="Ex.: 30"
                  disabled={disabled}
                />
              </div>
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="reprocess-unmatched">Reprocessar contatos sem correspondência</Label>
                    <p className="text-xs textForegroundMuted">
                      Reenvia eventos que não tiveram correspondência de cliente.
                    </p>
                  </div>
                  <Switch
                    id="reprocess-unmatched"
                    checked={form.reprocessUnmatched}
                    onCheckedChange={(checked) => handleFieldChange('reprocessUnmatched', checked)}
                    disabled={disabled}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="reprocess-unsent">Reprocessar envios pendentes</Label>
                    <p className="text-xs textForegroundMuted">
                      Tenta novamente eventos que falharam por indisponibilidade da API.
                    </p>
                  </div>
                  <Switch
                    id="reprocess-unsent"
                    checked={form.reprocessUnsent}
                    onCheckedChange={(checked) => handleFieldChange('reprocessUnsent', checked)}
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="access-token">Access Token</Label>
              <Input
                id="access-token"
                type="password"
                value={form.accessToken}
                placeholder={config.accessTokenConfigured && !accessTokenChanged ? 'Token configurado' : 'Informe o token da Graph API'}
                onChange={(event) => handleSecretChange('accessToken', event.target.value)}
                disabled={disabled}
                autoComplete="new-password"
              />
              {config.accessTokenConfigured && !accessTokenChanged && (
                <p className="text-xs textForegroundMuted">Um token já está salvo. Preencha o campo para substituir.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-secret">App Secret</Label>
              <Input
                id="app-secret"
                type="password"
                value={form.appSecret}
                placeholder={config.appSecretConfigured && !appSecretChanged ? 'Segredo configurado' : 'Informe o app secret'}
                onChange={(event) => handleSecretChange('appSecret', event.target.value)}
                disabled={disabled}
                autoComplete="new-password"
              />
              {config.appSecretConfigured && !appSecretChanged && (
                <p className="text-xs textForegroundMuted">Um app secret já está salvo. Preencha o campo para substituir.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MetaSettingsTab;
