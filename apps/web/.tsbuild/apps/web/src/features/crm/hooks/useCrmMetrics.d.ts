import type { CrmFilterState } from '../state/types';
import type { CrmMetricPrimitive, CrmMetricsSnapshot } from '../state/metrics';
type UseCrmMetricsOptions = {
    filters: CrmFilterState;
    enabled?: boolean;
};
type CrmMetricsQueryResult = {
    summary: CrmMetricPrimitive[];
    source: 'api' | 'fallback';
    fetchedAt: string | null;
};
export declare const useCrmMetrics: ({ filters, enabled }: UseCrmMetricsOptions) => {
    metrics: CrmMetricsQueryResult;
    isLoading: boolean;
    isFetching: boolean;
    error: Error | null;
    refetch: (options?: import("@tanstack/react-query").RefetchOptions) => Promise<import("@tanstack/react-query").QueryObserverResult<CrmMetricsSnapshot, Error>>;
};
export type { CrmMetricsQueryResult };
export default useCrmMetrics;
