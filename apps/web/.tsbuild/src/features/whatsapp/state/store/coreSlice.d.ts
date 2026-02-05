import type { InstancesSlice, InstancesStoreDependencies, InstancesStoreState, StoreEvents, InstancesConfig } from './types';
declare const DEFAULT_CONFIG: InstancesConfig;
declare const hasConfigChanged: (current: InstancesConfig, next: InstancesConfig) => boolean;
export declare const createCoreSlice: (set: (partial: Partial<InstancesStoreState> | ((state: InstancesStoreState) => Partial<InstancesStoreState>), replace?: boolean) => void, get: () => InstancesStoreState, events: StoreEvents, deps: InstancesStoreDependencies) => InstancesSlice;
export { DEFAULT_CONFIG, hasConfigChanged };
