export declare const toNumber: (value: unknown) => number | null;
export declare const pickMetric: (source: unknown, keys: string[]) => number | undefined;
declare const DEFAULT_STATUS_KEYS: readonly ["1", "2", "3", "4", "5"];
type DefaultStatusKey = (typeof DEFAULT_STATUS_KEYS)[number];
export type StatusCounts = Record<DefaultStatusKey, number> & Record<string, number>;
export declare const findStatusCountsSource: (source: unknown) => Record<string, unknown> | number[] | undefined;
export declare const normalizeStatusCounts: (rawCounts: unknown) => StatusCounts;
export interface NormalizedRateUsage {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
}
export declare const findRateSource: (source: unknown) => Record<string, unknown> | number[] | undefined;
export declare const normalizeRateUsage: (rawRate: unknown) => NormalizedRateUsage;
export declare const mergeMetricsSources: (...sources: unknown[]) => Record<string, unknown>;
export interface InstanceMetrics {
    sent: number;
    queued: number;
    failed: number;
    status: StatusCounts;
    rateUsage: NormalizedRateUsage;
}
export declare const getInstanceMetrics: (instance: unknown) => InstanceMetrics;
export {};
