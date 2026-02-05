import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { AlertCircle, Loader2, Save } from 'lucide-react';
const DEFAULT_CONFIG = {
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
const EMPTY_FORM = {
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
const formatTimestamp = (value) => {
    if (!value)
        return null;
    try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        return date.toLocaleString();
    }
    catch {
        return null;
    }
};
const MetaSettingsTab = () => {
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [form, setForm] = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [statusMessage, setStatusMessage] = useState(null);
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
                    const message = (payload && typeof payload === 'object' && payload !== null && 'message' in payload
                        ? payload.message
                        : null) ?? `Falha ao carregar configurações (${response.status})`;
                    throw new Error(message);
                }
                const payload = await response.json();
                const data = (payload?.data ?? DEFAULT_CONFIG);
                if (!mounted)
                    return;
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
                    reprocessWindowDays: typeof data.reprocessWindowDays === 'number' && Number.isFinite(data.reprocessWindowDays)
                        ? String(data.reprocessWindowDays)
                        : '',
                    accessToken: '',
                    appSecret: '',
                });
                setAccessTokenChanged(false);
                setAppSecretChanged(false);
            }
            catch (err) {
                if (!mounted)
                    return;
                setError(err.message);
            }
            finally {
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
        return config.connected ? (_jsx(Badge, { variant: "default", children: "Meta conectado" })) : (_jsx(Badge, { variant: "secondary", children: "Meta desconectado" }));
    }, [config.connected]);
    const lastValidationText = useMemo(() => formatTimestamp(config.lastValidatedAt), [config.lastValidatedAt]);
    const handleFieldChange = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };
    const handleSecretChange = (key, value) => {
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
        const payload = {
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
        }
        else {
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
                const message = (body && typeof body === 'object' && body !== null && 'message' in body
                    ? body.message
                    : null) ?? 'Não foi possível salvar as configurações Meta.';
                throw new Error(message);
            }
            const result = await response.json();
            const data = (result?.data ?? DEFAULT_CONFIG);
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
                reprocessWindowDays: typeof data.reprocessWindowDays === 'number' && Number.isFinite(data.reprocessWindowDays)
                    ? String(data.reprocessWindowDays)
                    : '',
                accessToken: '',
                appSecret: '',
            });
            setAccessTokenChanged(false);
            setAppSecretChanged(false);
            setStatusMessage('Configurações salvas com sucesso!');
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setSaving(false);
        }
    };
    const disabled = loading || saving;
    return (_jsx("div", { className: "space-y-6", children: _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-col gap-4 md:flex-row md:items-start md:justify-between", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(CardTitle, { children: "Convers\u00F5es offline da Meta" }), _jsx(CardDescription, { children: "Configure as credenciais para enviar eventos offline ao Meta Ads Manager e acompanhe o status da integra\u00E7\u00E3o." }), lastValidationText && (_jsxs("p", { className: "text-xs textForegroundMuted", children: ["\u00DAltima valida\u00E7\u00E3o: ", lastValidationText] })), config.lastValidationError && (_jsxs("p", { className: "flex items-center gap-2 text-xs text-destructive", children: [_jsx(AlertCircle, { className: "h-3.5 w-3.5" }), " \u00DAltimo erro: ", config.lastValidationError] }))] }), _jsxs("div", { className: "flex flex-col items-start gap-3 md:items-end", children: [connectedBadge, _jsxs(Button, { onClick: handleSave, disabled: disabled, children: [saving ? _jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" }) : _jsx(Save, { className: "mr-2 h-4 w-4" }), saving ? 'Salvando...' : 'Salvar configurações'] })] })] }), _jsxs(CardContent, { className: "space-y-6", children: [statusMessage && (_jsx("p", { className: "text-sm text-emerald-600", children: statusMessage })), error && (_jsxs("div", { className: "flex items-center gap-2 text-sm text-destructive", children: [_jsx(AlertCircle, { className: "h-4 w-4" }), _jsx("span", { children: error })] })), _jsxs("div", { className: "grid gap-6 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "offline-event-set-id", children: "Offline Event Set ID" }), _jsx(Input, { id: "offline-event-set-id", value: form.offlineEventSetId, onChange: (event) => handleFieldChange('offlineEventSetId', event.target.value), placeholder: "Ex.: 1234567890", disabled: disabled })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "pixel-id", children: "Pixel ID" }), _jsx(Input, { id: "pixel-id", value: form.pixelId, onChange: (event) => handleFieldChange('pixelId', event.target.value), placeholder: "Ex.: 1234567890", disabled: disabled })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "business-id", children: "Business Manager ID" }), _jsx(Input, { id: "business-id", value: form.businessId, onChange: (event) => handleFieldChange('businessId', event.target.value), placeholder: "Ex.: 123456789012345", disabled: disabled })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "app-id", children: "App ID" }), _jsx(Input, { id: "app-id", value: form.appId, onChange: (event) => handleFieldChange('appId', event.target.value), placeholder: "Ex.: 123456789012345", disabled: disabled })] })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "action-source", children: "Fonte da a\u00E7\u00E3o" }), _jsx(Input, { id: "action-source", value: form.actionSource, onChange: (event) => handleFieldChange('actionSource', event.target.value), placeholder: "Ex.: phone_call, chat, website", disabled: disabled })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "event-name", children: "Nome do evento" }), _jsx(Input, { id: "event-name", value: form.eventName, onChange: (event) => handleFieldChange('eventName', event.target.value), placeholder: "Ex.: Lead", disabled: disabled })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "reprocess-window", children: "Janela de reprocessamento (dias)" }), _jsx(Input, { id: "reprocess-window", type: "number", min: 1, value: form.reprocessWindowDays, onChange: (event) => handleFieldChange('reprocessWindowDays', event.target.value), placeholder: "Ex.: 30", disabled: disabled })] }), _jsxs("div", { className: "grid gap-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-1", children: [_jsx(Label, { htmlFor: "reprocess-unmatched", children: "Reprocessar contatos sem correspond\u00EAncia" }), _jsx("p", { className: "text-xs textForegroundMuted", children: "Reenvia eventos que n\u00E3o tiveram correspond\u00EAncia de cliente." })] }), _jsx(Switch, { id: "reprocess-unmatched", checked: form.reprocessUnmatched, onCheckedChange: (checked) => handleFieldChange('reprocessUnmatched', checked), disabled: disabled })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-1", children: [_jsx(Label, { htmlFor: "reprocess-unsent", children: "Reprocessar envios pendentes" }), _jsx("p", { className: "text-xs textForegroundMuted", children: "Tenta novamente eventos que falharam por indisponibilidade da API." })] }), _jsx(Switch, { id: "reprocess-unsent", checked: form.reprocessUnsent, onCheckedChange: (checked) => handleFieldChange('reprocessUnsent', checked), disabled: disabled })] })] })] })] }), _jsxs("div", { className: "grid gap-6 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "access-token", children: "Access Token" }), _jsx(Input, { id: "access-token", type: "password", value: form.accessToken, placeholder: config.accessTokenConfigured && !accessTokenChanged ? 'Token configurado' : 'Informe o token da Graph API', onChange: (event) => handleSecretChange('accessToken', event.target.value), disabled: disabled, autoComplete: "new-password" }), config.accessTokenConfigured && !accessTokenChanged && (_jsx("p", { className: "text-xs textForegroundMuted", children: "Um token j\u00E1 est\u00E1 salvo. Preencha o campo para substituir." }))] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "app-secret", children: "App Secret" }), _jsx(Input, { id: "app-secret", type: "password", value: form.appSecret, placeholder: config.appSecretConfigured && !appSecretChanged ? 'Segredo configurado' : 'Informe o app secret', onChange: (event) => handleSecretChange('appSecret', event.target.value), disabled: disabled, autoComplete: "new-password" }), config.appSecretConfigured && !appSecretChanged && (_jsx("p", { className: "text-xs textForegroundMuted", children: "Um app secret j\u00E1 est\u00E1 salvo. Preencha o campo para substituir." }))] })] })] })] }) }));
};
export default MetaSettingsTab;
