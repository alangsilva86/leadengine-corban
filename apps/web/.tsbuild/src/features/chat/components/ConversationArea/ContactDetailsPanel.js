import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Copy as CopyIcon, Edit3, Phone as PhoneIcon, MessageCircle, Mail, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { useClipboard } from '@/hooks/use-clipboard.js';
import { cn, formatPhoneNumber } from '@/lib/utils.js';
import { formatDateTime } from '../../utils/datetime.js';
import { getTicketIdentity } from '../../utils/ticketIdentity.js';
import { resolveTicketContext } from './utils/ticketMetadata.js';
const CHANNEL_PRESENTATION = {
    WHATSAPP: {
        id: 'whatsapp',
        label: 'WhatsApp',
        icon: MessageCircle,
        className: 'border-[color:var(--color-status-whatsapp-border)] bg-[color:var(--color-status-whatsapp-surface)] text-[color:var(--color-status-whatsapp-foreground)]',
    },
    VOICE: {
        id: 'voice',
        label: 'Telefone',
        icon: PhoneIcon,
        className: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground',
    },
    EMAIL: {
        id: 'email',
        label: 'E-mail',
        icon: Mail,
        className: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground',
    },
    DEFAULT: {
        id: 'unknown',
        label: 'Canal não identificado',
        icon: MessageCircle,
        className: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted',
    },
};
const normalizeChannel = (value) => {
    if (!value)
        return null;
    const normalized = String(value)
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim()
        .toUpperCase();
    if (!normalized) {
        return null;
    }
    if (normalized === 'PHONE' || normalized === 'TELEFONE' || normalized === 'CALL') {
        return 'VOICE';
    }
    if (normalized === 'E-MAIL' || normalized === 'MAIL') {
        return 'EMAIL';
    }
    if (normalized === 'WA') {
        return 'WHATSAPP';
    }
    return normalized;
};
const resolveChannelInfo = (channel) => {
    const normalized = normalizeChannel(channel);
    return CHANNEL_PRESENTATION[normalized] ?? CHANNEL_PRESENTATION.DEFAULT;
};
const parseDateValue = (value) => {
    if (!value)
        return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date;
};
const formatRelativeTime = (value) => {
    const date = parseDateValue(value);
    if (!date) {
        return null;
    }
    try {
        return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
    }
    catch {
        return null;
    }
};
const getLastInteractionTimestamp = (timeline) => {
    if (!timeline) {
        return null;
    }
    const inboundDate = parseDateValue(timeline.lastInboundAt);
    const outboundDate = parseDateValue(timeline.lastOutboundAt);
    const direction = timeline.lastDirection ?? null;
    if (direction === 'INBOUND' && inboundDate) {
        return inboundDate;
    }
    if (direction === 'OUTBOUND' && outboundDate) {
        return outboundDate;
    }
    if (inboundDate && outboundDate) {
        return inboundDate > outboundDate ? inboundDate : outboundDate;
    }
    return inboundDate ?? outboundDate ?? null;
};
const CopyButton = ({ value, label }) => {
    const clipboard = useClipboard();
    const handleCopy = useCallback(() => {
        clipboard.copy(value);
    }, [clipboard, value]);
    return (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "h-7 w-7 rounded-full text-foreground-muted hover:text-foreground", onClick: handleCopy, children: _jsx(CopyIcon, { className: "h-4 w-4", "aria-hidden": true }) }) }), _jsxs(TooltipContent, { children: ["Copiar ", label] })] }));
};
const InlineField = ({ label, value, placeholder, onSave, formatter, copyable = false, type = 'text', disabled = false, }) => {
    const [draft, setDraft] = useState(value ?? '');
    const labelId = useId();
    useEffect(() => {
        setDraft(value ?? '');
    }, [value]);
    const formattedValue = formatter ? formatter(draft) : draft;
    const handleBlur = useCallback(async () => {
        if (!onSave) {
            return;
        }
        await onSave(draft);
    }, [draft, onSave]);
    return (_jsxs("div", { className: "flex flex-col gap-1", role: "group", "aria-labelledby": labelId, children: [_jsx("span", { id: labelId, className: "text-xs font-medium uppercase tracking-wide text-foreground-muted", children: label }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { value: formattedValue, onChange: (event) => setDraft(event.target.value), onBlur: handleBlur, placeholder: placeholder, type: type, disabled: disabled }), copyable && draft ? _jsx(CopyButton, { value: draft, label: label }) : null] })] }));
};
const NextStepEditor = forwardRef(({ value = '', onSave }, elementRef) => {
    const textareaRef = useRef(null);
    useImperativeHandle(elementRef, () => ({
        focus: () => {
            textareaRef.current?.focus();
            return true;
        },
    }), []);
    return (_jsxs("div", { className: "flex w-full flex-col gap-2 rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/70 p-4", children: [_jsx("div", { className: "flex items-start justify-between gap-3", children: _jsxs("div", { children: [_jsx("h4", { className: "text-sm font-semibold text-foreground", children: "Pr\u00F3ximo passo" }), _jsx("p", { className: "text-xs text-foreground-muted", children: "Notas r\u00E1pidas para o pr\u00F3ximo contato." })] }) }), _jsx(Textarea, { ref: textareaRef, defaultValue: value ?? '', rows: 4, placeholder: "Ex.: confirmar documenta\u00E7\u00E3o e enviar proposta", onBlur: (event) => onSave?.(event.target.value) })] }));
});
NextStepEditor.displayName = 'NextStepEditor';
const ContactSummary = ({ ticket }) => {
    const timeline = ticket?.timeline ?? ticket?.metadata?.timeline ?? null;
    const lastTimestamp = useMemo(() => getLastInteractionTimestamp(timeline), [timeline]);
    const relativeTime = useMemo(() => formatRelativeTime(lastTimestamp), [lastTimestamp]);
    const directionActor = timeline?.lastDirection ?? null;
    const channel = ticket?.channel ?? ticket?.metadata?.channel ?? ticket?.metadata?.origin ?? null;
    const channelInfo = resolveChannelInfo(channel);
    const ChannelIcon = channelInfo.icon;
    const lastInbound = timeline?.lastInboundAt ? formatDateTime(timeline.lastInboundAt) : '—';
    const lastOutbound = timeline?.lastOutboundAt ? formatDateTime(timeline.lastOutboundAt) : '—';
    const directionLabel = directionActor === 'INBOUND' ? 'Cliente' : directionActor === 'OUTBOUND' ? 'Equipe' : 'Sem direção';
    const directionSummary = useMemo(() => {
        if (relativeTime) {
            return relativeTime;
        }
        return 'Sem interações registradas';
    }, [relativeTime]);
    return (_jsxs("div", { className: "grid gap-3 rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/70 p-4 text-sm", children: [_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("span", { className: "text-xs font-medium uppercase tracking-wide text-foreground-muted", children: "\u00DAltima intera\u00E7\u00E3o" }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 text-foreground", children: [_jsxs("span", { className: cn('inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium', channelInfo.className), children: [_jsx(ChannelIcon, { className: "h-3.5 w-3.5", "aria-hidden": true, "data-testid": `channel-icon-${channelInfo.id}` }), channelInfo.label] }), _jsx("span", { className: "text-sm text-foreground", children: directionLabel })] }), _jsx("span", { className: "text-xs text-foreground-muted", children: directionSummary })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3 text-xs", children: [_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("span", { className: "font-medium text-foreground-muted uppercase tracking-wide", children: "Cliente" }), _jsx("span", { className: "text-sm text-foreground", children: lastInbound })] }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("span", { className: "font-medium text-foreground-muted uppercase tracking-wide", children: "Equipe" }), _jsx("span", { className: "text-sm text-foreground", children: lastOutbound })] })] })] }));
};
const ContactDetailsPanel = ({ ticket, onContactFieldSave, onEditContact, onCall, onSendSms, nextStepValue, onNextStepSave, nextStepEditorRef, contextSectionRef = null, }) => {
    const identity = useMemo(() => getTicketIdentity(ticket), [ticket]);
    const document = ticket?.contact?.document ?? null;
    const email = ticket?.contact?.email ?? ticket?.metadata?.contactEmail ?? null;
    const rawPhone = identity.rawPhone ?? ticket?.contact?.phone ?? ticket?.metadata?.contactPhone ?? null;
    const displayName = ticket?.contact?.name ?? identity.displayName ?? '';
    const attachments = useMemo(() => {
        const source = ticket?.metadata?.attachments ?? ticket?.attachments ?? null;
        if (Array.isArray(source))
            return source.filter(Boolean);
        if (source && typeof source === 'object')
            return Object.values(source).filter(Boolean);
        return [];
    }, [ticket?.attachments, ticket?.metadata?.attachments]);
    const contextSectionTitleId = useId();
    const contextItems = useMemo(() => resolveTicketContext(ticket), [ticket]);
    return (_jsxs("div", { className: "flex w-full flex-col gap-4", children: [_jsxs("div", { className: "flex w-full flex-col gap-4 rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/70 p-4", children: [_jsx("h4", { className: "text-sm font-semibold text-foreground", children: "Contato" }), _jsx(InlineField, { label: "Nome", value: displayName, placeholder: "Nome completo", onSave: onContactFieldSave ? (value) => onContactFieldSave('name', value) : undefined }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(InlineField, { label: "Telefone", value: rawPhone ?? '', placeholder: "(00) 00000-0000", onSave: onContactFieldSave ? (value) => onContactFieldSave('phone', value) : undefined, formatter: formatPhoneNumber, copyable: true }), _jsx(InlineField, { label: "Documento", value: document ?? '', placeholder: "000.000.000-00", onSave: onContactFieldSave ? (value) => onContactFieldSave('document', value) : undefined, copyable: true }), _jsx(InlineField, { label: "E-mail", value: email ?? '', placeholder: "nome@exemplo.com", onSave: onContactFieldSave ? (value) => onContactFieldSave('email', value) : undefined, type: "email", copyable: true }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("span", { className: "text-xs font-medium uppercase tracking-wide text-foreground-muted", children: "A\u00E7\u00F5es de contato" }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: onCall, children: [_jsx(PhoneIcon, { className: "mr-2 h-3.5 w-3.5", "aria-hidden": true }), "Ligar agora"] }), _jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: onSendSms, children: "Enviar SMS" }), _jsxs(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => onEditContact?.(ticket?.contact?.id ?? null), children: [_jsx(Edit3, { className: "mr-2 h-3.5 w-3.5", "aria-hidden": true }), "Editar contato"] })] })] })] })] }), _jsx(ContactSummary, { ticket: ticket }), _jsx(NextStepEditor, { ref: nextStepEditorRef, value: nextStepValue, onSave: onNextStepSave }), _jsxs("div", { ref: contextSectionRef, tabIndex: -1, className: "flex w-full flex-col gap-3 rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/70 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-shell)]", "aria-labelledby": contextSectionTitleId, children: [_jsx("h4", { id: contextSectionTitleId, className: "text-sm font-semibold text-foreground", children: "Contexto do lead" }), _jsx("div", { className: "grid gap-3 sm:grid-cols-2", children: contextItems.map((item) => (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("span", { className: "text-xs font-medium uppercase tracking-wide text-foreground-muted", children: item.label }), _jsx("span", { className: "text-sm text-foreground", title: item.value, children: item.value })] }, item.id))) })] }), _jsxs("div", { className: "w-full rounded-2xl border border-dashed border-surface-overlay-glass-border bg-surface-overlay-quiet/60 p-4 text-xs text-foreground-muted", children: [_jsxs("div", { className: "flex items-center gap-2 text-foreground", children: [_jsx(AlertTriangle, { className: "h-4 w-4", "aria-hidden": true }), _jsx("span", { className: "font-semibold", children: "Anexos recentes" })] }), attachments.length ? (_jsx("ul", { className: "mt-2 space-y-2", children: attachments.slice(0, 5).map((item, index) => {
                            const key = item?.id ?? item?.name ?? item?.fileName ?? item?.url ?? index;
                            const label = item?.name ?? item?.fileName ?? item?.filename ?? item?.originalName ?? 'Anexo';
                            return (_jsxs("li", { className: "flex items-center justify-between gap-3 rounded-xl border border-surface-overlay-glass-border bg-surface-overlay-quiet px-3 py-2 text-sm text-foreground", children: [_jsx("span", { className: "min-w-0 flex-1 truncate [overflow-wrap:anywhere]", children: label }), _jsx("span", { className: "text-xs text-foreground-muted", children: item?.size ? `${Math.round(item.size / 1024)} KB` : '' })] }, key));
                        }) })) : (_jsx("p", { className: "mt-2 text-sm", children: "Nenhum anexo dispon\u00EDvel para este ticket." }))] })] }));
};
export default ContactDetailsPanel;
