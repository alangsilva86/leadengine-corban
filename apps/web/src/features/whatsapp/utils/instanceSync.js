import {
  ensureArrayOfObjects,
  normalizeInstanceRecord,
  normalizeInstancesCollection,
  shouldDisplayInstance,
} from './instances.js';

const ensureObject = (value) => (value && typeof value === 'object' ? value : {});
const ensureArray = (value) => (Array.isArray(value) ? value : []);

const pickStringValue = (...values) => {
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

export const ensureAgreementMeta = (agreement) => ({
  id: agreement?.id ?? null,
  tenantId: agreement?.tenantId ?? agreement?.tenant_id ?? null,
  name: agreement?.name ?? null,
  region: agreement?.region ?? null,
});

export const resolveInstancePhone = (instance) =>
  instance?.phoneNumber ||
  instance?.number ||
  instance?.msisdn ||
  instance?.metadata?.phoneNumber ||
  instance?.metadata?.phone_number ||
  instance?.metadata?.msisdn ||
  instance?.jid ||
  instance?.session ||
  '';

export const selectPreferredInstance = (
  list,
  { preferredInstanceId, campaignInstanceId } = {}
) => {
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }

  const findById = (target) => {
    if (!target) {
      return null;
    }
    return list.find((item) => item.id === target || item.name === target) || null;
  };

  return (
    findById(preferredInstanceId) ||
    findById(campaignInstanceId) ||
    list.find((item) => item.connected === true) ||
    list[0]
  );
};

export const mergeInstancesById = (currentList = [], updates = []) => {
  const order = [];
  const map = new Map();

  for (const item of currentList) {
    if (!item || !item.id) {
      continue;
    }
    order.push(item.id);
    map.set(item.id, item);
  }

  for (const update of updates) {
    if (!update || !update.id) {
      continue;
    }
    const existing = map.get(update.id);
    map.set(update.id, existing ? { ...existing, ...update } : update);
    if (!order.includes(update.id)) {
      order.push(update.id);
    }
  }

  return order.map((id) => map.get(id)).filter(Boolean);
};

export const deriveStatusFromSources = ({
  explicitStatus,
  explicitConnected,
  currentStatus,
  fallback = 'disconnected',
} = {}) => {
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

export const reconcileInstancesState = (
  existingList,
  { instances: rawInstances = [], instance: rawInstance = null, status, connected } = {},
  { preferredInstanceId, campaignInstanceId, normalizeOptions } = {}
) => {
  const collected = [...ensureArrayOfObjects(rawInstances)];
  if (rawInstance) {
    collected.push(rawInstance);
  }

  const normalizedUpdates = normalizeInstancesCollection(collected, normalizeOptions);
  const merged = mergeInstancesById(existingList, normalizedUpdates);
  const current = selectPreferredInstance(merged, { preferredInstanceId, campaignInstanceId });

  return {
    instances: merged,
    current,
    status: deriveStatusFromSources({
      explicitStatus: status,
      explicitConnected: connected,
      currentStatus: current?.status ?? null,
    }),
  };
};

export const parseRealtimeEvent = (event) => {
  if (!event || typeof event !== 'object' || !event.payload) {
    return null;
  }

  const payload = event.payload;
  const instanceId =
    pickStringValue(payload.id, payload.instanceId, payload.sessionId, payload.brokerId) ?? null;

  if (!instanceId) {
    return null;
  }

  const statusCandidate =
    typeof payload.status === 'string'
      ? payload.status
      : pickStringValue(payload.status?.current, payload.status?.status);

  const connectedCandidate =
    typeof payload.connected === 'boolean'
      ? payload.connected
      : typeof payload.status?.connected === 'boolean'
        ? payload.status.connected
        : null;

  const timestamp =
    pickStringValue(payload.syncedAt, payload.timestamp) ?? new Date().toISOString();

  const phoneNumber = pickStringValue(
    payload.phoneNumber,
    payload.metadata?.phoneNumber,
    payload.metadata?.phone_number,
    payload.metadata?.msisdn
  );

  return {
    id: `${event.type ?? 'updated'}-${instanceId}-${timestamp}`,
    instanceId,
    type: typeof event.type === 'string' && event.type ? event.type : 'updated',
    status: statusCandidate ?? null,
    connected: connectedCandidate,
    phoneNumber: phoneNumber ?? null,
    timestamp,
  };
};

export const reduceRealtimeEvents = (events, rawEvent, limit = 30) => {
  const parsed = parseRealtimeEvent(rawEvent);
  if (!parsed) {
    return events;
  }

  const next = [parsed, ...ensureArray(events)];
  const seen = new Set();
  const deduped = [];

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

export const buildTimelineEntries = (instance, liveEvents = []) => {
  if (!instance) {
    return [];
  }

  const metadata = ensureObject(instance.metadata);
  const historyEntries = ensureArray(metadata.history);

  const normalizedHistory = historyEntries
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const timestamp =
        (typeof entry.at === 'string' && entry.at) ||
        (typeof entry.timestamp === 'string' && entry.timestamp) ||
        null;

      return {
        id: `history-${instance.id}-${timestamp ?? index}`,
        instanceId: instance.id,
        type: typeof entry.action === 'string' ? entry.action : 'status-sync',
        status: typeof entry.status === 'string' ? entry.status : entry.status ?? null,
        connected: typeof entry.connected === 'boolean' ? entry.connected : null,
        phoneNumber: typeof entry.phoneNumber === 'string' ? entry.phoneNumber : null,
        timestamp: timestamp ?? new Date(Date.now() - index * 1000).toISOString(),
      };
    })
    .filter(Boolean);

  const merged = [...liveEvents.filter((event) => event.instanceId === instance.id), ...normalizedHistory];

  return merged
    .sort((a, b) => {
      const aTime = new Date(a.timestamp ?? '').getTime();
      const bTime = new Date(b.timestamp ?? '').getTime();
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    })
    .slice(0, 12);
};

export const resolveFriendlyError = (resolveCopy, error, fallbackMessage) => {
  const codeCandidate = error?.payload?.error?.code ?? error?.code ?? null;
  const rawMessage =
    error?.payload?.error?.message ?? (error instanceof Error ? error.message : fallbackMessage);
  const copy = resolveCopy(codeCandidate, rawMessage ?? fallbackMessage);
  return {
    code: copy.code ?? codeCandidate ?? null,
    title: copy.title ?? 'Algo deu errado',
    message: copy.description ?? rawMessage ?? fallbackMessage,
  };
};

export const filterDisplayableInstances = (instances) =>
  ensureArray(instances).filter((instance) => shouldDisplayInstance(instance));

export const mapToNormalizedInstances = (list, options = {}) => {
  const raw = ensureArrayOfObjects(list);
  return normalizeInstancesCollection(raw, options);
};

export const normalizeInstancePayload = (payload) => normalizeInstanceRecord(payload);
