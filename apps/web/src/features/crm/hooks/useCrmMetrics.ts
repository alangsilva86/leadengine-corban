import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api.js';
import { serializeCrmFilters } from '../utils/filter-serialization';
import type { CrmFilterState } from '../state/types';
import type { CrmMetricPrimitive, CrmMetricsSnapshot } from '../state/metrics';
import { inferTrend } from '../utils/metrics-format';

type UseCrmMetricsOptions = {
  filters: CrmFilterState;
  enabled?: boolean;
};

type CrmMetricsQueryResult = {
  summary: CrmMetricPrimitive[];
  source: 'api' | 'fallback';
  fetchedAt: string | null;
};

const FALLBACK_METRICS: CrmMetricsSnapshot = {
  summary: [
    {
      id: 'activeLeads',
      label: 'Leads ativos',
      unit: 'count',
      value: 128,
      delta: 6,
      deltaUnit: 'count',
      trend: 'up',
    },
    {
      id: 'newLeads',
      label: 'Novos (7d)',
      unit: 'count',
      value: 42,
      delta: 8,
      deltaUnit: 'count',
      trend: 'up',
    },
    {
      id: 'slaCompliance',
      label: 'Dentro do SLA',
      unit: 'percentage',
      value: 86,
      delta: -4,
      deltaUnit: 'percentage',
      trend: 'down',
    },
    {
      id: 'avgResponseTime',
      label: '1ª resposta média',
      unit: 'duration',
      value: 68,
      delta: -12,
      deltaUnit: 'duration',
      trend: 'up',
    },
    {
      id: 'stalledLeads',
      label: 'Sem atividade (7d)',
      unit: 'count',
      value: 17,
      delta: 2,
      deltaUnit: 'count',
      trend: 'down',
    },
    {
      id: 'conversionRate',
      label: 'Taxa de conversão',
      unit: 'percentage',
      value: 28,
      delta: 3,
      deltaUnit: 'percentage',
      trend: 'up',
    },
  ],
  retrievedAt: new Date().toISOString(),
  source: 'fallback',
};

const normalizeMetricsResponse = (payload: unknown): CrmMetricsSnapshot => {
  if (!payload || typeof payload !== 'object') {
    return FALLBACK_METRICS;
  }

  const maybeSummary = Array.isArray((payload as any).summary) ? (payload as any).summary : [];

  const summary: CrmMetricPrimitive[] = maybeSummary
    .map((entry: any) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const id = typeof entry.id === 'string' ? entry.id : null;
      const label = typeof entry.label === 'string' ? entry.label : id;
      const unit = entry.unit === 'count' || entry.unit === 'percentage' || entry.unit === 'currency' || entry.unit === 'duration'
        ? entry.unit
        : 'count';
      const value = Number(entry.value);
      if (!id || !Number.isFinite(value)) {
        return null;
      }
      const delta = entry.delta == null ? null : Number(entry.delta);
      const deltaUnit =
        entry.deltaUnit === 'count' ||
        entry.deltaUnit === 'percentage' ||
        entry.deltaUnit === 'currency' ||
        entry.deltaUnit === 'duration'
          ? entry.deltaUnit
          : unit;
      const trend: CrmMetricPrimitive['trend'] =
        entry.trend === 'up' || entry.trend === 'down' || entry.trend === 'flat'
          ? entry.trend
          : inferTrend(delta);

      return {
        id,
        label: label ?? id,
        unit,
        value,
        delta,
        deltaUnit,
        trend,
        description: typeof entry.description === 'string' ? entry.description : null,
      } satisfies CrmMetricPrimitive;
    })
    .filter(Boolean) as CrmMetricPrimitive[];

  if (summary.length === 0) {
    return FALLBACK_METRICS;
  }

  const retrievedAt =
    typeof (payload as any).retrievedAt === 'string' ? (payload as any).retrievedAt : new Date().toISOString();

  return {
    summary,
    retrievedAt,
    source: 'api',
  };
};

const fetchCrmMetrics = async (filters: CrmFilterState): Promise<CrmMetricsSnapshot> => {
  const serializedFilters = serializeCrmFilters(filters);
  const query = new URLSearchParams({ filters: serializedFilters });

  try {
    const response = await apiGet(`/api/crm/metrics?${query.toString()}`);
    const payload = response?.data ?? response;
    return normalizeMetricsResponse(payload);
  } catch (error) {
    console.warn('[CRM] Falha ao carregar métricas. Usando fallback local.', error);
    return FALLBACK_METRICS;
  }
};

export const useCrmMetrics = ({ filters, enabled = true }: UseCrmMetricsOptions) => {
  const serializedFilters = serializeCrmFilters(filters);

  const queryResult = useQuery<CrmMetricsSnapshot>({
    queryKey: ['crm', 'metrics', serializedFilters],
    queryFn: () => fetchCrmMetrics(filters),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData ?? FALLBACK_METRICS,
  });

  const data = queryResult.data ?? FALLBACK_METRICS;

  const metrics: CrmMetricsQueryResult = useMemo(
    () => ({
      summary: data.summary,
      fetchedAt: data.retrievedAt ?? null,
      source: data.source ?? 'fallback',
    }),
    [data]
  );

  return {
    metrics,
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    error: queryResult.error instanceof Error ? queryResult.error : null,
    refetch: queryResult.refetch,
  };
};

export type { CrmMetricsQueryResult };
export default useCrmMetrics;
