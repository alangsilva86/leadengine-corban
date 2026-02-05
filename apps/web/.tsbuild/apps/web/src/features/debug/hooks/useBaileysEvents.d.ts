import { type DependencyList } from 'react';
type ErrorLike = {
    status?: number;
    statusCode?: number;
    response?: {
        status?: number;
        statusCode?: number;
        data?: unknown;
    };
    data?: unknown;
    message?: string;
};
type BaileysErrorState = {
    message: string;
    status: number | null;
    fallbackMessage: string | null;
    payload: unknown;
    timestamp: string;
    requestId: string | null;
    recoveryHint: string | null;
};
type UseBaileysEventsOptions = {
    buildQuery?: () => string;
    enabled?: boolean;
    dependencies?: DependencyList;
};
type BaileysEventsResult = {
    events: any[];
    loading: boolean;
    error: BaileysErrorState | null;
    degradedMode: boolean;
    refresh: () => void;
};
export declare const buildBaileysErrorState: (error: ErrorLike | unknown, previousState: BaileysErrorState | null) => BaileysErrorState;
export declare const formatDateTime: (value: unknown) => string;
export declare const parseBaileysEvents: (payload: unknown) => any[];
export declare const useBaileysEvents: (options?: UseBaileysEventsOptions) => BaileysEventsResult;
export type { BaileysErrorState };
