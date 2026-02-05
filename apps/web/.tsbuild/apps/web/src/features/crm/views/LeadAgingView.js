import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Card } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { formatCurrency } from '@/lib/formatters/currency.ts';
import useCrmAging from '../hooks/useCrmAging';
import { useCrmViewContext, useCrmViewState } from '../state/view-context';
import emitCrmTelemetry from '../utils/telemetry';
const LeadAgingView = () => {
    const { filters } = useCrmViewState();
    const { selectIds, clearSelection, openLeadDrawer } = useCrmViewContext();
    const { summary, isLoading } = useCrmAging(filters);
    const { stages, buckets, maxCount, totalLeads } = useMemo(() => buildMatrix(summary.buckets), [summary.buckets]);
    return (_jsxs("div", { className: "flex flex-col gap-6", children: [_jsxs(Card, { className: "border border-border/60 bg-background/80 p-4", children: [_jsxs("header", { className: "flex flex-wrap items-center gap-3", children: [_jsx("h2", { className: "text-base font-semibold text-foreground", children: "Envelhecimento por etapa" }), _jsxs(Badge, { variant: "secondary", children: [totalLeads, " lead(s) analisados"] }), _jsxs(Badge, { variant: "outline", children: ["Atualizado em ", new Date(summary.generatedAt).toLocaleString('pt-BR')] })] }), _jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "Utilize o mapa para identificar gargalos. Clique em \"puxar para frente\" para criar uma tarefa de retomada no lead." })] }), _jsx(ScrollArea, { className: "w-full overflow-auto rounded-xl border border-border/60 bg-background/60", children: _jsxs("table", { className: "min-w-[680px] table-fixed border-collapse text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-border/60 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground", children: [_jsx("th", { className: "px-4 py-3 text-left", children: "Etapa" }), buckets.map((bucket) => (_jsx("th", { className: "px-4 py-3 text-center", children: bucket.bucketLabel }, bucket.bucketId))), _jsx("th", { className: "px-4 py-3 text-right", children: "Total" })] }) }), _jsx("tbody", { children: stages.map((stage) => (_jsxs("tr", { className: "border-b border-border/40", children: [_jsx("td", { className: "px-4 py-3 font-medium text-foreground", children: _jsxs("div", { className: "flex flex-col", children: [_jsx("span", { children: stage.stageName }), _jsxs("span", { className: "text-xs text-muted-foreground", children: [stage.total, " lead(s)"] })] }) }), buckets.map((bucket) => {
                                        const cell = stage.buckets[bucket.bucketId];
                                        const intensity = cell ? Math.min(1, cell.leadCount / Math.max(1, maxCount)) : 0;
                                        return (_jsx("td", { className: "px-2 py-2 text-center", children: _jsxs("div", { className: "relative flex flex-col items-center justify-center rounded-lg border border-border/40 px-3 py-2", style: {
                                                    backgroundColor: `rgba(30, 64, 175, ${intensity * 0.18})`,
                                                }, children: [_jsx("span", { className: "text-sm font-semibold text-foreground", children: cell?.leadCount ?? 0 }), _jsx("span", { className: "text-[0.7rem] text-muted-foreground", children: formatCurrency(cell?.potentialValue ?? null, {
                                                            fallback: '—',
                                                            minimumFractionDigits: 0,
                                                            maximumFractionDigits: 0,
                                                        }) }), cell && cell.leadCount > 0 ? (_jsx(Button, { type: "button", size: "sm", variant: "ghost", className: "mt-1 h-7 px-2 text-[0.65rem]", onClick: () => {
                                                            if (!cell.sampleLeadId) {
                                                                return;
                                                            }
                                                            clearSelection();
                                                            selectIds([cell.sampleLeadId]);
                                                            openLeadDrawer(cell.sampleLeadId);
                                                            emitCrmTelemetry('crm.lead.pull_forward', {
                                                                stageId: stage.stageId,
                                                                bucketId: bucket.bucketId,
                                                                leadId: cell.sampleLeadId,
                                                            });
                                                        }, children: "Puxar para frente" })) : null] }) }, bucket.bucketId));
                                    }), _jsx("td", { className: "px-4 py-3 text-right font-semibold text-foreground", children: stage.total })] }, stage.stageId))) })] }) }), isLoading ? _jsx("p", { className: "text-sm text-muted-foreground", children: "Carregando envelhecimento\u2026" }) : null] }));
};
const buildMatrix = (buckets) => {
    const stageMap = new Map();
    const bucketOrder = {};
    let maxCount = 0;
    let totalLeads = 0;
    buckets.forEach((entry) => {
        if (!bucketOrder[entry.bucketId]) {
            bucketOrder[entry.bucketId] = entry;
        }
        if (!stageMap.has(entry.stageId)) {
            stageMap.set(entry.stageId, { stageId: entry.stageId, stageName: entry.stageName, buckets: {}, total: 0 });
        }
        const stage = stageMap.get(entry.stageId);
        stage.buckets[entry.bucketId] = entry;
        stage.total += entry.leadCount;
        maxCount = Math.max(maxCount, entry.leadCount);
        totalLeads += entry.leadCount;
    });
    const orderedBuckets = Object.values(bucketOrder).sort((a, b) => a.bucketLabel.localeCompare(b.bucketLabel));
    const orderedStages = Array.from(stageMap.values());
    return {
        stages: orderedStages,
        buckets: orderedBuckets,
        maxCount,
        totalLeads,
    };
};
export default LeadAgingView;
