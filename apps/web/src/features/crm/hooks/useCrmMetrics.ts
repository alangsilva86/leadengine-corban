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

const EMPTY_METRICS: CrmMetricsSnapshot = { summary: [], retrievedAt: '', source: 'fallback' };

const normalizeMetricsResponse = (payload: unknown): CrmMetricsSnapshot => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Resposta inválida ao carregar indicadores.');
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
          : inferTrend(delta) ?? 'flat';

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

  const response = await apiGet(`/api/crm/metrics?${query}`);
  return normalizeMetricsResponse(response?.data ?? response);
};

export const useCrmMetrics = ({ filters, enabled = true }: UseCrmMetricsOptions) => {
  const serializedFilters = serializeCrmFilters(filters);

  const queryResult = useQuery<CrmMetricsSnapshot>({
    queryKey: ['crm', 'metrics', serializedFilters],
    queryFn: () => fetchCrmMetrics(filters),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const data = queryResult.data ?? EMPTY_METRICS;

  const metrics: CrmMetricsQueryResult = useMemo(
    () => ({
      summary: data.summary,
      fetchedAt: data.retrievedAt || null,
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
