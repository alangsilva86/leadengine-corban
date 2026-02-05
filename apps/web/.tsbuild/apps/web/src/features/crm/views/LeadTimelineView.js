import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { differenceInHours, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import ContactTimeline from '@/features/contacts/components/ContactTimeline.jsx';
import useCrmTimeline from '../hooks/useCrmTimeline';
import { useCrmViewState } from '../state/view-context';
const EVENT_TYPES = [
    { id: 'note', label: 'Notas' },
    { id: 'call', label: 'Chamadas' },
    { id: 'meeting', label: 'Reuniões' },
    { id: 'task', label: 'Tarefas' },
    { id: 'status_change', label: 'Status' },
    { id: 'message', label: 'Mensagens' },
];
const INACTIVITY_THRESHOLD_HOURS = 72;
const LeadTimelineView = () => {
    const { filters } = useCrmViewState();
    const [activeTypes, setActiveTypes] = useState([]);
    const { events, isLoading } = useCrmTimeline(filters, {
        eventTypes: activeTypes.length > 0 ? activeTypes : undefined,
        limit: 100,
    });
    const { items, inactivityGaps } = useMemo(() => augmentTimeline(events), [events]);
    const handleToggleType = (typeId) => {
        setActiveTypes((current) => {
            if (current.includes(typeId)) {
                return current.filter((item) => item !== typeId);
            }
            return [...current, typeId];
        });
    };
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs(Card, { className: "border border-border/60 bg-background/80 p-4", children: [_jsxs("header", { className: "flex flex-wrap items-center gap-3", children: [_jsx("h2", { className: "text-base font-semibold text-foreground", children: "Linha do tempo consolidada" }), _jsxs(Badge, { variant: "secondary", children: [events.length, " evento(s)"] }), _jsxs(Badge, { variant: inactivityGaps > 0 ? 'destructive' : 'outline', children: [inactivityGaps, " lacunas > 72h"] })] }), _jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-2", children: [EVENT_TYPES.map((type) => {
                                const active = activeTypes.includes(type.id);
                                return (_jsx(Button, { type: "button", size: "sm", variant: active ? 'default' : 'outline', onClick: () => handleToggleType(type.id), children: type.label }, type.id));
                            }), _jsx(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => setActiveTypes([]), disabled: activeTypes.length === 0, children: "Limpar filtros" })] })] }), _jsx(ContactTimeline, { items: items }), isLoading ? _jsx("p", { className: "text-sm text-muted-foreground", children: "Carregando eventos\u2026" }) : null] }));
};
const augmentTimeline = (events) => {
    if (!events.length) {
        return { items: [], inactivityGaps: 0 };
    }
    const sorted = [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const mapped = [];
    let inactivityGaps = 0;
    for (let index = 0; index < sorted.length; index += 1) {
        const current = sorted[index];
        const prev = sorted[index + 1];
        mapped.push({
            id: current.id,
            type: current.type ?? 'evento',
            createdAt: current.timestamp,
            description: current.description ?? current.title ?? 'Evento registrado.',
            metadata: current.metadata,
        });
        if (prev) {
            const currentDate = safeParse(current.timestamp);
            const prevDate = safeParse(prev.timestamp);
            if (currentDate && prevDate) {
                const diffHours = Math.abs(differenceInHours(currentDate, prevDate));
                if (diffHours >= INACTIVITY_THRESHOLD_HOURS) {
                    inactivityGaps += 1;
                    mapped.push({
                        id: `gap-${current.id}-${prev.id}`,
                        type: 'lacuna',
                        createdAt: prev.timestamp,
                        description: `Período de ${diffHours}h sem atividade registrada. Avalie reengajar o lead.`,
                    });
                }
            }
        }
    }
    return { items: mapped, inactivityGaps };
};
const safeParse = (value) => {
    if (!value)
        return null;
    try {
        return typeof value === 'string' ? parseISO(value) : new Date(value);
    }
    catch {
        return null;
    }
};
export default LeadTimelineView;
