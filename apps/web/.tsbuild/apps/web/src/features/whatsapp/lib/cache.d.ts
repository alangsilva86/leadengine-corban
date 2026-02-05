export interface InstancesCacheEntry {
    schemaVersion: number;
    list: unknown[];
    currentId: string | null;
    updatedAt: number;
}
export declare const readInstancesCache: () => InstancesCacheEntry | null;
export declare const persistInstancesCache: (list: unknown[], currentId: string | null) => void;
export declare const clearInstancesCache: () => void;
export declare const cacheConstants: {
    INSTANCES_CACHE_KEY: string;
    INSTANCES_CACHE_VERSION: number;
};
