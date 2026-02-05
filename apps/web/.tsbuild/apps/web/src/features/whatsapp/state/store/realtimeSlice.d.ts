import type { InstancesStoreState, RealtimeSlice } from './types';
export declare const createRealtimeSlice: (set: (partial: Partial<InstancesStoreState> | ((state: InstancesStoreState) => Partial<InstancesStoreState>), replace?: boolean) => void, get: () => InstancesStoreState) => RealtimeSlice;
