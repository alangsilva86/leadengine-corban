import type { StoreApi } from 'zustand/vanilla';
import type { InstancesStoreState, StoreEvents, InstancesLoadOptions, CreateInstancePayload, DeleteInstancePayload, ConnectInstancePayload, MarkConnectedPayload } from '../state/instancesStore';
import type { NormalizedInstance } from '../lib/instances';
export interface InstancesApiClient {
    get<T = unknown>(path: string): Promise<T>;
    post<T = unknown>(path: string, body: unknown): Promise<T>;
    delete<T = unknown>(path: string): Promise<T>;
}
export interface InstancesApiServiceOptions {
    store: StoreApi<InstancesStoreState>;
    events: StoreEvents;
    api: InstancesApiClient;
    logger?: {
        log?: (...args: unknown[]) => void;
        warn?: (...args: unknown[]) => void;
        error?: (...args: unknown[]) => void;
    };
    getAuthToken?: () => string | null;
}
export interface InstancesApiService {
    loadInstances(options?: InstancesLoadOptions): Promise<{
        success: boolean;
        status?: string | null;
        error?: unknown;
        skipped?: boolean;
    }>;
    createInstance(payload: CreateInstancePayload): Promise<NormalizedInstance | null>;
    deleteInstance(payload: DeleteInstancePayload): Promise<void>;
    connectInstance(payload: ConnectInstancePayload): Promise<{
        instanceId: string;
        status: string | null;
        connected: boolean | null;
        qr: unknown;
        instance: NormalizedInstance | null;
        instances: NormalizedInstance[];
    } | null>;
    markConnected(payload: MarkConnectedPayload): Promise<boolean>;
    dispose(): void;
}
export declare const createInstancesApiService: ({ store, events, api, logger, getAuthToken, }: InstancesApiServiceOptions) => InstancesApiService;
