import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment } from 'react';
import { Activity, AlertTriangle, Clock4, Target, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { formatDeltaLabel, formatMetricValue } from '../utils/metrics-format';
const METRIC_CONFIG = {
    activeLeads: { id: 'activeLeads', icon: Users, tone: 'default', positiveTrendIsGood: true },
    newLeads: { id: 'newLeads', icon: TrendingUp, tone: 'success', positiveTrendIsGood: true },
    slaCompliance: { id: 'slaCompliance', icon: Target, tone: 'success', positiveTrendIsGood: true },
    avgResponseTime: { id: 'avgResponseTime', icon: Clock4, tone: 'default', positiveTrendIsGood: false },
    stalledLeads: { id: 'stalledLeads', icon: AlertTriangle, tone: 'warning', positiveTrendIsGood: false },
    conversionRate: { id: 'conversionRate', icon: Activity, tone: 'success', positiveTrendIsGood: true },
};
const resolveToneClass = (tone) => {
    switch (tone) {
        case 'success':
            return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
        case 'warning':
            return 'bg-amber-500/10 text-amber-600 dark:text-amber-300';
        default:
            return 'bg-primary/10 text-primary';
    }
};
const resolveTrendIndicator = (deltaLabel, trend, positiveIsGood) => {
    if (!deltaLabel || !trend || trend === 'flat') {
        return { label: deltaLabel ?? 'Estável', className: 'text-muted-foreground' };
    }
    const isPositive = trend === 'up';
    const isGood = isPositive === positiveIsGood;
    return {
        label: deltaLabel,
        className: isGood ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-500 dark:text-rose-300',
    };
};
const CrmMetricsBelt = ({ metrics, loading = false, source = 'api', onRefresh }) => {
    const cards = metrics.map((metric) => {
        const config = METRIC_CONFIG[metric.id] ?? {
            id: metric.id,
            icon: Activity,
            tone: 'default',
            positiveTrendIsGood: true,
        };
        const Icon = config.icon;
        const valueLabel = formatMetricValue(metric.value, metric.unit);
        const deltaLabel = formatDeltaLabel(metric.delta, metric.deltaUnit ?? metric.unit);
        const trendInfo = resolveTrendIndicator(deltaLabel, metric.trend ?? 'flat', config.positiveTrendIsGood);
        return {
            key: metric.id,
            label: metric.label,
            valueLabel,
            trendInfo,
            toneClass: resolveToneClass(config.tone),
            Icon,
            description: metric.description ?? null,
        };
    });
    return (_jsxs(Card, { className: "glass-surface border border-border/60 shadow-sm", children: [_jsxs(CardHeader, { className: "flex flex-col gap-1 border-b border-border/60 bg-muted/30 py-4 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { className: "space-y-1", children: [_jsx(CardTitle, { className: "text-base font-semibold text-foreground", children: "Indicadores do CRM" }), _jsxs("p", { className: "text-xs text-muted-foreground", children: ["Vis\u00E3o r\u00E1pida da sa\u00FAde dos leads. Valores alimentam as pr\u00F3ximas vis\u00F5es (Kanban, Lista, Painel).", source === 'fallback' ? ' Dados ilustrativos até a API estar disponível.' : null] })] }), onRefresh ? (_jsx(Button, { type: "button", size: "sm", variant: "outline", onClick: onRefresh, disabled: loading, children: "Atualizar m\u00E9tricas" })) : null] }), _jsx(CardContent, { className: "grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3", children: cards.map((card, index) => (_jsxs(Fragment, { children: [_jsxs("div", { className: "flex flex-col gap-3 rounded-xl border border-border/40 bg-background/80 p-4 shadow-sm", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { className: `inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${card.toneClass}`, children: [_jsx(card.Icon, { className: "h-3.5 w-3.5" }), card.label] }), loading ? (_jsx("div", { className: "h-3 w-12 animate-pulse rounded-full bg-muted" })) : (_jsx("span", { className: `text-xs font-medium ${card.trendInfo.className}`, children: card.trendInfo.label }))] }), _jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-2xl font-semibold text-foreground", children: loading ? _jsx("span", { className: "inline-flex h-7 w-24 animate-pulse rounded-md bg-muted" }) : card.valueLabel }), card.description ? _jsx("p", { className: "text-xs text-muted-foreground", children: card.description }) : null] })] }), (index + 1) % 3 === 0 && index < cards.length - 1 ? (_jsx(Separator, { className: "sm:hidden" })) : null] }, card.key))) })] }));
};
export default CrmMetricsBelt;
