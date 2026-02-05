export declare const looksLikeWhatsAppJid: (value: unknown) => value is string;
export declare const VISIBLE_INSTANCE_STATUSES: Set<string>;
export declare const isPlainRecord: (value: unknown) => value is Record<string, unknown>;
export declare const pickStringValue: (...values: unknown[]) => string | null;
export declare const readTenantString: (value: unknown) => string | null;
export declare const resolveTenantId: (record: unknown) => string | null;
export declare const resolveTenantDisplayName: (record: unknown) => string | null;
export declare const extractInstanceFromPayload: (payload: unknown) => Record<string, unknown> | null;
export declare const formatInstanceDisplayId: (value: string | null | undefined) => string;
export declare const ensureArrayOfObjects: <T extends Record<string, unknown>>(value: unknown) => T[];
export interface NormalizedInstance {
    id: string;
    tenantId: string | null;
    name: string | null;
    phoneNumber: string | null;
    status: string;
    connected: boolean;
    displayId: string;
    source: string | null;
    metadata: Record<string, unknown>;
    [key: string]: unknown;
}
export declare const normalizeInstanceRecord: (entry: unknown) => NormalizedInstance | null;
export interface NormalizeOptions {
    allowedTenants?: string[];
    filterByTenant?: boolean;
    enforceTenantScope?: boolean;
}
export declare const normalizeInstancesCollection: (rawList: unknown, options?: NormalizeOptions) => NormalizedInstance[];
export declare const unwrapWhatsAppResponse: (payload: unknown) => unknown;
export interface ParsedInstancesPayload {
    raw: unknown;
    data: unknown;
    instances: NormalizedInstance[];
    instance: NormalizedInstance | null;
    status: string | null;
    statusPayload: unknown;
    connected: boolean | null;
    instanceId: string | null;
    qr: unknown;
}
export declare const parseInstancesPayload: (payload: unknown) => ParsedInstancesPayload;
export declare const resolveInstanceStatus: (instance: unknown) => string | null;
export interface InstanceStatusInfo {
    label: string;
    variant: string;
    status?: string;
    connected?: boolean;
}
export declare const resolveNormalizedInstanceStatus: (instance: unknown) => string;
export declare const getStatusInfo: (instance: unknown) => InstanceStatusInfo;
export declare const resolveInstancePhone: (instance: unknown) => string;
export declare const shouldDisplayInstance: (instance: unknown) => boolean;
export interface SelectInstanceOptions {
    preferredInstanceId?: string | null;
    campaignInstanceId?: string | null;
}
export declare const selectPreferredInstance: (list: NormalizedInstance[], options?: SelectInstanceOptions) => NormalizedInstance | null;
