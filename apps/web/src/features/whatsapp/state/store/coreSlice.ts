import {
  selectPreferredInstance,
  shouldDisplayInstance,
} from '../../lib/instances';
import type {
  InstancesSlice,
  InstancesStoreDependencies,
  InstancesStoreState,
  StoreEvents,
  InstancesConfig,
  InstancesLoadOptions,
  Nullable,
} from './types';

const DEFAULT_CONFIG: InstancesConfig = {
  tenantId: null,
  campaignInstanceId: null,
  autoRefresh: false,
  pauseWhenHidden: true,
  autoGenerateQr: true,
  initialFetch: false,
};

const hasConfigChanged = (current: InstancesConfig, next: InstancesConfig): boolean => {
  return (
    current.tenantId !== next.tenantId ||
    current.campaignInstanceId !== next.campaignInstanceId ||
    current.autoRefresh !== next.autoRefresh ||
    current.pauseWhenHidden !== next.pauseWhenHidden ||
    current.autoGenerateQr !== next.autoGenerateQr ||
    current.initialFetch !== next.initialFetch
  );
};

const updateCache = (
  deps: InstancesStoreDependencies,
  list: InstancesStoreState['instances'],
  currentId: Nullable<string>,
) => {
  deps.persistCache(list, currentId);
};

