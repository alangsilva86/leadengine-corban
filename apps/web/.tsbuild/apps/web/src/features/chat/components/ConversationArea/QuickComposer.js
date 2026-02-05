import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { MessageCircle, StickyNote } from 'lucide-react';
import { formatPhoneNumber } from '@/lib/utils.js';
import TemplatePicker from './TemplatePicker.jsx';
import emitInboxTelemetry from '../../utils/telemetry.js';
const normalizePhones = (ticket) => {
    const phones = new Set();
    const contactPhones = Array.isArray(ticket?.contact?.phones) ? ticket.contact.phones : [];
    for (const entry of contactPhones) {
        if (entry)
            phones.add(String(entry));
    }
    if (ticket?.contact?.phone) {
        phones.add(String(ticket.contact.phone));
    }
    if (ticket?.metadata?.contactPhone) {
        phones.add(String(ticket.metadata.contactPhone));
    }
    return Array.from(phones);
};
const trackPrimaryAction = (trackerRef, startedAtRef, action, extra = {}) => {
    const ticketId = extra.ticketId ?? null;
    if (!trackerRef.current && startedAtRef.current) {
        const elapsed = performance.now() - startedAtRef.current;
        emitInboxTelemetry('chat.quick_action.time_to_primary', {
            action,
            elapsedMs: Math.round(elapsed),
            ticketId,
        });
        trackerRef.current = true;
    }
    emitInboxTelemetry('chat.quick_action.triggered', {
        action,
        ticketId,
    });
};
export const QuickComposer = ({ ticket, onSendTemplate, onCreateNextStep, }) => {
    const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
    const [taskDescription, setTaskDescription] = useState('');
    const [taskDueAt, setTaskDueAt] = useState('');
    const phones = useMemo(() => normalizePhones(ticket), [ticket]);
    const [selectedPhone, setSelectedPhone] = useState(() => phones[0] ?? '');
    const startedAtRef = useRef(typeof performance !== 'undefined' ? performance.now() : Date.now());
    const primaryTrackedRef = useRef(false);
    const canSendTemplate = typeof onSendTemplate === 'function';
    const canCreateNextStep = typeof onCreateNextStep === 'function';
    const ticketId = ticket?.id ?? null;
    const handleSelectPhone = useCallback((value) => {
        setSelectedPhone(value);
    }, []);
    const ensurePhone = useCallback(() => {
        const phone = selectedPhone || phones[0];
        if (phone) {
            return phone;
        }
        toast.info('Nenhum telefone disponível para o contato.');
        return null;
    }, [phones, selectedPhone]);
    const handleOpenTemplate = useCallback(() => {
        if (!canSendTemplate) {
            toast.info('Envio de template indisponível no ambiente atual.');
            return;
        }
        if (!ensurePhone()) {
            return;
        }
        setTemplatePickerOpen(true);
        trackPrimaryAction(primaryTrackedRef, startedAtRef, 'whatsapp_template', { ticketId });
    }, [canSendTemplate, ensurePhone, primaryTrackedRef, startedAtRef, ticketId]);
    const handleTemplateSelected = useCallback((template) => {
        if (template) {
            onSendTemplate?.({ ...template, phone: ensurePhone() });
            emitInboxTelemetry('chat.quick_action.template_sent', {
                ticketId,
                templateId: template.id ?? template.name ?? 'template',
            });
        }
        setTemplatePickerOpen(false);
    }, [ensurePhone, onSendTemplate, ticketId]);
    const handleTaskSubmit = useCallback(async () => {
        const description = taskDescription.trim();
        if (!description) {
            toast.info('Descreva o próximo passo antes de salvar.');
            return;
        }
        if (!canCreateNextStep) {
            toast.info('Registro de próximo passo indisponível no ambiente atual.');
            return;
        }
        try {
            await onCreateNextStep?.({ description, dueAt: taskDueAt });
            setTaskDescription('');
            setTaskDueAt('');
            trackPrimaryAction(primaryTrackedRef, startedAtRef, 'next_step', { ticketId });
        }
        catch (error) {
            const message = error?.message ?? 'Falha desconhecida ao salvar o próximo passo.';
            emitInboxTelemetry('chat.quick_action.next_step_error', {
                ticketId,
                message,
            });
            console.error('Falha ao salvar próximo passo no QuickComposer', error);
            toast.error('Não foi possível salvar o próximo passo.', {
                description: message,
            });
        }
    }, [canCreateNextStep, onCreateNextStep, primaryTrackedRef, startedAtRef, taskDescription, taskDueAt, ticketId]);
    const renderPhoneSelector = () => {
        if (phones.length <= 1) {
            return null;
        }
        return (_jsxs(Select, { value: selectedPhone, onValueChange: handleSelectPhone, children: [_jsx(SelectTrigger, { className: "h-9 w-full rounded-xl border-surface-overlay-glass-border bg-surface-overlay-quiet text-left text-xs text-foreground", children: _jsx(SelectValue, { placeholder: "Selecione o n\u00FAmero" }) }), _jsx(SelectContent, { children: phones.map((phone) => (_jsx(SelectItem, { value: phone, className: "text-sm", children: formatPhoneNumber(phone) }, phone))) })] }));
    };
    const formattedPhone = selectedPhone ? formatPhoneNumber(selectedPhone) : phones[0] ? formatPhoneNumber(phones[0]) : 'Sem telefone';
    return (_jsxs("div", { className: "flex flex-col gap-4 rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/80 p-4 shadow-[0_14px_38px_-24px_rgba(15,23,42,0.85)] backdrop-blur", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("h3", { className: "text-sm font-semibold text-foreground", children: "Quick Composer" }), _jsx("p", { className: "text-xs text-foreground-muted", children: "Dispare templates homologados sem sair da conversa. A\u00E7\u00F5es de telefone est\u00E3o dispon\u00EDveis no cabe\u00E7alho da conversa." }), _jsxs("div", { className: "text-xs text-foreground-muted", children: ["Telefone selecionado: ", _jsx("span", { className: "font-medium text-foreground", children: formattedPhone })] }), renderPhoneSelector(), _jsx("div", { className: "grid grid-cols-1 gap-2 sm:grid-cols-2", children: _jsxs(Button, { type: "button", onClick: handleOpenTemplate, className: "flex flex-col items-center gap-1 rounded-xl bg-emerald-500/90 py-3 text-xs font-semibold text-white shadow-[0_18px_32px_-24px_rgba(16,185,129,0.8)] hover:bg-emerald-500", disabled: !canSendTemplate, title: canSendTemplate ? undefined : 'Templates indisponíveis na sua configuração atual.', children: [_jsx(MessageCircle, { className: "h-4 w-4" }), "WhatsApp"] }) })] }), _jsx(Separator, { className: "bg-surface-overlay-glass-border" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm font-semibold text-foreground", children: [_jsx(StickyNote, { className: "h-4 w-4 text-accent" }), "Pr\u00F3ximos passos"] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "next-step-description", className: "text-sm font-medium text-foreground", children: "Descri\u00E7\u00E3o do pr\u00F3ximo passo (obrigat\u00F3rio)" }), _jsx(Textarea, { id: "next-step-description", value: taskDescription, onChange: (event) => setTaskDescription(event.target.value), placeholder: "Descreva a tarefa ou follow-up", className: "min-h-[90px] rounded-2xl border-none bg-surface-overlay-quiet text-sm text-foreground placeholder:text-foreground-muted ring-1 ring-surface-overlay-glass-border" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "next-step-due-at", className: "text-sm font-medium text-foreground", children: "Data prevista para conclus\u00E3o (opcional)" }), _jsx(Input, { id: "next-step-due-at", type: "datetime-local", value: taskDueAt, onChange: (event) => setTaskDueAt(event.target.value), className: "h-10 rounded-xl border-surface-overlay-glass-border bg-surface-overlay-quiet text-sm" })] }), _jsx(Button, { type: "button", onClick: handleTaskSubmit, className: "w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-[0_18px_36px_-24px_rgba(59,130,246,0.8)] hover:bg-primary/90", disabled: !canCreateNextStep, children: "Registrar pr\u00F3ximo passo" })] }), _jsx(TemplatePicker, { open: templatePickerOpen, onClose: () => setTemplatePickerOpen(false), onSelect: handleTemplateSelected })] }));
};
export default QuickComposer;
