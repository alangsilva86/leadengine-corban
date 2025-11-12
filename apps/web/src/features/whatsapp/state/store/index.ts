import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { InstancesStoreBundle, InstancesStoreDependencies, InstancesStoreState } from './types';
import { createEvents } from './events';
import { createCoreSlice } from './coreSlice';
import { createQrSlice } from './qrSlice';
import { createRealtimeSlice } from './realtimeSlice';
import { createMutationsSlice } from './mutationsSlice';

export const createInstancesStore = (
  deps: InstancesStoreDependencies,
): InstancesStoreBundle => {
  const events = createEvents();
  const store = createStore<InstancesStoreState>((set, get) => ({
    ...createCoreSlice(set, get, events, deps),
    ...createQrSlice(set, get, events),
    ...createRealtimeSlice(set),
    ...createMutationsSlice(events, set, get),
  }));

  return { store, events, deps };
};

const InstancesStoreContext = createContext<InstancesStoreBundle | null>(null);

export const InstancesStoreProvider = InstancesStoreContext.Provider;

export const useInstancesStoreBundle = () => {
  const ctx = useContext(InstancesStoreContext);
  if (!ctx) {
    throw new Error('WhatsApp Instances store não foi inicializado.');
  }
  return ctx;
};

export const useInstancesStore = <T,>(
  selector: (state: InstancesStoreState) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T => {
  const { store } = useInstancesStoreBundle();
  return useStore(store, selector, equalityFn);
};

export * from './types';
