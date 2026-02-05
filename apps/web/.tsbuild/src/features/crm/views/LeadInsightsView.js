import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { ArrowUpRight, Gauge, MessageCircle, Shuffle, Target, Timer, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import useCrmMetrics from '../hooks/useCrmMetrics';
import { formatDeltaLabel, formatMetricValue } from '../utils/metrics-format';
import { useCrmViewContext, useCrmViewState } from '../state/view-context';
import emitCrmTelemetry from '../utils/telemetry';
const INSIGHT_CONFIG = [
    {
        id: 'active-leads',
        label: 'Leads ativos',
        description: 'Leads aguardando movimentação. Abra o Kanban para priorizar.',
        icon: Users,
        targetView: 'kanban',
        metricId: 'activeLeads',
    },
    {
        id: 'sla-compliance',
        label: 'Cumprimento de SLA',
        description: 'Percentual dentro do SLA. Explore o mapa de envelhecimento.',
        icon: Gauge,
        targetView: 'aging',
        metricId: 'slaCompliance',
    },
    {
        id: 'first-response-time',
        label: '1ª resposta média',
        description: 'Tempo até responder novos leads. Veja as tarefas na Agenda.',
        icon: Timer,
        targetView: 'calendar',
        metricId: 'avgResponseTime',
    },
    {
        id: 'hot-conversations',
        label: 'Conversas em andamento',
        description: 'Monitore mensagens recentes e histórico completo.',
        icon: MessageCircle,
        targetView: 'timeline',
        metricId: 'newLeads',
    },
    {
        id: 'stalled-leads',
        label: 'Leads parados',
        description: 'Leads sem atividade recente. Verifique o Kanban.',
        icon: Shuffle,
        targetView: 'kanban',
        metricId: 'stalledLeads',
    },
    {
        id: 'conversion-rate',
        label: 'Taxa de conversão',
        description: 'Indicador de funil. Explore detalhes na Lista de leads.',
        icon: Target,
        targetView: 'list',
        metricId: 'conversionRate',
    },
];
const LeadInsightsView = () => {
    const { filters } = useCrmViewState();
    const { setView } = useCrmViewContext();
    const { metrics, isLoading, isFetching } = useCrmMetrics({ filters });
    const widgets = useMemo(() => buildWidgetMap(metrics.summary, metrics.source), [metrics.summary, metrics.source]);
    const loading = isLoading || isFetching;
    return (_jsx("div", { className: "grid gap-4 md:grid-cols-2 xl:grid-cols-3", children: INSIGHT_CONFIG.map((insight) => {
            const widget = widgets.get(insight.metricId);
            const Icon = insight.icon;
            return (_jsxs(Card, { className: "border border-border/60 bg-background/80 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md", children: [_jsxs(CardHeader, { className: "flex flex-col gap-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs(CardTitle, { className: "flex items-center gap-2 text-base font-semibold text-foreground", children: [_jsx("span", { className: "inline-flex items-center justify-center rounded-full bg-primary/10 p-2 text-primary", children: _jsx(Icon, { className: "h-4 w-4" }) }), insight.label] }), widget?.deltaLabel ? (_jsx(Badge, { variant: widget.isPositive ? 'secondary' : 'destructive', children: widget.deltaLabel })) : null] }), _jsx("p", { className: "text-xs text-muted-foreground", children: insight.description })] }), _jsxs(CardContent, { className: "flex flex-col gap-4", children: [loading && !widget ? (_jsx(Skeleton, { className: "h-10 w-32 rounded-md" })) : (_jsx("p", { className: "text-3xl font-semibold text-foreground", children: widget?.valueLabel ?? '—' })), _jsxs("div", { className: "flex items-center justify-between text-xs text-muted-foreground", children: [_jsx("span", { children: "Vis\u00E3o atualizada com dados recentes" }), metrics.source === 'fallback' ? _jsx(Badge, { variant: "outline", children: "Dados simulados" }) : null] }), _jsxs(Button, { type: "button", variant: "outline", onClick: () => {
                                    setView(insight.targetView);
                                    emitCrmTelemetry('crm.insights.navigate', {
                                        widgetId: insight.id,
                                        targetView: insight.targetView,
                                        metricId: insight.metricId,
                                    });
                                }, children: ["Explorar vis\u00E3o ", _jsx(ArrowUpRight, { className: "ml-2 h-4 w-4" })] })] })] }, insight.id));
        }) }));
};
const buildWidgetMap = (summary, source) => {
    const map = new Map();
    summary.forEach((metric) => {
        const valueLabel = formatMetricValue(metric.value, metric.unit);
        const deltaLabel = formatDeltaLabel(metric.delta ?? null, metric.deltaUnit ?? metric.unit);
        const isPositive = (metric.trend ?? 'flat') !== 'down';
        map.set(metric.id, {
            valueLabel,
            deltaLabel,
            isPositive,
            source,
        });
    });
    return map;
};
export default LeadInsightsView;
