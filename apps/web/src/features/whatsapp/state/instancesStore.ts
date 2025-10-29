import { createContext, useContext } from 'react';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type {
  NormalizedInstance,
  ParsedInstancesPayload,
  SelectInstanceOptions,
} from '../lib/instances';
import {
  selectPreferredInstance,
  shouldDisplayInstance,
} from '../lib/instances';
import type { InstancesCacheEntry } from '../lib/cache';

type Nullable<T> = T | null;

export interface InstancesConfig {
  tenantId: Nullable<string>;
  agreementId: Nullable<string>;
  campaignInstanceId: Nullable<string>;
  autoRefresh: boolean;
  pauseWhenHidden: boolean;
  autoGenerateQr: boolean;
  initialFetch: boolean;
}

export interface InstancesLoadOptions {
  forceRefresh?: boolean;
  preferredInstanceId?: Nullable<string>;
  campaignInstanceId?: Nullable<string>;
  reason?: 'manual' | 'auto' | 'realtime' | 'startup';
  connectResult?: unknown;
  providedInstances?: unknown;
}

export interface CreateInstancePayload {
  name: string;
  id?: Nullable<string>;
  agreementId?: Nullable<string>;
  agreementName?: Nullable<string>;
  tenantId?: Nullable<string>;
}

export interface DeleteInstancePayload {
  instanceId: string;
  hard?: boolean;
}

export interface ConnectInstancePayload {
  instanceId: string;
  pairing?: {
    phoneNumber?: Nullable<string>;
    code?: Nullable<string>;
  };
  refresh?: boolean;
}

export interface GenerateQrPayload {
  instanceId: string;
  refresh?: boolean;
  fetchSnapshots?: boolean;
  pairing?: {
    phoneNumber?: Nullable<string>;
    code?: Nullable<string>;
  };
}

export interface MarkConnectedPayload {
  instanceId: string;
  status: string;
}

export interface QrState {
  instanceId: Nullable<string>;
  expiresAt: Nullable<number>;
}

type ErrorMeta = {
  code?: Nullable<string>;
  title?: Nullable<string>;
  message?: Nullable<string>;
};

export interface InstancesSlice {
  instances: NormalizedInstance[];
  currentInstance: Nullable<NormalizedInstance>;
  status: string;
  instancesReady: boolean;
  loadingInstances: boolean;
  sessionActive: boolean;
  authDeferred: boolean;
  authToken: Nullable<string>;
  deletingInstanceId: Nullable<string>;
  preferredInstanceId: Nullable<string>;
  rateLimitUntil: number;
  lastForcedAt: number;
  loadRequestId: number;
  hasFetchedOnce: boolean;
  error: Nullable<ErrorMeta>;
  config: InstancesConfig;
  hydrateFromCache(): void;
  setConfig(partial: Partial<InstancesConfig>): void;
  setLoadingInstances(value: boolean): void;
  setInstancesReady(value: boolean): void;
  requestLoad(options?: InstancesLoadOptions, meta?: { silent?: boolean }): number;
  applyLoadResult(
    payload: ParsedInstancesPayload,
    meta: {
      requestId: number;
      preferredInstanceId?: Nullable<string>;
      campaignInstanceId?: Nullable<string>;
      forced?: boolean;
    },
  ): void;
  failLoad(meta: { requestId: number }, error?: ErrorMeta): void;
  setSessionActive(value: boolean): void;
  setAuthDeferred(value: boolean): void;
  setAuthToken(token: Nullable<string>): void;
  setDeletingInstance(id: Nullable<string>): void;
  setPreferredInstance(id: Nullable<string>): void;
  setStatus(status: string): void;
  setInstances(list: NormalizedInstance[], options?: SelectInstanceOptions): void;
  selectInstance(id: string | null, options?: { skipAutoQr?: boolean }): void;
  updateInstance(instanceId: string, updates: Partial<NormalizedInstance>): void;
  removeInstance(instanceId: string): void;
  setError(error: Nullable<ErrorMeta>): void;
  handleAuthFallback(options?: { reset?: boolean; error?: unknown }): void;
  markRateLimitUntil(timestamp: number): void;
  markForcedAt(timestamp: number): void;
}

