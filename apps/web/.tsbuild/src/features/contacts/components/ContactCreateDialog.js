import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select.jsx';
const STATUS_OPTIONS = [
    { value: 'ACTIVE', label: 'Ativo' },
    { value: 'INACTIVE', label: 'Inativo' },
    { value: 'ARCHIVED', label: 'Arquivado' },
];
const DEFAULT_VALUES = {
    name: '',
    phone: '',
    email: '',
    document: '',
    status: 'ACTIVE',
    notes: '',
    isBlocked: false,
};
const ContactCreateDialog = ({ open, onOpenChange, onSubmit }) => {
    const [values, setValues] = useState(DEFAULT_VALUES);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    useEffect(() => {
        if (!open) {
            return;
        }
        setValues(DEFAULT_VALUES);
        setError(null);
        setSubmitting(false);
    }, [open]);
    const canSubmit = useMemo(() => values.name.trim().length > 0, [values.name]);
    const handleClose = (nextOpen) => {
        if (submitting) {
            return;
        }
        onOpenChange?.(nextOpen);
    };
    const setField = (field, nextValue) => {
        setValues((prev) => ({ ...prev, [field]: nextValue }));
    };
    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!canSubmit || submitting) {
            return;
        }
        setSubmitting(true);
        setError(null);
        const payload = {
            name: values.name.trim(),
            phone: values.phone.trim() || undefined,
            email: values.email.trim() || undefined,
            document: values.document.trim() || undefined,
            status: values.status,
            isBlocked: values.isBlocked || undefined,
            notes: values.notes.trim() || undefined,
        };
        try {
            await onSubmit?.(payload);
            onOpenChange?.(false);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Não foi possível criar o contato. Tente novamente.';
            setError(message);
        }
        finally {
            setSubmitting(false);
        }
    };
    return (_jsx(Dialog, { open: open, onOpenChange: handleClose, children: _jsxs(DialogContent, { className: "max-w-xl", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Novo contato" }), _jsx(DialogDescription, { children: "Cadastre rapidamente um contato para iniciar um atendimento ou disparar uma campanha." })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-5", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "contact-create-name", children: "Nome completo" }), _jsx(Input, { id: "contact-create-name", value: values.name, onChange: (event) => setField('name', event.target.value), placeholder: "Nome do contato", required: true, autoFocus: true, disabled: submitting })] }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "contact-create-phone", children: "Telefone" }), _jsx(Input, { id: "contact-create-phone", value: values.phone, onChange: (event) => setField('phone', event.target.value), placeholder: "(11) 99999-0000", disabled: submitting })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "contact-create-email", children: "E-mail" }), _jsx(Input, { id: "contact-create-email", type: "email", value: values.email, onChange: (event) => setField('email', event.target.value), placeholder: "cliente@empresa.com", disabled: submitting })] })] }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "contact-create-document", children: "Documento" }), _jsx(Input, { id: "contact-create-document", value: values.document, onChange: (event) => setField('document', event.target.value), placeholder: "CPF/CNPJ (opcional)", disabled: submitting })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "contact-create-status", children: "Status" }), _jsxs(Select, { value: values.status, onValueChange: (nextStatus) => setField('status', nextStatus), disabled: submitting, children: [_jsx(SelectTrigger, { id: "contact-create-status", children: _jsx(SelectValue, { placeholder: "Selecione o status" }) }), _jsx(SelectContent, { children: STATUS_OPTIONS.map((option) => (_jsx(SelectItem, { value: option.value, children: option.label }, option.value))) })] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "contact-create-notes", children: "Notas internas" }), _jsx(Textarea, { id: "contact-create-notes", value: values.notes, onChange: (event) => setField('notes', event.target.value), placeholder: "Contexto inicial, prefer\u00EAncias ou instru\u00E7\u00F5es importantes.", rows: 4, disabled: submitting })] }), _jsxs("label", { className: "flex items-center gap-2 text-sm font-medium", children: [_jsx(Checkbox, { checked: values.isBlocked, onCheckedChange: (nextValue) => setField('isBlocked', Boolean(nextValue)), disabled: submitting }), "Bloquear contato para campanhas autom\u00E1ticas"] }), error ? (_jsxs("div", { className: "flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive", children: [_jsx(AlertCircle, { className: "mt-0.5 h-4 w-4 flex-none" }), _jsx("span", { children: error })] })) : null, _jsxs(DialogFooter, { className: "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", children: [_jsx(Button, { type: "button", variant: "ghost", disabled: submitting, onClick: () => handleClose(false), children: "Cancelar" }), _jsx(Button, { type: "submit", disabled: !canSubmit || submitting, children: submitting ? 'Criando...' : 'Criar contato' })] })] })] }) }));
};
export default ContactCreateDialog;
