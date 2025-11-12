import type {
  InstancesStoreState,
  MutationsSlice,
  StoreEvents,
} from './types';

export const createMutationsSlice = (
  events: StoreEvents,
  set: (
    partial:
      | Partial<InstancesStoreState>
      | ((state: InstancesStoreState) => Partial<InstancesStoreState>),
    replace?: boolean,
  ) => void,
  get: () => InstancesStoreState,
): MutationsSlice => ({
  createInstance(payload) {
    set({ loadingInstances: true, loadStatus: 'loading' });
    events.emit('instances:create', payload);
  },

  deleteInstance(payload) {
    set({ deletingInstanceId: payload.instanceId });
    events.emit('instances:delete', payload);
  },

  connectInstance(payload) {
    events.emit('instances:connect', payload);
  },

  markConnected(payload) {
    const state = get();
    const exists = state.instances.find((item) => item.id === payload.instanceId);
    if (!exists) {
      return;
    }

    set((prev) => ({
      instances: prev.instances.map((item) =>
        item.id === payload.instanceId
          ? { ...item, status: payload.status, connected: payload.status === 'connected' }
          : item,
      ),
      currentInstance:
        prev.currentInstance && prev.currentInstance.id === payload.instanceId
          ? {
              ...prev.currentInstance,
              status: payload.status,
              connected: payload.status === 'connected',
            }
          : prev.currentInstance,
    }));
  },
});
