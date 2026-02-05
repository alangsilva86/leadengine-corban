import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo, useMemo } from 'react';
import { CalendarPlus, Clock, ListTodo, Mail, MessageCircle, Phone, Ticket, } from 'lucide-react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Avatar, AvatarFallback } from '@/components/ui/avatar.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import StatusPill from '@/components/ui/status-pill.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
const STATUS_CONFIG = {
    ACTIVE: { label: 'Ativo', tone: 'success' },
    INACTIVE: { label: 'Inativo', tone: 'neutral' },
    ARCHIVED: { label: 'Arquivado', tone: 'warning' },
};
const MAX_VISIBLE_TAGS = 3;
const resolveInitials = (name) => {
    if (!name) {
        return 'CT';
    }
    const parts = name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2);
    if (parts.length === 0) {
        return 'CT';
    }
    return parts
        .map((part) => part[0]?.toUpperCase())
        .join('');
};
const resolveTimestamp = (value) => {
    if (!value) {
        return {
            relative: 'Nenhuma interação registrada',
            absolute: 'Sem registros anteriores',
        };
    }
    try {
        const date = typeof value === 'string' ? parseISO(value) : new Date(value);
        return {
            relative: formatDistanceToNow(date, { addSuffix: true, locale: ptBR }),
            absolute: format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR }),
        };
    }
    catch {
        return {
            relative: 'Data indisponível',
            absolute: 'Não foi possível formatar a data',
        };
    }
};
const ContactRowComponent = ({ contact, selected = false, onToggle, onOpenDetails, onTriggerWhatsApp, onCreateTask, }) => {
    const tags = useMemo(() => (Array.isArray(contact?.tags) ? contact.tags.filter(Boolean) : []), [contact?.tags]);
    const extraTags = Math.max(tags.length - MAX_VISIBLE_TAGS, 0);
    const statusConfig = STATUS_CONFIG[contact?.status] ?? STATUS_CONFIG.ACTIVE;
    const openTickets = contact?.openTickets ?? 0;
    const pendingTasks = contact?.pendingTasks ?? 0;
    const lastInteraction = useMemo(() => resolveTimestamp(contact?.lastInteractionAt), [contact?.lastInteractionAt]);
    const handleRowClick = (event) => {
        if (event.defaultPrevented) {
            return;
        }
        if (event.target.closest('[data-row-interactive="true"]')) {
            return;
        }
        onOpenDetails?.(contact);
    };
    const handleRowKeyDown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpenDetails?.(contact);
        }
    };
    const stopPropagation = (event) => {
        event.stopPropagation();
    };
    const phoneHref = contact?.phone ? `tel:${contact.phone}` : undefined;
    const emailHref = contact?.email ? `mailto:${contact.email}` : undefined;
    return (_jsxs("div", { className: cn('grid grid-cols-1 gap-4 border-b border-border/60 px-4 py-4 transition-colors hover:bg-muted/50 focus-within:bg-muted/50 focus-visible:outline-none md:grid-cols-[auto,minmax(0,1.2fr),minmax(0,220px),180px]', selected && 'bg-primary/5'), role: "row", "aria-selected": selected, tabIndex: 0, onClick: handleRowClick, onKeyDown: handleRowKeyDown, children: [_jsxs("div", { className: "flex items-start gap-3", role: "gridcell", children: [_jsx(Checkbox, { checked: selected, onCheckedChange: onToggle, "aria-label": contact?.name ? `Selecionar ${contact.name}` : 'Selecionar contato', "data-row-interactive": "true", onClick: stopPropagation, onKeyDown: stopPropagation }), _jsx(Avatar, { className: "h-10 w-10", children: _jsx(AvatarFallback, { children: resolveInitials(contact?.name) }) }), _jsxs("div", { className: "min-w-0 space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("button", { type: "button", className: "text-left text-sm font-semibold text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", onClick: (event) => {
                                            event.stopPropagation();
                                            onOpenDetails?.(contact);
                                        }, "data-row-interactive": "true", children: contact?.name ?? 'Contato sem nome' }), _jsx(StatusPill, { size: "sm", tone: statusConfig.tone, withDot: true, children: statusConfig.label }), contact?.isBlocked ? (_jsx(Badge, { variant: "destructive", className: "uppercase", children: "Bloqueado" })) : null] }), _jsxs("div", { className: "flex flex-wrap items-center gap-4 text-xs text-muted-foreground", children: [_jsxs("span", { className: "inline-flex items-center gap-1.5", children: [_jsx(Phone, { className: "h-3.5 w-3.5" }), phoneHref ? (_jsx("a", { href: phoneHref, className: "hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", onClick: stopPropagation, "data-row-interactive": "true", children: contact.phone })) : ('—')] }), _jsxs("span", { className: "inline-flex items-center gap-1.5", children: [_jsx(Mail, { className: "h-3.5 w-3.5" }), emailHref ? (_jsx("a", { href: emailHref, className: "hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", onClick: stopPropagation, "data-row-interactive": "true", children: contact.email })) : ('—')] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:hidden", children: [_jsxs(StatusPill, { tone: openTickets > 0 ? 'warning' : 'neutral', size: "sm", withDot: true, children: [_jsx(Ticket, { className: "h-3.5 w-3.5" }), openTickets, " ", openTickets === 1 ? 'ticket' : 'tickets', " em aberto"] }), _jsxs(StatusPill, { tone: pendingTasks > 0 ? 'primary' : 'neutral', size: "sm", withDot: true, children: [_jsx(ListTodo, { className: "h-3.5 w-3.5" }), pendingTasks, " ", pendingTasks === 1 ? 'tarefa' : 'tarefas', " pendente(s)"] })] })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", role: "gridcell", children: [tags.slice(0, MAX_VISIBLE_TAGS).map((tag) => (_jsx(Badge, { variant: "secondary", children: tag }, tag))), extraTags > 0 ? (_jsxs(Badge, { variant: "outline", className: "text-xs text-muted-foreground", children: ["+", extraTags] })) : null, tags.length === 0 ? _jsx(Badge, { variant: "outline", children: "Sem tags" }) : null] }), _jsxs("div", { className: "hidden flex-col gap-2 text-xs text-muted-foreground md:flex", role: "gridcell", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs(StatusPill, { tone: openTickets > 0 ? 'warning' : 'neutral', size: "sm", withDot: true, children: [_jsx(Ticket, { className: "h-3.5 w-3.5" }), openTickets, " ", openTickets === 1 ? 'ticket' : 'tickets', " em aberto"] }), _jsxs(StatusPill, { tone: pendingTasks > 0 ? 'primary' : 'neutral', size: "sm", withDot: true, children: [_jsx(ListTodo, { className: "h-3.5 w-3.5" }), pendingTasks, " ", pendingTasks === 1 ? 'tarefa' : 'tarefas', " pendente(s)"] })] }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsxs("div", { className: "inline-flex items-center gap-2", children: [_jsx(Clock, { className: "h-3.5 w-3.5" }), lastInteraction.relative] }) }), _jsxs(TooltipContent, { className: "max-w-xs", children: ["\u00DAltima intera\u00E7\u00E3o registrada em ", lastInteraction.absolute] })] })] }), _jsxs("div", { className: "flex flex-col gap-2 self-center md:self-start", role: "gridcell", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-end gap-2", children: [_jsxs(Button, { type: "button", variant: "outline", size: "sm", className: "gap-2", onClick: (event) => {
                                    event.stopPropagation();
                                    onTriggerWhatsApp?.(contact);
                                }, "data-row-interactive": "true", children: [_jsx(MessageCircle, { className: "h-4 w-4" }), _jsx("span", { className: "hidden sm:inline", children: "WhatsApp" })] }), _jsxs(Button, { type: "button", variant: "outline", size: "sm", className: "gap-2", onClick: (event) => {
                                    event.stopPropagation();
                                    onCreateTask?.(contact);
                                }, "data-row-interactive": "true", children: [_jsx(CalendarPlus, { className: "h-4 w-4" }), _jsx("span", { className: "hidden sm:inline", children: "Nova tarefa" })] })] }), _jsxs("div", { className: "flex items-center justify-end gap-2 text-xs text-muted-foreground md:hidden", children: [_jsx(Clock, { className: "h-3.5 w-3.5" }), lastInteraction.relative] })] })] }));
};
const ContactRow = memo(ContactRowComponent);
export default ContactRow;
