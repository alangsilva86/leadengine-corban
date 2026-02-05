import { type NormalizeOptions, type NormalizedInstance } from '../lib/instances';
export { resolveInstancePhone, selectPreferredInstance } from '../lib/instances';
type Nullable<T> = T | null;
export interface AgreementMeta {
    id: Nullable<string>;
    tenantId: Nullable<string>;
    name: Nullable<string>;
    region: Nullable<string>;
}
export declare const ensureAgreementMeta: (agreement: unknown) => AgreementMeta;
export declare const mergeInstancesById: <T extends {
    id?: Nullable<string>;
}>(currentList?: T[], updates?: T[]) => T[];
export interface StatusSourceOptions {
    explicitStatus?: Nullable<string>;
    explicitConnected?: Nullable<boolean>;
    currentStatus?: Nullable<string>;
    fallback?: string;
}
export declare const deriveStatusFromSources: ({ explicitStatus, explicitConnected, currentStatus, fallback, }?: StatusSourceOptions) => string;
export interface ReconcileInstancesPayload {
    instances?: unknown;
    instance?: unknown;
    status?: Nullable<string>;
    connected?: Nullable<boolean>;
}
export interface ReconcileInstancesOptions {
    preferredInstanceId?: Nullable<string>;
    campaignInstanceId?: Nullable<string>;
    normalizeOptions?: NormalizeOptions;
}
export interface ReconcileInstancesResult {
    instances: NormalizedInstance[];
    current: NormalizedInstance | null;
    status: string;
}
export declare const reconcileInstancesState: (existingList: NormalizedInstance[], { instances: rawInstances, instance: rawInstance, status, connected }?: ReconcileInstancesPayload, { preferredInstanceId, campaignInstanceId, normalizeOptions }?: ReconcileInstancesOptions) => ReconcileInstancesResult;
export interface ParsedRealtimeEvent {
    id: string;
    instanceId: string;
    type: string;
    status: Nullable<string>;
    connected: Nullable<boolean>;
    phoneNumber: Nullable<string>;
    timestamp: string;
}
export declare const parseRealtimeEvent: (event: unknown) => ParsedRealtimeEvent | null;
export declare const reduceRealtimeEvents: (events: ParsedRealtimeEvent[], rawEvent: unknown, limit?: number) => ParsedRealtimeEvent[];
export declare const buildTimelineEntries: (instance: NormalizedInstance | null | undefined, liveEvents?: ParsedRealtimeEvent[]) => ParsedRealtimeEvent[];
export interface FriendlyErrorCopy {
    code?: Nullable<string>;
    title?: Nullable<string>;
    description?: Nullable<string>;
}
export interface FriendlyError {
    code: Nullable<string>;
    title: string;
    message: string;
}
export type CopyResolver = (code: Nullable<string>, message: string) => FriendlyErrorCopy | null | undefined;
export declare const resolveFriendlyError: (resolveCopy: CopyResolver, error: unknown, fallbackMessage: string) => FriendlyError;
export declare const filterDisplayableInstances: (instances: NormalizedInstance[] | undefined) => NormalizedInstance[];
export declare const mapToNormalizedInstances: (list: unknown, options?: NormalizeOptions) => NormalizedInstance[];
export declare const normalizeInstancePayload: (payload: unknown) => NormalizedInstance | null;
