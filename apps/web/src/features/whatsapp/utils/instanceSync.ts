import {
  ensureArrayOfObjects,
  normalizeInstanceRecord,
  normalizeInstancesCollection,
  shouldDisplayInstance,
  selectPreferredInstance,
  type NormalizeOptions,
  type NormalizedInstance,
} from '../lib/instances';

export { resolveInstancePhone, selectPreferredInstance } from '../lib/instances';

type Nullable<T> = T | null;

type UnknownRecord = Record<string, unknown>;

const isPlainRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const ensureObject = (value: unknown): UnknownRecord =>
  isPlainRecord(value) ? value : {};

const ensureArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const pickStringValue = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
};

export interface AgreementMeta {
  id: Nullable<string>;
  tenantId: Nullable<string>;
  name: Nullable<string>;
  region: Nullable<string>;
}

export const ensureAgreementMeta = (agreement: unknown): AgreementMeta => ({
  id: isPlainRecord(agreement) && typeof agreement.id === 'string' ? agreement.id : null,
  tenantId:
    isPlainRecord(agreement) && typeof agreement.tenantId === 'string'
      ? agreement.tenantId
      : isPlainRecord(agreement) && typeof agreement.tenant_id === 'string'
        ? agreement.tenant_id
        : null,
  name: isPlainRecord(agreement) && typeof agreement.name === 'string' ? agreement.name : null,
  region: isPlainRecord(agreement) && typeof agreement.region === 'string' ? agreement.region : null,
});

export const mergeInstancesById = <T extends { id?: Nullable<string> }>(
  currentList: T[] = [],
  updates: T[] = [],
): T[] => {
  const order: string[] = [];
  const map = new Map<string, T>();

  for (const item of currentList) {
    const id = typeof item?.id === 'string' && item.id.trim().length > 0 ? item.id : null;
    if (!id) {
      continue;
    }
    order.push(id);
    map.set(id, item);
  }

  for (const update of updates) {
    const id = typeof update?.id === 'string' && update.id.trim().length > 0 ? update.id : null;
    if (!id) {
      continue;
    }
    const existing = map.get(id);
    const merged = existing ? ({ ...existing, ...update } as T) : update;
    map.set(id, merged);
    if (!order.includes(id)) {
      order.push(id);
    }
  }

  return order.map((id) => map.get(id)).filter(Boolean) as T[];
};

export interface StatusSourceOptions {
  explicitStatus?: Nullable<string>;
  explicitConnected?: Nullable<boolean>;
  currentStatus?: Nullable<string>;
  fallback?: string;
}

export const deriveStatusFromSources = ({
  explicitStatus,
  explicitConnected,
  currentStatus,
  fallback = 'disconnected',
}: StatusSourceOptions = {}): string => {
  if (typeof explicitStatus === 'string' && explicitStatus) {
    return explicitStatus;
  }
  if (typeof explicitConnected === 'boolean') {
    return explicitConnected ? 'connected' : 'disconnected';
  }
  if (typeof currentStatus === 'string' && currentStatus) {
    return currentStatus;
  }
  return fallback;
};

export interface ReconcileInstancesPayload {
  instances?: unknown;
  instance?: unknown;
  status?: Nullable<string>;
  connected?: Nullable<boolean>;
}

export interface ReconcileInstancesOptions {
  preferredInstanceId?: Nullable<string>;
  campaignInstanceId?: Nullable<string>;
  normalizeOptions?: NormalizeOptions;
}

export interface ReconcileInstancesResult {
  instances: NormalizedInstance[];
  current: NormalizedInstance | null;
  status: string;
}

export const reconcileInstancesState = (
  existingList: NormalizedInstance[],
  { instances: rawInstances = [], instance: rawInstance = null, status, connected }: ReconcileInstancesPayload = {},
  { preferredInstanceId, campaignInstanceId, normalizeOptions }: ReconcileInstancesOptions = {},
): ReconcileInstancesResult => {
  const collected = [
    ...ensureArrayOfObjects<UnknownRecord>(rawInstances),
    ...(rawInstance ? [ensureObject(rawInstance)] : []),
  ];

  const normalizedUpdates = normalizeInstancesCollection(collected, normalizeOptions);
  const merged = mergeInstancesById<NormalizedInstance>(existingList, normalizedUpdates);
  const current = selectPreferredInstance(merged, { preferredInstanceId, campaignInstanceId });

  return {
    instances: merged,
    current,
    status: deriveStatusFromSources({
      explicitStatus: status ?? null,
      explicitConnected: connected ?? null,
      currentStatus: current?.status ?? null,
    }),
  };
};

export interface ParsedRealtimeEvent {
  id: string;
  instanceId: string;
  type: string;
  status: Nullable<string>;
  connected: Nullable<boolean>;
  phoneNumber: Nullable<string>;
  timestamp: string;
}

