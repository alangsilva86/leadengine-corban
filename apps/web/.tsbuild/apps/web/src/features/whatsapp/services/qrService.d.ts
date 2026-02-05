import type { StoreApi } from 'zustand/vanilla';
import type { InstancesStoreState, StoreEvents } from '../state/instancesStore';
export interface QrApiClient {
    get<T = unknown>(path: string, options?: Record<string, unknown>): Promise<T>;
}
export interface QrServiceOptions {
    store: StoreApi<InstancesStoreState>;
    events: StoreEvents;
    api: QrApiClient;
    logger?: {
        log?: (...args: unknown[]) => void;
        warn?: (...args: unknown[]) => void;
        error?: (...args: unknown[]) => void;
    };
}
export declare const createQrService: ({ store, events, api, logger }: QrServiceOptions) => () => void;
