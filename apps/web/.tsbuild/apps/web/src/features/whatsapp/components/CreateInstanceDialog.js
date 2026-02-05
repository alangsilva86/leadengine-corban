import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { AlertCircle } from 'lucide-react';
const CreateInstanceDialog = ({ open, onOpenChange, defaultName, onSubmit, disabledReason = null, }) => {
    const suggestedName = defaultName || 'Novo canal';
    const [name, setName] = useState(suggestedName);
    const [identifier, setIdentifier] = useState('');
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const normalizeIdentifier = (value) => value
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase();
    const identifierValidation = useMemo(() => {
        const normalized = normalizeIdentifier(identifier);
        const trimmed = identifier.trim();
        if (!trimmed) {
            return {
                normalized: '',
                isValid: true,
                message: null,
                hasSuggestion: false,
            };
        }
        const regex = /^[a-z0-9-_.]+$/;
        const isValid = regex.test(normalized);
        const message = isValid
            ? null
            : 'Use apenas letras minúsculas, números, hífen, ponto ou sublinhado.';
        return {
            normalized,
            isValid,
            message,
            hasSuggestion: normalized !== trimmed,
        };
    }, [identifier]);
    useEffect(() => {
        if (!open) {
            return;
        }
        setName(suggestedName);
        setIdentifier('');
        setError(null);
    }, [open, suggestedName]);
    const canSubmit = useMemo(() => {
        return name.trim().length > 0 && identifierValidation.isValid && !disabledReason;
    }, [disabledReason, identifierValidation.isValid, name]);
    const handleClose = (nextOpen) => {
        if (submitting) {
            return;
        }
        onOpenChange?.(nextOpen);
    };
    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!canSubmit || submitting) {
            if (disabledReason) {
                setError(disabledReason);
            }
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await onSubmit?.({
                name: name.trim(),
                id: identifierValidation.normalized || undefined,
            });
            onOpenChange?.(false);
        }
        catch (err) {
            const suggestedId = err && typeof err === 'object' && err?.suggestedId
                ? String(err.suggestedId)
                : err && typeof err === 'object' && err?.payload?.error?.details?.suggestedId
                    ? String(err.payload.error.details.suggestedId)
                    : null;
            if (suggestedId) {
                setIdentifier(suggestedId);
            }
            const message = err instanceof Error ? err.message : 'Não foi possível criar a instância.';
            setError(message);
        }
        finally {
            setSubmitting(false);
        }
    };
    return (_jsx(Dialog, { open: open, onOpenChange: handleClose, children: _jsxs(DialogContent, { className: "max-w-lg", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Novo canal do WhatsApp" }), _jsx(DialogDescription, { children: "Defina o nome que aparecer\u00E1 para o time e personalize, se necess\u00E1rio, o identificador utilizado nas integra\u00E7\u00F5es." }), _jsx("p", { className: "mt-2 text-xs text-muted-foreground", children: "Ap\u00F3s concluir, o canal ser\u00E1 listado automaticamente no painel de inst\u00E2ncias para gera\u00E7\u00E3o de QR Codes e monitoramento." })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "instance-name", children: "Nome do canal" }), _jsx(Input, { id: "instance-name", value: name, onChange: (event) => setName(event.target.value), placeholder: "Canal principal de WhatsApp", disabled: submitting, required: true }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Esse nome aparece para os operadores e nas listagens do Lead Engine." })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "instance-id", children: "Identificador do canal (opcional)" }), _jsx(Input, { id: "instance-id", value: identifier, onChange: (event) => {
                                        setIdentifier(event.target.value);
                                    }, placeholder: "Ex.: whatsapp-vendas", disabled: submitting }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Esse identificador ser\u00E1 enviado para as integra\u00E7\u00F5es exatamente como voc\u00EA digitar." }), identifierValidation.message ? (_jsx("p", { className: "text-xs text-destructive", children: identifierValidation.message })) : null, !identifierValidation.message && identifierValidation.hasSuggestion ? (_jsxs("p", { className: "text-xs text-muted-foreground", children: ["Sugest\u00E3o autom\u00E1tica: ", _jsx("strong", { children: identifierValidation.normalized })] })) : null] }), disabledReason ? (_jsxs("div", { className: "flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100", children: [_jsx(AlertCircle, { className: "h-4 w-4" }), _jsx("span", { children: disabledReason })] })) : null, error ? (_jsxs("div", { className: "flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive", children: [_jsx(AlertCircle, { className: "h-4 w-4" }), _jsx("span", { children: error })] })) : null, _jsxs(DialogFooter, { className: "mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", children: [_jsx(Button, { type: "button", variant: "ghost", disabled: submitting, onClick: () => handleClose(false), children: "Cancelar" }), _jsx(Button, { type: "submit", disabled: !canSubmit || submitting, children: submitting ? 'Criando…' : 'Criar canal' })] })] })] }) }));
};
export default CreateInstanceDialog;
