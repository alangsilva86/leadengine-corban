import { useMemo } from 'react';
import type { ComponentType } from 'react';
import { AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { ErrorState } from '@/components/page';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { cn } from '@/lib/utils.js';
import useCrmMetrics from '../hooks/useCrmMetrics';
import useCrmLeads from '../hooks/useCrmLeads';
import { formatDeltaLabel, formatMetricValue } from '../utils/metrics-format';
import { formatCount } from '../utils/labels';
import { LEAD_STAGES, LEAD_STAGE_DEFINITIONS, LEAD_STAGE_TONE_CLASSES } from '../utils/lead-stage';
import { useCrmViewContext, useCrmViewState } from '../state/view-context';
import type { CrmViewType } from '../state/view-context';
import emitCrmTelemetry from '../utils/telemetry';
import { formatBRL } from '@/lib/currency';

/**
 * Painel: só indicadores que a API realmente calcula (sem SLA/1ª resposta inventados)
 * e a distribuição do funil por etapa, a partir dos leads carregados.
 */
const KNOWN_METRICS: Record<string, { label: string; hint: string; icon: ComponentType<{ className?: string }>; targetView: CrmViewType; warn?: boolean }> = {
  activeLeads: { label: 'Leads ativos', hint: 'Em andamento no funil', icon: Users, targetView: 'kanban' },
  newLeads: { label: 'Novos em 7 dias', hint: 'Criados na última semana', icon: TrendingUp, targetView: 'list' },
  stalledLeads: { label: 'Parados há 7+ dias', hint: 'Sem atualização há uma semana', icon: AlertTriangle, targetView: 'aging', warn: true },
};

const LeadInsightsView = () => {
  const { filters } = useCrmViewState();
  const { setView } = useCrmViewContext();
  const { metrics, isLoading, error, refetch } = useCrmMetrics({ filters });
  const { leads, hasNextPage, isLoading: leadsLoading } = useCrmLeads(filters);

  const cards = metrics.summary.filter((metric) => KNOWN_METRICS[metric.id]);

  const distribution = useMemo(() => {
    const rows = LEAD_STAGES.map((stageId) => {
      const definition = LEAD_STAGE_DEFINITIONS[stageId];
      const stageLeads = leads.filter((lead) => lead.stage === stageId);
      return {
        id: stageId,
        label: definition.label,
        exit: definition.exit,
        barClass: LEAD_STAGE_TONE_CLASSES[definition.tone].dot,
        count: stageLeads.length,
        value: stageLeads.reduce((sum, lead) => sum + (lead.potentialValue ?? 0), 0),
      };
    });
    const max = Math.max(1, ...rows.map((row) => row.count));
    return { rows, max };
  }, [leads]);

  const goTo = (view: CrmViewType, metricId: string) => {
    setView(view);
    emitCrmTelemetry('crm.insights.navigate', { targetView: view, metricId });
  };

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-border bg-surface">
          <ErrorState size="compact" title="Não foi possível carregar os indicadores" error={error} onRetry={() => void refetch()} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {isLoading && cards.length === 0
            ? Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-lg" />)
            : cards.map((metric) => {
                const config = KNOWN_METRICS[metric.id];
                const Icon = config.icon;
                const delta = formatDeltaLabel(metric.delta, metric.deltaUnit ?? metric.unit);
                const warn = config.warn && metric.value > 0;
                return (
                  <button
                    key={metric.id}
                    type="button"
                    onClick={() => goTo(config.targetView, metric.id)}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Icon className={cn('size-4', warn && 'text-warning-soft-foreground')} aria-hidden="true" />
                      {config.label}
                    </span>
                    <span className={cn('text-2xl font-semibold tabular-nums', warn ? 'text-warning-soft-foreground' : 'text-foreground')}>
                      {formatMetricValue(metric.value, metric.unit)}
                      {delta ? <span className="ml-2 text-sm font-normal text-muted-foreground">{delta}</span> : null}
                    </span>
                    <span className="text-xs text-muted-foreground">{config.hint}</span>
                  </button>
                );
              })}
        </div>
      )}

      <section className="rounded-lg border border-border bg-surface p-4" aria-labelledby="crm-insights-funnel">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="crm-insights-funnel" className="text-sm font-medium text-foreground">
            Distribuição por etapa
          </h2>
          {hasNextPage ? (
            <span className="text-xs text-muted-foreground">Considerando os {formatCount(leads.length)} leads mais recentes</span>
          ) : null}
        </div>
        {leadsLoading ? (
          <Skeleton className="h-40 w-full rounded-md" />
        ) : (
          <ul className="space-y-2.5">
            {distribution.rows.map((row, index) => (
              <li
                key={row.id}
                className={cn(
                  'grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3 text-sm',
                  row.exit && index > 0 && !distribution.rows[index - 1].exit && 'mt-4 border-t border-border pt-3.5'
                )}
              >
                <span className="text-muted-foreground">{row.label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
                  <span
                    className={cn('block h-full rounded-full', row.barClass)}
                    style={{ width: `${(row.count / distribution.max) * 100}%` }}
                  />
                </span>
                <span className="min-w-[120px] text-right tabular-nums text-foreground">
                  {formatCount(row.count)}
                  <span className="text-muted-foreground">{formatBRL(row.value) ? ` · ${formatBRL(row.value)}` : ''}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => goTo('kanban', 'distribution')}>
            Abrir o funil
          </Button>
        </div>
      </section>
    </div>
  );
};

export default LeadInsightsView;
