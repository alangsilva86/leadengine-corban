import type { CrmMetricTrend, CrmMetricUnit } from '../state/metrics';
export declare const formatMetricValue: (value: number, unit: CrmMetricUnit) => string;
export declare const formatDeltaLabel: (delta: number | null | undefined, unit: CrmMetricUnit | "percentage") => string | null;
export declare const inferTrend: (delta: number | null | undefined) => CrmMetricTrend;
