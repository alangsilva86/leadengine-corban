import { ensureArrayOfObjects, isPlainRecord, normalizeInstanceRecord, normalizeInstancesCollection, pickStringValue, shouldDisplayInstance, selectPreferredInstance, } from '../lib/instances';
export { resolveInstancePhone, selectPreferredInstance } from '../lib/instances';
const ensureObject = (value) => isPlainRecord(value) ? value : {};
const ensureArray = (value) => (Array.isArray(value) ? value : []);
export const ensureAgreementMeta = (agreement) => ({
    id: isPlainRecord(agreement) && typeof agreement.id === 'string' ? agreement.id : null,
    tenantId: isPlainRecord(agreement) && typeof agreement.tenantId === 'string'
        ? agreement.tenantId
        : isPlainRecord(agreement) && typeof agreement.tenant_id === 'string'
            ? agreement.tenant_id
            : null,
    name: isPlainRecord(agreement) && typeof agreement.name === 'string' ? agreement.name : null,
    region: isPlainRecord(agreement) && typeof agreement.region === 'string' ? agreement.region : null,
});
export const mergeInstancesById = (currentList = [], updates = []) => {
    const order = [];
    const map = new Map();
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
        const merged = existing ? { ...existing, ...update } : update;
        map.set(id, merged);
        if (!order.includes(id)) {
            order.push(id);
        }
    }
    return order.map((id) => map.get(id)).filter(Boolean);
};
export const deriveStatusFromSources = ({ explicitStatus, explicitConnected, currentStatus, fallback = 'disconnected', } = {}) => {
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
export const reconcileInstancesState = (existingList, { instances: rawInstances = [], instance: rawInstance = null, status, connected } = {}, { preferredInstanceId, campaignInstanceId, normalizeOptions } = {}) => {
    const collected = [
        ...ensureArrayOfObjects(rawInstances),
        ...(rawInstance ? [ensureObject(rawInstance)] : []),
    ];
    const normalizedUpdates = normalizeInstancesCollection(collected, normalizeOptions);
    const merged = mergeInstancesById(existingList, normalizedUpdates);
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
export const parseRealtimeEvent = (event) => {
    if (!isPlainRecord(event) || !isPlainRecord(event.payload)) {
        return null;
    }
    const envelope = event;
    const payload = envelope.payload;
    const instanceId = pickStringValue(payload.id, payload.instanceId, payload.sessionId, payload.brokerId) ?? null;
    if (!instanceId) {
        return null;
    }
    const statusPayload = isPlainRecord(payload.status) ? payload.status : null;
    const statusCandidate = typeof payload.status === 'string'
        ? payload.status
        : pickStringValue(statusPayload?.current, statusPayload?.status);
    const connectedCandidate = typeof payload.connected === 'boolean'
        ? payload.connected
        : typeof statusPayload?.connected === 'boolean'
            ? statusPayload.connected
            : null;
    const timestamp = pickStringValue(payload.syncedAt, payload.timestamp) ?? new Date().toISOString();
    const metadata = isPlainRecord(payload.metadata) ? payload.metadata : {};
    const phoneNumber = pickStringValue(payload.phoneNumber, metadata.phoneNumber, metadata.phone_number, metadata.msisdn);
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
        const timestamp = (typeof entry.at === 'string' && entry.at) ||
            (typeof entry.timestamp === 'string' && entry.timestamp) ||
            null;
        const base = {
            id: `history-${instance.id}-${timestamp ?? index}`,
            instanceId: instance.id,
            type: typeof entry.action === 'string' ? entry.action : 'status-sync',
            status: typeof entry.status === 'string' ? entry.status : entry.status ?? null,
            connected: typeof entry.connected === 'boolean' ? entry.connected : entry.connected ?? null,
            phoneNumber: typeof entry.phoneNumber === 'string' ? entry.phoneNumber : entry.phoneNumber ?? null,
            timestamp: timestamp ?? new Date(Date.now() - index * 1000).toISOString(),
        };
        return base;
    })
        .filter((entry) => Boolean(entry));
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
export const resolveFriendlyError = (resolveCopy, error, fallbackMessage) => {
    const payloadError = isPlainRecord(error) && isPlainRecord(error.payload) && isPlainRecord(error.payload.error)
        ? error.payload.error
        : null;
    const codeCandidate = payloadError?.code ??
        (isPlainRecord(error) && typeof error.code === 'string' ? error.code : null);
    const rawMessage = payloadError?.message ??
        (error instanceof Error ? error.message : undefined) ??
        fallbackMessage;
    const copy = resolveCopy(codeCandidate ?? null, rawMessage);
    return {
        code: copy?.code ?? codeCandidate ?? null,
        title: copy?.title ?? 'Algo deu errado',
        message: copy?.description ?? rawMessage ?? fallbackMessage,
    };
};
export const filterDisplayableInstances = (instances) => ensureArray(instances).filter((instance) => shouldDisplayInstance(instance));
export const mapToNormalizedInstances = (list, options = {}) => {
    const raw = ensureArrayOfObjects(list);
    return normalizeInstancesCollection(raw, options);
};
export const normalizeInstancePayload = (payload) => normalizeInstanceRecord(payload);
