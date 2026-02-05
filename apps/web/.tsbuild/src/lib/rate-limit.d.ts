export function parseRetryAfterMs(retryAfter: any): number | null;
export function computeBackoffDelay(attempt?: number, { baseMs, maxMs }?: {
    baseMs?: number | undefined;
    maxMs?: number | undefined;
}): number;
export namespace RATE_LIMIT_DEFAULTS {
    export { DEFAULT_BASE_DELAY_MS as baseDelayMs };
    export { DEFAULT_MAX_DELAY_MS as maxDelayMs };
}
declare const DEFAULT_BASE_DELAY_MS: 2000;
declare const DEFAULT_MAX_DELAY_MS: 30000;
export {};
