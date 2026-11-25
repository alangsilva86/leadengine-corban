import { Fragment } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
import { formatDeltaLabel, formatMetricValue } from '../utils/metrics-format';
import type { CrmMetricPrimitive } from '../state/metrics';

/** Frase curta por indicador: "12 leads ativos", "3 parados há 7+ dias". */
const PHRASES: Record<string, { singular: string; plural: string; tone?: 'warning'; positiveTrendIsGood?: boolean }> = {
  activeLeads: { singular: 'lead ativo', plural: 'leads ativos' },
  newLeads: { singular: 'novo em 7 dias', plural: 'novos em 7 dias' },
  stalledLeads: { singular: 'parado há 7+ dias', plural: 'parados há 7+ dias', tone: 'warning', positiveTrendIsGood: false },
};

type CrmMetricsBeltProps = {
  metrics: CrmMetricPrimitive[];
  loading?: boolean;
  source?: 'api' | 'fallback';
  onRefresh?: () => void;
  /** Valor em aberto já formatado (ex.: "R$ 58.400"), quando conhecido. */
  openValueLabel?: string | null;
  className?: string;
};

/**
 * Resumo do funil em uma linha (substitui os cartões de indicadores).
 * Variação só aparece quando a API informa `delta`; sem dado, não inventamos "Estável".
 */
const CrmMetricsBelt = ({ metrics, loading = false, source = 'api', onRefresh, openValueLabel, className }: CrmMetricsBeltProps) => {
  if (loading && metrics.length === 0) {
    return <span className={cn('inline-block h-4 w-72 animate-pulse rounded bg-muted align-middle', className)} aria-label="Carregando resumo" />;
  }

  const items = metrics.map((metric) => {
    const phrase = PHRASES[metric.id];
    const value = formatMetricValue(metric.value, metric.unit);
    const delta = formatDeltaLabel(metric.delta, metric.deltaUnit ?? metric.unit);
    const isGood = metric.trend === 'flat' || !metric.trend ? null : (metric.trend === 'up') === (phrase?.positiveTrendIsGood ?? true);
    const label = phrase ? (metric.value === 1 ? phrase.singular : phrase.plural) : metric.label.toLowerCase();
    const highlight = phrase?.tone === 'warning' && metric.value > 0;
    return { id: metric.id, value, label, delta, isGood, highlight, description: metric.description };
  });

  if (openValueLabel) {
    items.splice(1, 0, {
      id: 'openValue',
      value: openValueLabel,
      label: 'em aberto',
      delta: null,
      isGood: null,
      highlight: false,
      description: 'Soma do valor potencial dos leads em andamento.',
    });
  }

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground', className)}>
      {items.map((item, index) => (
        <Fragment key={item.id}>
          {index > 0 ? <span aria-hidden="true">·</span> : null}
          <span className={cn(item.highlight && 'text-warning-soft-foreground')} title={item.description ?? undefined}>
            <span className={cn('font-medium tabular-nums', item.highlight ? 'text-warning-soft-foreground' : 'text-foreground')}>
              {item.value}
            </span>{' '}
            {item.label}
            {item.delta ? (
              <span
                className={cn(
                  'ml-1 text-xs tabular-nums',
                  item.isGood === null ? 'text-muted-foreground' : item.isGood ? 'text-success-soft-foreground' : 'text-danger-soft-foreground'
                )}
              >
                ({item.delta})
              </span>
            ) : null}
          </span>
        </Fragment>
      ))}
      {items.length === 0 && !loading ? <span>{source === 'fallback' ? 'Resumo indisponível no momento' : 'Sem leads no funil'}</span> : null}
      {onRefresh ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground"
              onClick={onRefresh}
              disabled={loading}
              aria-label="Atualizar resumo"
            >
              <RefreshCw className={cn(loading && 'animate-spin')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Atualizar resumo</TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  );
};

export default CrmMetricsBelt;
