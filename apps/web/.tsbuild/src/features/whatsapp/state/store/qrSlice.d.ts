import type { InstancesStoreState, QrSlice, StoreEvents } from './types';
export declare const createQrSlice: (set: (partial: Partial<InstancesStoreState> | ((state: InstancesStoreState) => Partial<InstancesStoreState>), replace?: boolean) => void, get: () => InstancesStoreState, events: StoreEvents) => QrSlice;
