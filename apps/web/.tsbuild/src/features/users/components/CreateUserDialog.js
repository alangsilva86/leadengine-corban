import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { normalizePersonName } from '@/lib/normalizers.ts';
const defaultForm = {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'AGENT',
};
const CreateUserDialog = ({ open, onOpenChange, onSubmit, submitting = false }) => {
    const [form, setForm] = useState(defaultForm);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (open) {
            return;
        }
        setForm(defaultForm);
        setError(null);
    }, [open]);
    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };
    const handleSubmit = (event) => {
        event.preventDefault();
        if (!form.name.trim()) {
            setError('Informe o nome completo.');
            return;
        }
        if (!form.email.trim()) {
            setError('Informe o e-mail corporativo.');
            return;
        }
        if (form.password.length < 8) {
            setError('A senha precisa ter ao menos 8 caracteres.');
            return;
        }
        if (form.password !== form.confirmPassword) {
            setError('As senhas informadas não coincidem.');
            return;
        }
        setError(null);
        onSubmit({
            name: normalizePersonName(form.name),
            email: form.email.trim(),
            password: form.password,
            role: form.role,
        });
    };
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsx(DialogContent, { children: _jsxs("form", { className: "space-y-4", onSubmit: handleSubmit, children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Novo usu\u00E1rio" }), _jsx(DialogDescription, { children: "Conceda acesso imediato a um operador interno." })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "user-name", children: "Nome completo" }), _jsx(Input, { id: "user-name", name: "name", value: form.name, onChange: handleChange, disabled: submitting, required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "user-email", children: "E-mail corporativo" }), _jsx(Input, { id: "user-email", type: "email", name: "email", value: form.email, onChange: handleChange, disabled: submitting, required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "user-role", children: "Fun\u00E7\u00E3o" }), _jsxs(Select, { value: form.role, onValueChange: (value) => setForm((prev) => ({ ...prev, role: value })), disabled: submitting, children: [_jsx(SelectTrigger, { id: "user-role", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "ADMIN", children: "Administrador" }), _jsx(SelectItem, { value: "SUPERVISOR", children: "Supervisor" }), _jsx(SelectItem, { value: "AGENT", children: "Agente" })] })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "user-password", children: "Senha provis\u00F3ria" }), _jsx(Input, { id: "user-password", type: "password", name: "password", value: form.password, onChange: handleChange, disabled: submitting, required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "user-password-confirm", children: "Confirme a senha" }), _jsx(Input, { id: "user-password-confirm", type: "password", name: "confirmPassword", value: form.confirmPassword, onChange: handleChange, disabled: submitting, required: true })] })] }), error ? _jsx("p", { className: "text-sm text-destructive", children: error }) : null, _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "ghost", onClick: () => onOpenChange(false), disabled: submitting, children: "Cancelar" }), _jsx(Button, { type: "submit", disabled: submitting, children: submitting ? 'Criando usuário...' : 'Criar usuário' })] })] }) }) }));
};
export default CreateUserDialog;
