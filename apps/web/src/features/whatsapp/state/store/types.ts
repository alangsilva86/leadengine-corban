import type { StoreApi } from 'zustand/vanilla';
import type {
  NormalizedInstance,
  ParsedInstancesPayload,
  SelectInstanceOptions,
} from '../../lib/instances';
import type { InstancesCacheEntry } from '../../lib/cache';

export type Nullable<T> = T | null;

export interface InstancesConfig {
  tenantId: Nullable<string>;
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
  loadStatus: 'idle' | 'loading' | 'success' | 'error';
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

export type InstancesStoreDependencies = {
  readCache(): InstancesCacheEntry | null;
  persistCache(list: NormalizedInstance[], currentId: Nullable<string>): void;
  clearCache(): void;
};

export type StoreEventMap = {
  'instances:load': { requestId: number; options: InstancesLoadOptions };
  'instances:create': CreateInstancePayload;
  'instances:delete': DeleteInstancePayload;
  'instances:connect': ConnectInstancePayload;
  'instances:mark-connected': MarkConnectedPayload;
  'qr:generate': GenerateQrPayload;
  'qr:reset': void;
};

export type EventKey = keyof StoreEventMap;
export type EventHandler<K extends EventKey> = (payload: StoreEventMap[K]) => void;

export interface StoreEvents {
  on<K extends EventKey>(event: K, handler: EventHandler<K>): () => void;
  emit<K extends EventKey>(event: K, payload: StoreEventMap[K]): void;
}

export interface InstancesStoreBundle {
  store: StoreApi<InstancesStoreState>;
  events: StoreEvents;
  deps: InstancesStoreDependencies;
}
