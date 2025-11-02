export type CrmMetricUnit = 'count' | 'percentage' | 'currency' | 'duration';

export type CrmMetricTrend = 'up' | 'down' | 'flat';

export interface CrmMetricPrimitive {
  id: string;
  label: string;
  unit: CrmMetricUnit;
  value: number;
  delta?: number | null;
  deltaUnit?: CrmMetricUnit | 'percentage';
  trend?: CrmMetricTrend;
  description?: string | null;
}

export interface CrmMetricsSnapshot {
  summary: CrmMetricPrimitive[];
  retrievedAt: string;
  source: 'api' | 'fallback';
}

export interface CrmMetricsState {
  summary: CrmMetricPrimitive[];
  fetchedAt: string | null;
  source: 'api' | 'fallback';
}