export interface QrSlice {
  qrData: unknown;
  qrState: QrState;
  secondsLeft: Nullable<number>;
  loadingQr: boolean;
  generatingQr: boolean;
  generateQr(payload: GenerateQrPayload): void;
  applyQrResult(result: {
    instanceId: string;
    qr: unknown;
    expiresAt?: Nullable<number>;
    secondsLeft?: Nullable<number>;
  }): void;
  failQr(instanceId: string): void;
  setQrData(value: unknown): void;
  setSecondsLeft(value: Nullable<number>): void;
  resetQr(): void;
  setLoadingQr(value: boolean): void;
  setGeneratingQr(value: boolean): void;
}

export interface RealtimeEventEntry {
  id: string;
  instanceId: string;
  type: string;
  status: Nullable<string>;
  connected: Nullable<boolean>;
  phoneNumber: Nullable<string>;
  timestamp: string;
}

export interface RealtimeSlice {
  liveEvents: RealtimeEventEntry[];
  realtimeConnected: boolean;
  applyRealtimeEvent(event: RealtimeEventEntry, limit?: number): void;
  clearRealtimeEvents(): void;
  setRealtimeConnected(value: boolean): void;
}

export interface MutationsSlice {
  createInstance(payload: CreateInstancePayload): void;
  deleteInstance(payload: DeleteInstancePayload): void;
  connectInstance(payload: ConnectInstancePayload): void;
  markConnected(payload: MarkConnectedPayload): void;
}

export type InstancesStoreState = InstancesSlice & QrSlice & RealtimeSlice & MutationsSlice;

type StoreEventMap = {
  'instances:load': { requestId: number; options: InstancesLoadOptions };
  'instances:create': CreateInstancePayload;
  'instances:delete': DeleteInstancePayload;
  'instances:connect': ConnectInstancePayload;
  'instances:mark-connected': MarkConnectedPayload;
  'qr:generate': GenerateQrPayload;
  'qr:reset': void;
};

type EventKey = keyof StoreEventMap;
type EventHandler<K extends EventKey> = (payload: StoreEventMap[K]) => void;

export interface StoreEvents {
  on<K extends EventKey>(event: K, handler: EventHandler<K>): () => void;
  emit<K extends EventKey>(event: K, payload: StoreEventMap[K]): void;
}

const createEvents = (): StoreEvents => {
  const handlers = new Map<EventKey, Set<EventHandler<any>>>();

  return {
    on(event, handler) {
      const set = handlers.get(event) ?? new Set();
      set.add(handler);
      handlers.set(event, set);
      return () => {
        set.delete(handler);
      };
    },
    emit(event, payload) {
      const set = handlers.get(event);
      if (!set) {
        return;
      }
      for (const handler of Array.from(set)) {
        handler(payload);
      }
    },
  };
};

export interface InstancesStoreDependencies {
  readCache(): InstancesCacheEntry | null;
  persistCache(list: NormalizedInstance[], currentId: Nullable<string>): void;
  clearCache(): void;
}

export interface InstancesStoreBundle {
  store: ReturnType<typeof createStore<InstancesStoreState>>;
  events: StoreEvents;
  deps: InstancesStoreDependencies;
}

const DEFAULT_CONFIG: InstancesConfig = {
  tenantId: null,
  agreementId: null,
  campaignInstanceId: null,
  autoRefresh: false,
  pauseWhenHidden: true,
  autoGenerateQr: true,
  initialFetch: false,
};

const hasConfigChanged = (current: InstancesConfig, next: InstancesConfig): boolean => {
  return (
    current.tenantId !== next.tenantId ||
    current.agreementId !== next.agreementId ||
    current.campaignInstanceId !== next.campaignInstanceId ||
    current.autoRefresh !== next.autoRefresh ||
    current.pauseWhenHidden !== next.pauseWhenHidden ||
    current.autoGenerateQr !== next.autoGenerateQr ||
    current.initialFetch !== next.initialFetch
  );
};

