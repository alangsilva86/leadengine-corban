import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { useAuth } from './AuthProvider.jsx';
import { getTenantId, getTenantSlugHint } from '@/lib/auth.js';
import { getEnvVar } from '@/lib/runtime-env.js';
const resolveEnvString = (value) => (typeof value === 'string' ? value : '');
const storedTenantSlugHint = getTenantSlugHint() ?? '';
const storedTenantId = getTenantId() ?? '';
const defaultTenantHint = resolveEnvString(getEnvVar('VITE_DEFAULT_TENANT_HINT', ''));
const initialTenant = storedTenantSlugHint || defaultTenantHint || storedTenantId;
const prefillEmail = resolveEnvString(getEnvVar('VITE_AUTH_PREFILL_EMAIL', ''));
const prefillPassword = resolveEnvString(getEnvVar('VITE_AUTH_PREFILL_PASSWORD', ''));
const normalize = (value) => value.trim();
const resolveErrorMessage = (error) => {
    if (!error)
        return 'Não foi possível concluir a operação.';
    if (typeof error === 'string')
        return error;
    if (error instanceof Error)
        return error.message || 'Falha ao processar a operação.';
    return 'Falha inesperada ao processar a operação.';
};
export default function LoginPage() {
    const navigate = useNavigate();
    const { status, loading, login, recoverPassword } = useAuth();
    const [mode, setMode] = useState('login');
    const [form, setForm] = useState({
        email: prefillEmail,
        password: prefillPassword,
        tenantSlug: initialTenant,
        remember: false,
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
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
    const handleChange = (field) => (event) => {
        const value = event.target.value;
        setForm((prev) => ({ ...prev, [field]: value }));
    };
    const handleSubmit = async (event) => {
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
                    remember: Boolean(form.remember),
                });
                navigate('/', { replace: true });
            }
            else {
                await recoverPassword({
                    email: normalize(form.email),
                    tenantSlug: form.tenantSlug ? normalize(form.tenantSlug) : undefined,
                });
                setMode('login');
            }
        }
        catch (err) {
            setError(resolveErrorMessage(err));
        }
        finally {
            setSubmitting(false);
        }
    };
    const toggleMode = () => {
        setMode((current) => (current === 'login' ? 'recover' : 'login'));
        setError(null);
    };
    return (_jsx("div", { className: "flex min-h-screen flex-col items-center justify-center bg-muted/50 px-4 py-12", children: _jsxs(Card, { className: "w-full max-w-md", children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { className: "text-2xl font-semibold", children: mode === 'login' ? 'Acesse sua conta' : 'Recuperar acesso' }), _jsx(CardDescription, { children: mode === 'login'
                                ? 'Informe suas credenciais e o tenant para iniciar uma nova sessão segura.'
                                : 'Enviaremos um link de redefinição para o e-mail cadastrado.' })] }), _jsxs(CardContent, { children: [_jsxs("form", { className: "space-y-4", onSubmit: handleSubmit, children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "email", children: "E-mail corporativo" }), _jsx(Input, { id: "email", type: "email", autoComplete: "email", placeholder: "voce@empresa.com", value: form.email, onChange: handleChange('email'), disabled: formDisabled, required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "tenant", children: "Tenant / empresa" }), _jsx(Input, { id: "tenant", placeholder: "ex.: leadengine", value: form.tenantSlug, onChange: handleChange('tenantSlug'), disabled: formDisabled, required: true })] }), mode === 'login' ? (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "password", children: "Senha" }), _jsx(Input, { id: "password", type: "password", autoComplete: "current-password", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", value: form.password, onChange: handleChange('password'), disabled: formDisabled, required: true })] })) : null, _jsx("div", { className: "flex items-center justify-between gap-2", children: _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Checkbox, { id: "remember", checked: form.remember, onCheckedChange: (checked) => setForm((prev) => ({ ...prev, remember: Boolean(checked) })), disabled: formDisabled }), _jsx(Label, { htmlFor: "remember", className: "cursor-pointer text-sm", children: "Lembrar de mim" })] }) }), error ? _jsx("p", { className: "text-sm text-destructive", children: error }) : null, _jsx(Button, { type: "submit", className: "w-full", disabled: !canSubmit || formDisabled, children: mode === 'login' ? 'Entrar' : 'Enviar instruções' })] }), _jsx(Separator, { className: "my-6" }), _jsxs("div", { className: "space-y-2 text-center text-sm text-muted-foreground", children: [mode === 'login' ? (_jsx("button", { type: "button", className: "text-primary underline-offset-2 hover:underline", onClick: toggleMode, disabled: formDisabled, children: "Esqueci minha senha" })) : (_jsx("button", { type: "button", className: "text-primary underline-offset-2 hover:underline", onClick: toggleMode, disabled: formDisabled, children: "Voltar para o login" })), _jsxs("p", { children: ["Precisa de ajuda? Entre em contato com o suporte ou", ' ', _jsx(Link, { to: "/", className: "text-primary underline-offset-2 hover:underline", children: "volte para a p\u00E1gina inicial" }), "."] })] })] })] }) }));
}
