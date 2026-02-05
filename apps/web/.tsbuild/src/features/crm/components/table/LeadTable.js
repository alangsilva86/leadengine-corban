import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Inbox } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import LeadTableRow from './LeadTableRow';
const LeadTable = forwardRef(({ leads, selectedIds, onToggleSelect, onOpenDrawer, fetchNextPage, hasNextPage = false, isFetchingNextPage = false, isLoading = false, selectable = true, }, ref) => {
    const data = useMemo(() => leads ?? [], [leads]);
    const selectedSet = selectedIds instanceof Set ? selectedIds : new Set();
    const empty = !isLoading && data.length === 0;
    return (_jsxs("div", { ref: ref, className: "flex h-full min-h-[520px] flex-col overflow-hidden rounded-xl border border-border bg-background", children: [_jsxs("div", { className: "grid grid-cols-[32px,minmax(0,1.4fr),minmax(0,1fr),minmax(0,0.9fr),minmax(0,1fr),minmax(0,140px)] gap-3 border-b border-border/60 bg-muted/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: [_jsx("span", {}), _jsx("span", { children: "Lead" }), _jsx("span", { children: "Etapa / Origem" }), _jsx("span", { children: "Canal" }), _jsx("span", { children: "\u00DAltima atividade" }), _jsx("span", { className: "text-right", children: "Potencial" })] }), isLoading && data.length === 0 ? (_jsx("div", { className: "flex-1 space-y-3 overflow-hidden px-4 py-6", children: Array.from({ length: 6 }).map((_, index) => (_jsx(Skeleton, { className: "h-24 w-full rounded-lg" }, index))) })) : empty ? (_jsxs("div", { className: "flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center text-sm text-muted-foreground", children: [_jsx(Inbox, { className: "h-10 w-10 text-muted-foreground/70" }), _jsx("p", { children: "Nenhum lead encontrado com os filtros atuais." }), _jsx("p", { className: "text-xs", children: "Ajuste filtros ou importe novos leads para continuar trabalhando seu funil." })] })) : (_jsx("div", { className: "flex-1", children: _jsx(Virtuoso, { data: data, style: { height: '100%' }, overscan: 200, endReached: () => {
                        if (hasNextPage && !isFetchingNextPage) {
                            fetchNextPage?.();
                        }
                    }, itemKey: (index, lead) => lead.id ?? String(index), itemContent: (index, lead) => (_jsx(LeadTableRow, { lead: lead, selected: selectedSet.has(lead.id), onToggleSelect: onToggleSelect, onOpenDrawer: onOpenDrawer, selectable: selectable })), components: {
                        Footer: () => (_jsx("div", { className: "flex items-center justify-center px-4 py-4 text-xs text-muted-foreground", children: hasNextPage
                                ? isFetchingNextPage
                                    ? 'Carregando mais leads…'
                                    : 'Role para carregar mais leads'
                                : 'Fim da lista' })),
                    } }) }))] }));
});
LeadTable.displayName = 'LeadTable';
export default LeadTable;