export const createCoreSlice = (
  set: (
    partial:
      | Partial<InstancesStoreState>
      | ((state: InstancesStoreState) => Partial<InstancesStoreState>),
    replace?: boolean,
  ) => void,
  get: () => InstancesStoreState,
  events: StoreEvents,
  deps: InstancesStoreDependencies,
): InstancesSlice => ({
  instances: [],
  currentInstance: null,
  status: 'disconnected',
  loadStatus: 'idle',
  instancesReady: false,
  loadingInstances: false,
  sessionActive: true,
  authDeferred: false,
  authToken: null,
  deletingInstanceId: null,
  preferredInstanceId: null,
  rateLimitUntil: 0,
  lastForcedAt: 0,
  loadRequestId: 0,
  hasFetchedOnce: false,
  error: null,
  config: { ...DEFAULT_CONFIG },

  hydrateFromCache() {
    const cache = deps.readCache();
    if (!cache) {
      set({
        instances: [],
        currentInstance: null,
        instancesReady: false,
        preferredInstanceId: null,
        loadStatus: 'idle',
      });
      return;
    }

    const list = Array.isArray(cache.list)
      ? (cache.list.filter(Boolean) as InstancesStoreState['instances'])
      : [];
    const current =
      cache.currentId && list.length
        ? list.find((item) => item.id === cache.currentId) ?? list[0]
        : list[0] ?? null;
    set({
      instances: list,
      currentInstance: current ?? null,
      instancesReady: list.length > 0,
      preferredInstanceId: current?.id ?? null,
      loadStatus: list.length > 0 ? 'success' : 'idle',
    });
  },

  setConfig(partial) {
    const state = get();
    const next = { ...state.config, ...partial };
    if (!hasConfigChanged(state.config, next)) {
      return;
    }
    set({ config: next });
  },

  setLoadingInstances(value) {
    set({
      loadingInstances: value,
      loadStatus: value ? 'loading' : get().loadStatus,
    });
  },

  setInstancesReady(value) {
    set({ instancesReady: value });
  },

  requestLoad(options = {}, meta = {}) {
    const requestId = get().loadRequestId + 1;
    set({
      loadRequestId: requestId,
      loadingInstances: true,
      loadStatus: 'loading',
    });
    if (!meta.silent) {
      events.emit('instances:load', { requestId, options });
    }
    return requestId;
  },

  applyLoadResult(payload, meta) {
    const state = get();
    if (meta.requestId !== state.loadRequestId) {
      return;
    }

    const list = Array.isArray(payload.instances)
      ? payload.instances.filter(shouldDisplayInstance)
      : [];

    const selectionOptions = {
      preferredInstanceId: meta.preferredInstanceId ?? state.preferredInstanceId ?? null,
      campaignInstanceId: meta.campaignInstanceId ?? state.config.campaignInstanceId ?? null,
    };

    const nextCurrent =
      selectPreferredInstance(list, selectionOptions) ?? payload.instance ?? null;

    const nextStatus =
      payload.status ??
      (typeof payload.connected === 'boolean'
        ? payload.connected
          ? 'connected'
          : 'disconnected'
        : nextCurrent?.status ?? state.status);

    set({
      instances: list,
      currentInstance: nextCurrent ?? null,
      status: nextStatus ?? 'disconnected',
      loadingInstances: false,
      instancesReady: true,
      preferredInstanceId: nextCurrent?.id ?? state.preferredInstanceId ?? null,
      sessionActive: true,
      authDeferred: false,
      error: null,
      hasFetchedOnce: true,
      loadStatus: 'success',
    });
    updateCache(deps, list, nextCurrent?.id ?? null);
  },

  failLoad(meta, error) {
    if (meta.requestId !== get().loadRequestId) {
      return;
    }
    set({
      loadingInstances: false,
      error: error ?? null,
      loadStatus: 'error',
    });
  },

  setSessionActive(value) {
    set({ sessionActive: value });
  },

  setAuthDeferred(value) {
    set({ authDeferred: value });
  },

  setAuthToken(token) {
    set({ authToken: token ?? null });
  },

  setDeletingInstance(id) {
    set({ deletingInstanceId: id ?? null });
  },

  setPreferredInstance(id) {
    set({ preferredInstanceId: id ?? null });
  },

  setStatus(status) {
    set({ status });
  },

  setInstances(list, options = {}) {
    const filtered = list.filter(shouldDisplayInstance);
    const current =
      selectPreferredInstance(filtered, options) ??
      get().currentInstance ??
      filtered[0] ??
      null;
    set({
      instances: filtered,
      currentInstance: current,
      preferredInstanceId: current?.id ?? get().preferredInstanceId ?? null,
      loadStatus: 'success',
    });
    updateCache(deps, filtered, current?.id ?? null);
  },

  selectInstance(id, options = {}) {
    const list = get().instances;
    if (!id) {
      const next = list[0] ?? null;
      set({
        currentInstance: next,
        preferredInstanceId: next?.id ?? null,
      });
      updateCache(deps, list, next?.id ?? null);
      return;
    }

    const selected = list.find((item) => item.id === id || item.name === id) ?? null;
    set({
      currentInstance: selected,
      preferredInstanceId: selected?.id ?? id ?? null,
    });
    updateCache(deps, list, selected?.id ?? id ?? null);
    if (!options.skipAutoQr && selected) {
      events.emit('qr:generate', { instanceId: selected.id });
    }
  },

  updateInstance(instanceId, updates) {
    if (!instanceId) {
      return;
    }
    set((state) => {
      const instances = state.instances.map((item) =>
        item.id === instanceId ? { ...item, ...updates } : item,
      );
      const current =
        state.currentInstance && state.currentInstance.id === instanceId
          ? { ...state.currentInstance, ...updates }
          : state.currentInstance;
      updateCache(deps, instances, current?.id ?? state.preferredInstanceId ?? null);
      return {
        instances,
        currentInstance: current,
      };
    });
  },

  removeInstance(instanceId) {
    set((state) => {
      const instances = state.instances.filter((item) => item.id !== instanceId);
      const current =
        state.currentInstance && state.currentInstance.id === instanceId
          ? instances[0] ?? null
          : state.currentInstance;
      updateCache(deps, instances, current?.id ?? state.preferredInstanceId ?? null);
      return {
        instances,
        currentInstance: current,
        preferredInstanceId: current?.id ?? null,
      };
    });
  },

  setError(error) {
    set({ error: error ?? null });
  },

  handleAuthFallback(options = {}) {
    const shouldReset = options.reset === true;
    if (shouldReset) {
      deps.clearCache();
      set({
        instances: [],
        currentInstance: null,
        instancesReady: true,
        loadingInstances: false,
        authDeferred: true,
        sessionActive: false,
        preferredInstanceId: null,
        loadStatus: 'error',
      });
      return;
    }

    set({
      loadingInstances: false,
      authDeferred: true,
      loadStatus: 'error',
    });
  },

  markRateLimitUntil(timestamp) {
    set({ rateLimitUntil: timestamp });
  },

  markForcedAt(timestamp) {
    set({ lastForcedAt: timestamp });
  },
});

export { DEFAULT_CONFIG, hasConfigChanged };
