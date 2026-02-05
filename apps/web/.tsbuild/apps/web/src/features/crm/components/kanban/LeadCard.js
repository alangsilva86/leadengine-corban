import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Activity, Clock3, MessageSquare, User } from 'lucide-react';
import { Card } from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils.js';
import { useCrmViewContext } from '../../state/view-context';
import emitCrmTelemetry from '../../utils/telemetry';
const formatPotential = (value) => {
    if (!value)
        return null;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
};
const formatRelative = (value) => {
    if (!value)
        return 'Sem atividade recente';
    try {
        const diff = Date.now() - new Date(value).getTime();
        const hours = Math.max(1, Math.floor(diff / (1000 * 60 * 60)));
        return `${hours}h atrás`;
    }
    catch {
        return 'Atividade desconhecida';
    }
};
const LeadCard = memo(({ lead, index }) => {
    const { state, openLeadDrawer, selectIds, clearSelection } = useCrmViewContext();
    const selected = state.selection.selectedIds.has(lead.id);
    return (_jsx(Draggable, { draggableId: lead.id, index: index, children: (provided, snapshot) => (_jsxs(Card, { ref: provided.innerRef, ...provided.draggableProps, ...provided.dragHandleProps, onClick: (event) => {
                event.stopPropagation();
                clearSelection();
                selectIds([lead.id]);
                openLeadDrawer(lead.id);
                emitCrmTelemetry('crm.lead.open', { source: 'kanban', leadId: lead.id, stageId: lead.stage });
            }, className: cn('cursor-grab rounded-xl border border-border/40 bg-background/80 p-3 text-sm transition-shadow hover:shadow-md', selected && 'border-primary shadow-lg', snapshot.isDragging && 'border-primary shadow-lg'), children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-foreground", children: lead.name }), _jsx("p", { className: "text-xs text-muted-foreground", children: lead.ownerName ?? 'Sem responsável' })] }), _jsx("span", { className: "text-xs text-muted-foreground", children: formatPotential(lead.potentialValue) })] }), _jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground", children: [_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Clock3, { className: "h-3.5 w-3.5" }), formatRelative(lead.lastActivityAt)] }), _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(MessageSquare, { className: "h-3.5 w-3.5" }), lead.channel ?? 'Canal indeterminado'] }), _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(User, { className: "h-3.5 w-3.5" }), lead.source ?? 'Origem desconhecida'] }), _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Activity, { className: "h-3.5 w-3.5" }), lead.status] })] })] })) }));
});
LeadCard.displayName = 'LeadCard';
export default LeadCard;