const createInstancesSlice = (
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
      });
      return;
    }

    const list = Array.isArray(cache.list)
      ? cache.list.filter(Boolean) as NormalizedInstance[]
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
    set({ loadingInstances: value });
  },

  setInstancesReady(value) {
    set({ instancesReady: value });
  },

  requestLoad(options = {}, meta = {}) {
    const requestId = get().loadRequestId + 1;
    set({
      loadRequestId: requestId,
      loadingInstances: true,
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

    const selectionOptions: SelectInstanceOptions = {
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
    });
    deps.persistCache(list, nextCurrent?.id ?? null);
  },

  failLoad(meta, error) {
    if (meta.requestId !== get().loadRequestId) {
      return;
    }
    set({
      loadingInstances: false,
      error: error ?? null,
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
    });
    deps.persistCache(filtered, current?.id ?? null);
  },

  selectInstance(id, options = {}) {
    const list = get().instances;
    if (!id) {
      const next = list[0] ?? null;
      set({
        currentInstance: next,
        preferredInstanceId: next?.id ?? null,
      });
      deps.persistCache(list, next?.id ?? null);
      return;
    }

    const selected = list.find((item) => item.id === id || item.name === id) ?? null;
    set({
      currentInstance: selected,
      preferredInstanceId: selected?.id ?? id ?? null,
    });
    deps.persistCache(list, selected?.id ?? id ?? null);
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
      deps.persistCache(instances, current?.id ?? state.preferredInstanceId ?? null);
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
      deps.persistCache(instances, current?.id ?? state.preferredInstanceId ?? null);
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
      });
      return;
    }

    set({
      loadingInstances: false,
      authDeferred: true,
    });
  },

  markRateLimitUntil(timestamp) {
    set({ rateLimitUntil: timestamp });
  },

  markForcedAt(timestamp) {
    set({ lastForcedAt: timestamp });
  },
});

const createQrSlice = (
  set: (
    partial:
      | Partial<InstancesStoreState>
      | ((state: InstancesStoreState) => Partial<InstancesStoreState>),
    replace?: boolean,
  ) => void,
  get: () => InstancesStoreState,
  events: StoreEvents,
): QrSlice => ({
  qrData: null,
  qrState: { instanceId: null, expiresAt: null },
  secondsLeft: null,
  loadingQr: false,
  generatingQr: false,

  generateQr(payload) {
    set({
      loadingQr: true,
      generatingQr: true,
      qrState: { instanceId: payload.instanceId, expiresAt: null },
    });
    events.emit('qr:generate', payload);
  },

  applyQrResult({ instanceId, qr, expiresAt = null, secondsLeft = null }) {
    const nextSeconds =
      typeof secondsLeft === 'number'
        ? secondsLeft
        : expiresAt
          ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
          : null;
    set({
      qrData: qr,
      loadingQr: false,
      generatingQr: false,
      secondsLeft: nextSeconds,
      qrState: { instanceId, expiresAt },
    });
  },

  failQr(instanceId) {
    const state = get();
    if (state.qrState.instanceId !== instanceId) {
      return;
    }
    set({
      loadingQr: false,
      generatingQr: false,
    });
  },

  setQrData(value) {
    set({ qrData: value ?? null });
  },

  setSecondsLeft(value) {
    set({ secondsLeft: value });
  },

  resetQr() {
    set({
      qrData: null,
      secondsLeft: null,
      loadingQr: false,
      generatingQr: false,
      qrState: { instanceId: null, expiresAt: null },
    });
    events.emit('qr:reset', undefined);
  },

  setLoadingQr(value) {
    const state = get();
    set({ loadingQr: value, generatingQr: value ? true : state.generatingQr });
  },

  setGeneratingQr(value) {
    set({ generatingQr: Boolean(value) });
  },
});

const createRealtimeSlice = (
  set: (
    partial:
      | Partial<InstancesStoreState>
      | ((state: InstancesStoreState) => Partial<InstancesStoreState>),
    replace?: boolean,
  ) => void,
): RealtimeSlice => ({
  liveEvents: [],
  realtimeConnected: false,

  applyRealtimeEvent(event, limit = 30) {
    set((state) => {
      const next = [event, ...state.liveEvents];
      const seen = new Set<string>();
      const deduped: RealtimeEventEntry[] = [];
      for (const entry of next) {
        const key = `${entry.instanceId}-${entry.timestamp}-${entry.type}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        deduped.push(entry);
        if (deduped.length >= limit) {
          break;
        }
      }
      return { liveEvents: deduped };
    });
  },

  clearRealtimeEvents() {
    set({ liveEvents: [] });
  },

  setRealtimeConnected(value) {
    set({ realtimeConnected: value });
  },
});

const createMutationsSlice = (
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
    set({ loadingInstances: true });
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

export const createInstancesStore = (
  deps: InstancesStoreDependencies,
): InstancesStoreBundle => {
  const events = createEvents();
  const store = createStore<InstancesStoreState>()((set, get) => ({
    ...createInstancesSlice(set, get, events, deps),
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