export const parseRealtimeEvent = (event: unknown): ParsedRealtimeEvent | null => {
  if (!isPlainRecord(event) || !isPlainRecord(event.payload)) {
    return null;
  }

  const envelope = event as UnknownRecord;
  const payload = envelope.payload as UnknownRecord;
  const instanceId =
    pickStringValue(payload.id, payload.instanceId, payload.sessionId, payload.brokerId) ?? null;

  if (!instanceId) {
    return null;
  }

  const statusPayload = isPlainRecord(payload.status) ? payload.status : null;
  const statusCandidate =
    typeof payload.status === 'string'
      ? payload.status
      : pickStringValue(statusPayload?.current, statusPayload?.status);

  const connectedCandidate =
    typeof payload.connected === 'boolean'
      ? payload.connected
      : typeof statusPayload?.connected === 'boolean'
        ? (statusPayload.connected as boolean)
        : null;

  const timestamp =
    pickStringValue(payload.syncedAt, payload.timestamp) ?? new Date().toISOString();

  const metadata = isPlainRecord(payload.metadata) ? payload.metadata : {};
  const phoneNumber = pickStringValue(
    payload.phoneNumber,
    metadata.phoneNumber,
    metadata.phone_number,
    metadata.msisdn,
  );

  const type = typeof envelope.type === 'string' && envelope.type ? envelope.type : 'updated';

  return {
    id: `${type}-${instanceId}-${timestamp}`,
    instanceId,
    type,
    status: statusCandidate ?? null,
    connected: connectedCandidate,
    phoneNumber: phoneNumber ?? null,
    timestamp,
  };
};

export const reduceRealtimeEvents = (
  events: ParsedRealtimeEvent[],
  rawEvent: unknown,
  limit = 30,
): ParsedRealtimeEvent[] => {
  const parsed = parseRealtimeEvent(rawEvent);
  if (!parsed) {
    return events;
  }

  const next = [parsed, ...ensureArray<ParsedRealtimeEvent>(events)];
  const seen = new Set<string>();
  const deduped: ParsedRealtimeEvent[] = [];

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

  return deduped;
};

export const buildTimelineEntries = (
  instance: NormalizedInstance | null | undefined,
  liveEvents: ParsedRealtimeEvent[] = [],
): ParsedRealtimeEvent[] => {
  if (!instance) {
    return [];
  }

  const metadata = ensureObject(instance.metadata);
  const historyEntries = ensureArray<UnknownRecord>(metadata.history);

  const normalizedHistory = historyEntries
    .map((entry, index) => {
      const timestamp =
        (typeof entry.at === 'string' && entry.at) ||
        (typeof entry.timestamp === 'string' && entry.timestamp) ||
        null;

      const base: ParsedRealtimeEvent = {
        id: `history-${instance.id}-${timestamp ?? index}`,
        instanceId: instance.id,
        type: typeof entry.action === 'string' ? entry.action : 'status-sync',
        status: typeof entry.status === 'string' ? entry.status : (entry.status as string | null) ?? null,
        connected:
          typeof entry.connected === 'boolean' ? entry.connected : (entry.connected as boolean | null) ?? null,
        phoneNumber:
          typeof entry.phoneNumber === 'string' ? entry.phoneNumber : (entry.phoneNumber as string | null) ?? null,
        timestamp: timestamp ?? new Date(Date.now() - index * 1000).toISOString(),
      };
      return base;
    })
    .filter((entry): entry is ParsedRealtimeEvent => Boolean(entry));

  const merged = [
    ...liveEvents.filter((event) => event.instanceId === instance.id),
    ...normalizedHistory,
  ];

  return merged
    .sort((a, b) => {
      const aTime = new Date(a.timestamp ?? '').getTime();
      const bTime = new Date(b.timestamp ?? '').getTime();
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    })
    .slice(0, 12);
};

export interface FriendlyErrorCopy {
  code?: Nullable<string>;
  title?: Nullable<string>;
  description?: Nullable<string>;
}

export interface FriendlyError {
  code: Nullable<string>;
  title: string;
  message: string;
}

export type CopyResolver = (
  code: Nullable<string>,
  message: string,
) => FriendlyErrorCopy | null | undefined;

export const resolveFriendlyError = (
  resolveCopy: CopyResolver,
  error: unknown,
  fallbackMessage: string,
): FriendlyError => {
  const payloadError =
    isPlainRecord(error) && isPlainRecord(error.payload) && isPlainRecord(error.payload.error)
      ? error.payload.error
      : null;

  const codeCandidate =
    (payloadError?.code as string | null | undefined) ??
    (isPlainRecord(error) && typeof error.code === 'string' ? error.code : null);

  const rawMessage =
    (payloadError?.message as string | undefined) ??
    (error instanceof Error ? error.message : undefined) ??
    fallbackMessage;

  const copy = resolveCopy(codeCandidate ?? null, rawMessage);

  return {
    code: copy?.code ?? codeCandidate ?? null,
    title: copy?.title ?? 'Algo deu errado',
    message: copy?.description ?? rawMessage ?? fallbackMessage,
  };
};

export const filterDisplayableInstances = (
  instances: NormalizedInstance[] | undefined,
): NormalizedInstance[] =>
  ensureArray<NormalizedInstance>(instances).filter((instance) => shouldDisplayInstance(instance));

export const mapToNormalizedInstances = (
  list: unknown,
  options: NormalizeOptions = {},
): NormalizedInstance[] => {
  const raw = ensureArrayOfObjects<UnknownRecord>(list);
  return normalizeInstancesCollection(raw, options);
};

export const normalizeInstancePayload = (
  payload: unknown,
): NormalizedInstance | null => normalizeInstanceRecord(payload);
