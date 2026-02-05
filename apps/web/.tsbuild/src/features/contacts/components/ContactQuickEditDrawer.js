import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Drawer, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription, DrawerClose, } from '@/components/ui/drawer.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
const ContactQuickEditDrawer = ({ open, onOpenChange, contact, onSubmit }) => {
    const { register, control, reset, handleSubmit, formState: { isDirty, isSubmitting }, } = useForm({
        defaultValues: {
            name: contact?.name ?? '',
            phone: contact?.phone ?? '',
            email: contact?.email ?? '',
            document: contact?.document ?? '',
            notes: contact?.notes ?? '',
            isBlocked: Boolean(contact?.isBlocked),
        },
    });
    useEffect(() => {
        reset({
            name: contact?.name ?? '',
            phone: contact?.phone ?? '',
            email: contact?.email ?? '',
            document: contact?.document ?? '',
            notes: contact?.notes ?? '',
            isBlocked: Boolean(contact?.isBlocked),
        });
    }, [contact, reset]);
    const handleFormSubmit = handleSubmit((values) => {
        onSubmit?.({ ...values });
    });
    return (_jsx(Drawer, { open: open, onOpenChange: onOpenChange, direction: "right", children: _jsxs(DrawerContent, { className: "sm:max-w-lg", children: [_jsxs(DrawerHeader, { children: [_jsx(DrawerTitle, { children: "Editar contato" }), _jsx(DrawerDescription, { children: "Atualize os dados principais do contato em tempo real." })] }), _jsxs("form", { className: "flex flex-1 flex-col gap-4 p-4", onSubmit: handleFormSubmit, children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium", htmlFor: "contact-name", children: "Nome" }), _jsx(Input, { id: "contact-name", placeholder: "Nome completo", ...register('name') })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium", htmlFor: "contact-phone", children: "Telefone" }), _jsx(Input, { id: "contact-phone", placeholder: "(11) 99999-0000", ...register('phone') })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium", htmlFor: "contact-email", children: "E-mail" }), _jsx(Input, { id: "contact-email", type: "email", placeholder: "email@cliente.com", ...register('email') })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium", htmlFor: "contact-document", children: "Documento" }), _jsx(Input, { id: "contact-document", placeholder: "CPF/CNPJ", ...register('document') })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium", htmlFor: "contact-notes", children: "Notas" }), _jsx(Textarea, { id: "contact-notes", rows: 4, placeholder: "Observa\u00E7\u00F5es internas", ...register('notes') })] }), _jsx(Controller, { name: "isBlocked", control: control, render: ({ field }) => (_jsxs("label", { className: "flex items-center gap-2 text-sm font-medium", children: [_jsx(Checkbox, { checked: Boolean(field.value), onCheckedChange: (nextValue) => field.onChange(Boolean(nextValue)) }), "Bloquear contato para campanhas"] })) }), _jsxs(DrawerFooter, { children: [_jsx(DrawerClose, { asChild: true, children: _jsx(Button, { type: "button", variant: "outline", children: "Cancelar" }) }), _jsx(Button, { type: "submit", disabled: !isDirty || isSubmitting, children: isSubmitting ? 'Salvando…' : 'Salvar alterações' })] })] })] }) }));
};
export default ContactQuickEditDrawer;
