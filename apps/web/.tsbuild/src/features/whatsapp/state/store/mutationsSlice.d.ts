import type { InstancesStoreState, MutationsSlice, StoreEvents } from './types';
export declare const createMutationsSlice: (events: StoreEvents, set: (partial: Partial<InstancesStoreState> | ((state: InstancesStoreState) => Partial<InstancesStoreState>), replace?: boolean) => void, get: () => InstancesStoreState) => MutationsSlice;
