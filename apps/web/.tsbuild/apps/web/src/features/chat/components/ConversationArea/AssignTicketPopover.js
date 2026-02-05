import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { useSearchUsersQuery } from '../../api/useSearchUsersQuery.js';
import { getPrimaryCommandAnchorId } from '../../actions/commandAnchors.js';
const getFirstName = (value) => {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    const [first] = trimmed.split(/\s+/);
    return first || null;
};
const extractTicketAssigneeName = (ticket) => {
    if (!ticket || typeof ticket !== 'object') {
        return null;
    }
    const candidates = [
        ticket.assignee?.name,
        ticket.assignee?.fullName,
        ticket.assigneeName,
        ticket.user?.name,
        ticket.user?.fullName,
        ticket.userName,
        ticket.metadata?.assigneeName,
    ];
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate;
        }
    }
    return null;
};
const buildSelectionMap = (users = []) => {
    if (!Array.isArray(users)) {
        return new Map();
    }
    return new Map(users
        .filter((user) => user && typeof user.id === 'string')
        .map((user) => [user.id, user]));
};
const AssignTicketPopover = ({ entry, context, focusMap, buttonClassName }) => {
    const { definition, canExecute, state } = entry;
    const triggerRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [assignError, setAssignError] = useState(null);
    const [pendingAssignee, setPendingAssignee] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    useEffect(() => {
        if (!triggerRef.current)
            return undefined;
        focusMap.current.set(definition.id, triggerRef.current);
        return () => {
            focusMap.current.delete(definition.id);
        };
    }, [definition.id, focusMap]);
    useEffect(() => {
        setPendingAssignee(null);
        setSelectedUserId(null);
        setOpen(false);
        setAssignError(null);
        setSearch('');
    }, [context.ticket?.id]);
    const { data: users = [], isLoading, error, refetch } = useSearchUsersQuery({ search, enabled: open });
    const userMap = useMemo(() => buildSelectionMap(users), [users]);
    const ticketAssigneeId = useMemo(() => {
        const ticket = context?.ticket;
        if (!ticket || typeof ticket !== 'object') {
            return null;
        }
        const rawCandidate = ticket.userId ??
            ticket.assigneeId ??
            ticket.assignee?.id ??
            ticket.user?.id ??
            null;
        if (typeof rawCandidate === 'string') {
            return rawCandidate;
        }
        if (rawCandidate === null || rawCandidate === undefined) {
            return null;
        }
        return String(rawCandidate);
    }, [context?.ticket]);
    const ticketAssigneeName = useMemo(() => extractTicketAssigneeName(context?.ticket), [context?.ticket]);
    const displayAssignee = useMemo(() => {
        if (pendingAssignee) {
            return pendingAssignee;
        }
        if (ticketAssigneeId && userMap.has(ticketAssigneeId)) {
            return userMap.get(ticketAssigneeId);
        }
        if (ticketAssigneeName) {
            return { id: ticketAssigneeId ?? 'ticket-assignee', name: ticketAssigneeName };
        }
        return null;
    }, [pendingAssignee, ticketAssigneeId, ticketAssigneeName, userMap]);
    const displayFirstName = displayAssignee ? getFirstName(displayAssignee.name) : null;
    const handleOpenChange = (nextOpen) => {
        setOpen(nextOpen);
        setAssignError(null);
        if (nextOpen) {
            setSelectedUserId(pendingAssignee?.id ?? ticketAssigneeId ?? null);
        }
        else {
            setSearch('');
            setSelectedUserId(null);
        }
    };
    const handleSelectUser = (userId) => {
        setSelectedUserId(userId);
        setAssignError(null);
    };
    const handleConfirm = async () => {
        if (!selectedUserId) {
            setAssignError('Selecione um responsável para continuar.');
            return;
        }
        if (!definition.run) {
            setAssignError('Ação indisponível no momento.');
            return;
        }
        setIsSubmitting(true);
        const selectedUser = userMap.get(selectedUserId) ?? null;
        const contextWithTarget = {
            ...context,
            returnFocus: triggerRef.current ?? null,
            targetUserId: selectedUserId,
        };
        try {
            await Promise.resolve(definition.run(contextWithTarget));
            definition.analytics?.(contextWithTarget);
            if (selectedUser) {
                setPendingAssignee(selectedUser);
            }
            else if (selectedUserId) {
                setPendingAssignee({ id: selectedUserId, name: selectedUserId });
            }
            setOpen(false);
            setSearch('');
            setAssignError(null);
        }
        catch (assignFailure) {
            const message = assignFailure instanceof Error ? assignFailure.message : 'Não foi possível atribuir o ticket.';
            setAssignError(message);
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const disabled = !canExecute || state.disabled;
    const loading = Boolean(state.loading || isSubmitting);
    const Icon = definition.icon;
    const queryErrorMessage = error instanceof Error ? error.message : null;
    const renderUsers = () => {
        if (isLoading) {
            return (_jsxs("div", { className: "flex items-center gap-2 rounded-lg border border-dashed border-surface-overlay-glass-border px-3 py-2 text-sm text-foreground-muted", children: [_jsx(Loader2, { className: "h-4 w-4 animate-spin", "aria-hidden": true }), "Buscando agentes\u2026"] }));
        }
        if (queryErrorMessage) {
            return (_jsxs("div", { className: "space-y-2 rounded-lg border border-status-error-border px-3 py-2 text-sm text-status-error-foreground", role: "alert", children: [_jsx("p", { children: "N\u00E3o foi poss\u00EDvel carregar os usu\u00E1rios internos." }), _jsx("button", { type: "button", className: "text-sm font-semibold underline", onClick: () => refetch?.(), children: "Tentar novamente" })] }));
        }
        if (!Array.isArray(users) || users.length === 0) {
            return (_jsx("div", { className: "rounded-lg border border-dashed border-surface-overlay-glass-border px-3 py-2 text-sm text-foreground-muted", children: "Nenhum agente encontrado." }));
        }
        return (_jsx(ScrollArea, { className: "max-h-56 pr-3", children: _jsx("div", { className: "flex flex-col gap-2", children: users.map((user) => {
                    if (!user || !user.id) {
                        return null;
                    }
                    const normalizedUserId = typeof user.id === 'string' ? user.id : String(user.id);
                    const isSelected = selectedUserId === normalizedUserId;
                    return (_jsxs("button", { type: "button", onClick: () => handleSelectUser(normalizedUserId), className: cn('flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition', isSelected
                            ? 'border-[color:var(--accent-inbox-primary)] bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_12%,transparent)]/70 text-foreground'
                            : 'border-surface-overlay-glass-border text-foreground hover:border-[color:var(--accent-inbox-primary)]'), children: [_jsx("span", { className: "truncate", children: user.name ?? user.email ?? 'Agente' }), isSelected ? _jsx(Check, { className: "h-4 w-4 text-[color:var(--accent-inbox-primary)]", "aria-hidden": true }) : null] }, normalizedUserId));
                }) }) }));
    };
    return (_jsx(Tooltip, { children: _jsxs(Popover, { open: open, onOpenChange: handleOpenChange, children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx(PopoverTrigger, { asChild: true, children: _jsxs(Button, { ref: triggerRef, id: getPrimaryCommandAnchorId(definition.id), type: "button", variant: definition.intent === 'primary' ? 'default' : 'outline', className: cn(buttonClassName, definition.intent === 'primary'
                                ? 'bg-[color:var(--accent-inbox-primary)] text-white hover:bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_88%,transparent)]'
                                : 'border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground hover:bg-surface-overlay-strong'), disabled: disabled || loading, "aria-disabled": disabled || loading, "aria-label": `${definition.label}${definition.shortcutDisplay ? ` (${definition.shortcutDisplay})` : ''}`, "aria-haspopup": "dialog", "aria-expanded": open, children: [loading ? (_jsx("span", { className: "size-4 rounded-full border-2 border-current border-t-transparent animate-spin" })) : null, !loading && Icon ? (_jsx(Icon, { className: cn('size-5 shrink-0', definition.intent === 'primary' ? 'text-white' : 'text-foreground'), "aria-hidden": true })) : null, _jsx("span", { className: "sr-only", children: definition.label })] }) }) }), _jsx(TooltipContent, { side: "bottom", sideOffset: 6, children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { children: definition.label }), definition.shortcutDisplay ? (_jsx("span", { className: "rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground", children: definition.shortcutDisplay })) : null] }) }), _jsxs(PopoverContent, { align: "start", className: "w-80 space-y-3 rounded-2xl border border-surface-overlay-glass-border bg-background p-4 shadow-[var(--shadow-lg)]", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-foreground", children: "Respons\u00E1vel" }), _jsx("p", { className: "text-sm text-foreground-muted", children: displayFirstName ? `Atual: ${displayFirstName}` : 'Nenhum responsável definido' })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wide text-foreground-muted", htmlFor: "assign-user-search", children: "Buscar agente" }), _jsx(Input, { id: "assign-user-search", placeholder: "Digite o nome", value: search, onChange: (event) => setSearch(event.target.value) })] }), renderUsers(), assignError ? (_jsx("p", { className: "text-sm text-status-error-foreground", role: "alert", children: assignError })) : null, _jsx(Button, { type: "button", className: "w-full", onClick: handleConfirm, disabled: !selectedUserId || isSubmitting, children: isSubmitting ? (_jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(Loader2, { className: "h-4 w-4 animate-spin", "aria-hidden": true }), "Atribuindo\u2026"] })) : ('Confirmar') })] })] }) }));
};
export default AssignTicketPopover;
