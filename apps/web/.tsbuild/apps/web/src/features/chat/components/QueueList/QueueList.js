import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment, useMemo } from 'react';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { cn } from '@/lib/utils.js';
import { getTicketIdentity } from '../../utils/ticketIdentity.js';
import InstanceBadge from '../Shared/InstanceBadge.jsx';
const resolveWindowStatus = (minutes) => {
    if (minutes === null || minutes === undefined) {
        return { label: 'Sem janela', tone: 'neutral' };
    }
    if (minutes <= 0) {
        return { label: 'Expirado', tone: 'expired' };
    }
    if (minutes <= 10) {
        return { label: `Crítico • ${minutes} min`, tone: 'critical' };
    }
    if (minutes <= 30) {
        return { label: `Atenção • ${minutes} min`, tone: 'warning' };
    }
    return { label: `Em dia • ${minutes} min`, tone: 'success' };
};
const formatPreview = (ticket) => {
    if (ticket?.lastMessagePreview) {
        return ticket.lastMessagePreview;
    }
    if (ticket?.timeline?.lastDirection === 'INBOUND') {
        return 'Aguardando resposta';
    }
    if (ticket?.timeline?.lastDirection === 'OUTBOUND') {
        return 'Aguardando cliente';
    }
    return 'Sem mensagens registradas';
};
const formatTime = (iso) => {
    if (!iso)
        return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return null;
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};
const QueueListItem = ({ ticket, selected, onSelect, selectedForBulk = false, onToggleSelection }) => {
    const windowStats = ticket?.window;
    const { label: slaLabel } = resolveWindowStatus(windowStats?.remainingMinutes ?? null);
    const lastInbound = formatTime(ticket?.timeline?.lastInboundAt);
    const lastOutbound = formatTime(ticket?.timeline?.lastOutboundAt);
    const agentTyping = ticket?.timeline?.typing;
    const { displayName, displayPhone, remoteJid } = getTicketIdentity(ticket);
    const instanceId = ticket?.metadata?.sourceInstance ??
        ticket?.instanceId ??
        ticket?.metadata?.instanceId ??
        ticket?.timeline?.instanceId ??
        null;
    const unreadInbound = ticket.timeline?.unreadInboundCount ?? 0;
    const lastActivity = lastInbound ?? lastOutbound ?? '—';
    const preview = formatPreview(ticket);
    return (_jsxs("button", { type: "button", "data-active": selected ? 'true' : 'false', "data-bulk-selected": selectedForBulk ? 'true' : 'false', "aria-pressed": selected, onClick: () => onSelect?.(ticket.id), className: cn('group/list relative w-full rounded-2xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] px-3 py-2 text-left transition-colors duration-150 hover:border-[color:color-mix(in_srgb,var(--accent-inbox-primary)_38%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-bold)_90%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-shell)]', selected && 'border-[color:color-mix(in_srgb,var(--accent-inbox-primary)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_12%,transparent)]', 'data-[bulk-selected=true]:ring-2 data-[bulk-selected=true]:ring-[color:var(--accent-inbox-primary)] data-[bulk-selected=true]:ring-offset-2 data-[bulk-selected=true]:ring-offset-[color:var(--surface-shell)]'), children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "flex h-5 items-center pt-1", children: _jsx(Checkbox, { checked: selectedForBulk, onCheckedChange: () => onToggleSelection?.(ticket.id), onClick: (event) => event.stopPropagation(), className: "h-4 w-4", "aria-label": selectedForBulk ? 'Remover ticket da seleção' : 'Selecionar ticket para ações em massa' }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex min-w-0 items-center justify-between gap-2 text-[10px] text-[color:var(--color-inbox-foreground-muted)]", children: [_jsx(InstanceBadge, { instanceId: instanceId }), _jsx("span", { children: lastActivity })] }), _jsxs("div", { className: "mt-2 flex min-w-0 items-center gap-2", children: [_jsx("p", { className: "truncate text-sm font-semibold text-[color:var(--color-inbox-foreground)]", title: displayName, children: displayName }), unreadInbound > 0 ? (_jsxs("span", { className: "inline-flex items-center justify-center rounded-full bg-[color:var(--accent-inbox-primary)]/10 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--accent-inbox-primary)]", children: ["+", unreadInbound] })) : null] }), _jsxs("div", { className: "mt-1 flex min-w-0 items-center gap-2 text-xs text-[color:var(--color-inbox-foreground-muted)]", children: [_jsx("span", { className: "truncate", children: preview }), _jsx("span", { className: "hidden overflow-hidden text-[10px] uppercase tracking-wide text-[color:var(--color-inbox-foreground-muted)]/70 group-hover/list:inline", children: slaLabel })] })] }), _jsxs("div", { className: "hidden flex-col items-end gap-1 text-xs text-[color:var(--color-inbox-foreground-muted)] group-hover/list:flex", children: [_jsx("span", { children: ticket.pipelineStep ?? ticket.metadata?.pipelineStep ?? 'Sem etapa' }), _jsx("span", { className: "text-[10px]", children: displayPhone ?? remoteJid ?? 'Sem telefone' })] })] }), agentTyping ? (_jsxs("div", { className: "mt-2 flex items-center gap-1 text-[10px] font-medium text-[color:var(--accent-inbox-primary)]", children: [_jsx("span", { className: "h-2 w-2 animate-pulse rounded-full bg-[color:var(--accent-inbox-primary)]" }), "Digitando\u2026"] })) : null] }));
};
const QueueList = ({ tickets, selectedTicketId, selectedTicketIds = [], onSelectTicket, onToggleTicketSelection, onClearSelection, loading, onRefresh, typingAgents = [], metrics, onBulkRegisterLoss, bulkActionPending = false, bulkActionsDisabled = false, }) => {
    const typingTicketIds = useMemo(() => new Set(typingAgents.map((agent) => agent.ticketId)), [typingAgents]);
    const selectionCount = Array.isArray(selectedTicketIds) ? selectedTicketIds.length : 0;
    const selectionLabel = selectionCount === 1 ? '1 ticket selecionado' : `${selectionCount} tickets selecionados`;
    return (_jsxs("div", { className: "flex min-h-0 flex-col gap-3", children: [_jsxs("div", { className: "flex items-center justify-between gap-2 px-1", children: [_jsx("h2", { className: "text-sm font-semibold text-[color:var(--color-inbox-foreground)]", children: "Filas de atendimento" }), _jsxs(Button, { variant: "ghost", size: "icon", className: "text-[color:var(--color-inbox-foreground-muted)] hover:text-[color:var(--color-inbox-foreground)]", onClick: onRefresh, disabled: loading, children: [loading ? _jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : _jsx(RefreshCw, { className: "h-4 w-4" }), _jsx("span", { className: "sr-only", children: "Sincronizar" })] })] }), selectionCount > 0 ? (_jsxs("div", { className: "mx-1 flex flex-col gap-2 rounded-xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] px-3 py-2 text-xs text-[color:var(--color-inbox-foreground)]", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsx("span", { className: "font-medium", children: selectionLabel }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => onClearSelection?.(), className: "h-7", children: "Limpar" }), _jsxs(Button, { size: "sm", onClick: () => onBulkRegisterLoss?.(), disabled: bulkActionsDisabled || selectionCount === 0, className: "h-7", children: [bulkActionPending ? _jsx(Loader2, { className: "mr-2 h-3 w-3 animate-spin" }) : null, "Registrar perda"] })] })] }), _jsx("p", { className: "text-[10px] text-[color:var(--color-inbox-foreground-muted)]", children: "Aplique a\u00E7\u00F5es em massa nos tickets selecionados." })] })) : null, _jsx("div", { className: "space-y-2 px-1 pb-6", children: tickets.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] p-6 text-center text-sm text-[color:var(--color-inbox-foreground-muted)]", children: [_jsx(AlertTriangle, { className: "h-5 w-5 text-[color:var(--color-inbox-foreground-muted)]" }), _jsx("p", { children: "Nenhum ticket encontrado com os filtros atuais." })] })) : (tickets.map((ticket) => (_jsx(Fragment, { children: _jsx(QueueListItem, { ticket: {
                            ...ticket,
                            timeline: {
                                ...ticket.timeline,
                                typing: typingTicketIds.has(ticket.id),
                            },
                        }, selected: ticket.id === selectedTicketId, selectedForBulk: selectedTicketIds.includes(ticket.id), onSelect: onSelectTicket, onToggleSelection: onToggleTicketSelection }) }, ticket.id)))) })] }));
};
export default QueueList;
