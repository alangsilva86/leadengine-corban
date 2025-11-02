import { useMemo } from 'react';
import type { ComponentType } from 'react';
import { ArrowUpRight, Gauge, MessageCircle, Shuffle, Target, Timer, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import useCrmMetrics from '../hooks/useCrmMetrics';
import { formatDeltaLabel, formatMetricValue } from '../utils/metrics-format';
import { useCrmViewContext, useCrmViewState } from '../state/view-context';
import emitCrmTelemetry from '../utils/telemetry';
import type { CrmViewType } from '../state/view-context';

const INSIGHT_CONFIG: Array<{
  id: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  targetView: CrmViewType;
  metricId: string;
}> = [
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

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {INSIGHT_CONFIG.map((insight) => {
        const widget = widgets.get(insight.metricId);
        const Icon = insight.icon;

        return (
          <Card
            key={insight.id}
            className="border border-border/60 bg-background/80 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <CardHeader className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <span className="inline-flex items-center justify-center rounded-full bg-primary/10 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  {insight.label}
                </CardTitle>
                {widget?.deltaLabel ? (
                  <Badge variant={widget.isPositive ? 'secondary' : 'destructive'}>{widget.deltaLabel}</Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">{insight.description}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {loading && !widget ? (
                <Skeleton className="h-10 w-32 rounded-md" />
              ) : (
                <p className="text-3xl font-semibold text-foreground">{widget?.valueLabel ?? '—'}</p>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Visão atualizada com dados recentes</span>
                {metrics.source === 'fallback' ? <Badge variant="outline">Dados simulados</Badge> : null}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setView(insight.targetView);
                  emitCrmTelemetry('crm.insights.navigate', {
                    widgetId: insight.id,
                    targetView: insight.targetView,
                    metricId: insight.metricId,
                  });
                }}
              >
                Explorar visão <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

const buildWidgetMap = (
  summary: ReturnType<typeof useCrmMetrics>['metrics']['summary'],
  source: 'api' | 'fallback'
): Map<string, { valueLabel: string; deltaLabel: string | null; isPositive: boolean; source: 'api' | 'fallback' }> => {
  const map = new Map<string, { valueLabel: string; deltaLabel: string | null; isPositive: boolean; source: 'api' | 'fallback' }>();

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
