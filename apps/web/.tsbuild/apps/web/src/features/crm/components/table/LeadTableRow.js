import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils.js';
const formatActivity = (value) => {
    if (!value) {
        return 'Sem atividade';
    }
    try {
        return formatDistanceToNow(new Date(value), { addSuffix: true, locale: ptBR });
    }
    catch {
        return 'Atividade desconhecida';
    }
};
const formatValue = (value) => {
    if (!value)
        return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
};
const LeadTableRow = memo(({ lead, selected, onToggleSelect, onOpenDrawer, selectable = true }) => {
    return (_jsxs("div", { className: cn('grid grid-cols-[32px,minmax(0,1.4fr),minmax(0,1fr),minmax(0,0.9fr),minmax(0,1fr),minmax(0,140px)] items-center gap-3 border-b border-border/50 bg-background px-4 py-3 text-sm transition hover:bg-muted/30', selected && 'bg-primary/5'), role: "row", children: [_jsx("div", { className: "flex items-center justify-center", role: "gridcell", children: _jsx(Checkbox, { checked: selected, disabled: !selectable, onCheckedChange: () => selectable && onToggleSelect(lead.id), "aria-label": `Selecionar lead ${lead.name}` }) }), _jsxs("button", { type: "button", className: "flex min-w-0 flex-col items-start gap-1 text-left", onClick: () => onOpenDrawer(lead.id), children: [_jsx("span", { className: "truncate text-sm font-medium text-foreground", children: lead.name }), _jsx("span", { className: "truncate text-xs text-muted-foreground", children: lead.ownerName ?? 'Sem responsável definido' })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs text-muted-foreground", role: "gridcell", children: [_jsx(Badge, { variant: "outline", className: "text-[0.65rem] uppercase tracking-wide", children: lead.stage ?? 'Sem etapa' }), _jsx("span", { children: lead.source ?? 'Origem desconhecida' })] }), _jsx("div", { className: "text-xs text-muted-foreground", role: "gridcell", children: lead.channel ?? 'Canal indeterminado' }), _jsx("div", { className: "text-xs text-muted-foreground", role: "gridcell", children: formatActivity(lead.lastActivityAt) }), _jsxs("div", { className: "flex items-center justify-end gap-2", role: "gridcell", children: [_jsx("span", { className: "text-sm font-medium text-foreground", children: formatValue(lead.potentialValue ?? null) }), _jsx(Button, { type: "button", size: "sm", variant: "outline", onClick: () => onOpenDrawer(lead.id), children: "Abrir" })] })] }));
});
LeadTableRow.displayName = 'LeadTableRow';
export default LeadTableRow;
