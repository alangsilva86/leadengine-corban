import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge.jsx';
import { Card } from '@/components/ui/card.jsx';
import { cn } from '@/lib/utils.js';
import LeadCard from './LeadCard';
const StageColumn = memo(({ stageId, title, leads, metrics }) => {
    const potentialLabel = metrics?.totalPotential
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.totalPotential)
        : null;
    const stalledCount = metrics?.stalledCount ?? 0;
    return (_jsx(Droppable, { droppableId: stageId, type: "lead", children: (provided, snapshot) => (_jsxs("div", { ref: provided.innerRef, ...provided.droppableProps, onClick: (event) => event.stopPropagation(), className: cn('flex h-full min-w-[280px] flex-1 flex-col gap-3 rounded-2xl border border-border/50 bg-muted/20 p-4 transition-all data-[active=true]:border-primary/60 data-[active=true]:bg-primary/5', snapshot.isDraggingOver && 'border-primary/60 bg-primary/10'), "data-active": snapshot.isDraggingOver ? 'true' : 'false', children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold uppercase tracking-wide text-muted-foreground", children: title }), _jsxs("p", { className: "text-xs text-muted-foreground/80", children: [leads.length, " lead(s)"] })] }), _jsxs("div", { className: "flex flex-col items-end gap-1", children: [potentialLabel ? _jsx(Badge, { variant: "secondary", children: potentialLabel }) : null, stalledCount > 0 ? (_jsxs(Badge, { variant: "destructive", className: "text-[0.65rem]", children: [stalledCount, " parado(s)"] })) : null] })] }), _jsxs("div", { className: "flex flex-1 flex-col gap-3", children: [leads.map((lead, index) => (_jsx(LeadCard, { lead: lead, index: index }, lead.id))), provided.placeholder, leads.length === 0 ? (_jsx(Card, { className: "flex flex-1 items-center justify-center border border-dashed border-border/60 bg-background/60 p-4 text-xs text-muted-foreground", children: "Nenhum lead nesta etapa." })) : null] })] })) }));
});
StageColumn.displayName = 'StageColumn';
export default StageColumn;
