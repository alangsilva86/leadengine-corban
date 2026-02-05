import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { createEvents } from './events';
import { createCoreSlice } from './coreSlice';
import { createQrSlice } from './qrSlice';
import { createRealtimeSlice } from './realtimeSlice';
import { createMutationsSlice } from './mutationsSlice';
import { resolveNormalizedInstanceStatus } from '../../lib/instances';
export const createInstancesStore = (deps) => {
    const events = createEvents();
    const store = createStore((set, get) => ({
        ...createCoreSlice(set, get, events, deps),
        ...createQrSlice(set, get, events),
        ...createRealtimeSlice(set, get),
        ...createMutationsSlice(events, set, get),
    }));
    return {
        store,
        events,
        deps,
        selectRealtimeConnected: (state) => state.realtimeConnected,
        selectSelectedInstanceStatus: (state) => resolveNormalizedInstanceStatus(state.currentInstance),
    };
};
const InstancesStoreContext = createContext(null);
export const InstancesStoreProvider = InstancesStoreContext.Provider;
export const useInstancesStoreBundle = () => {
    const ctx = useContext(InstancesStoreContext);
    if (!ctx) {
        throw new Error('WhatsApp Instances store não foi inicializado.');
    }
    return ctx;
};
export const useInstancesStore = (selector, equalityFn) => {
    const { store } = useInstancesStoreBundle();
    return useStore(store, selector, equalityFn);
};
export * from './types';
