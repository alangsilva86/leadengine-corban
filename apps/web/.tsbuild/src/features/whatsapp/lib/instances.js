import { normalizeWhatsAppStatus } from '@leadengine/wa-status';
import { normalizeQrPayload as normalizeQrPayloadContract } from '@ticketz/wa-contracts';
import { extractQrPayload } from '../utils/qr.js';
export const looksLikeWhatsAppJid = (value) => typeof value === 'string' && value.toLowerCase().endsWith('@s.whatsapp.net');
export const VISIBLE_INSTANCE_STATUSES = new Set([
    'connected',
    'connecting',
    'reconnecting',
    'disconnected',
    'qr_required',
    'error',
]);
export const isPlainRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
export const pickStringValue = (...values) => {
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
export const readTenantString = (value) => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
    return null;
};
const pickTenantId = (record) => {
    if (!isPlainRecord(record)) {
        return readTenantString(record);
    }
    const directCandidates = [
        record.tenantId,
        record.tenant_id,
        record.tenantSlug,
        record.tenant_slug,
        record.scopeTenantId,
        record.scope_tenant_id,
        record.accountTenantId,
        record.account_tenant_id,
        record.agreementId,
        record.agreement_id,
        record.accountId,
        record.account_id,
    ];
    for (const candidate of directCandidates) {
        const resolved = readTenantString(candidate);
        if (resolved) {
            return resolved;
        }
    }
    const nestedSources = ['tenant', 'account', 'scope'];
    for (const key of nestedSources) {
        if (record[key] && typeof record[key] === 'object') {
            const nested = pickTenantId(record[key]);
            if (nested) {
                return nested;
            }
        }
    }
    if (typeof record.id === 'string') {
        const resolved = readTenantString(record.id);
        if (resolved) {
            return resolved;
        }
    }
    return null;
};
export const resolveTenantId = (record) => {
    if (!record || typeof record !== 'object') {
        return readTenantString(record);
    }
    const baseTenant = pickTenantId(record);
    if (baseTenant) {
        return baseTenant;
    }
    const metadata = isPlainRecord(record.metadata)
        ? record.metadata
        : null;
    if (metadata) {
        const metaTenant = pickTenantId(metadata);
        if (metaTenant) {
            return metaTenant;
        }
    }
    const account = isPlainRecord(record.account)
        ? record.account
        : null;
    if (account) {
        const accountTenant = pickTenantId(account);
        if (accountTenant) {
            return accountTenant;
        }
    }
    const tenant = isPlainRecord(record.tenant)
        ? record.tenant
        : null;
    if (tenant) {
        const tenantId = pickTenantId(tenant);
        if (tenantId) {
            return tenantId;
        }
    }
    const scope = isPlainRecord(record.scope)
        ? record.scope
        : null;
    if (scope) {
        const scopeTenant = pickTenantId(scope);
        if (scopeTenant) {
            return scopeTenant;
        }
    }
    return null;
};
export const resolveTenantDisplayName = (record) => {
    if (!record || typeof record !== 'object') {
        return readTenantString(record);
    }
    const source = record;
    const directCandidates = [
        source.tenantName,
        source.tenantLabel,
        source.tenantSlug,
        source.accountName,
        source.accountLabel,
        source.scopeName,
        source.name,
        source.displayName,
        source.label,
        source.slug,
    ];
    for (const candidate of directCandidates) {
        const resolved = readTenantString(candidate);
        if (resolved) {
            return resolved;
        }
    }
    const tenant = isPlainRecord(source.tenant) ? source.tenant : null;
    if (tenant) {
        const tenantName = resolveTenantDisplayName(tenant);
        if (tenantName) {
            return tenantName;
        }
    }
    const account = isPlainRecord(source.account)
        ? source.account
        : null;
    if (account) {
        const accountName = resolveTenantDisplayName(account);
        if (accountName) {
            return accountName;
        }
    }
    const metadata = isPlainRecord(source.metadata)
        ? source.metadata
        : null;
    if (metadata) {
        const metaName = resolveTenantDisplayName(metadata);
        if (metaName) {
            return metaName;
        }
    }
    return resolveTenantId(record);
};
export const extractInstanceFromPayload = (payload) => {
    if (!isPlainRecord(payload)) {
        return null;
    }
    const record = payload;
    if (isPlainRecord(record.instance)) {
        return record.instance;
    }
    if (record.data !== undefined) {
        const nested = extractInstanceFromPayload(record.data);
        if (nested) {
            return nested;
        }
    }
    if ('id' in record ||
        'name' in record ||
        'status' in record ||
        'connected' in record) {
        return record;
    }
    return null;
};
export const formatInstanceDisplayId = (value) => {
    if (typeof value !== 'string') {
        return '';
    }
    if (looksLikeWhatsAppJid(value)) {
        return value.replace(/@s\.whatsapp\.net$/i, '@wa');
    }
    return value;
};
export const ensureArrayOfObjects = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item) => Boolean(item && typeof item === 'object'));
};
const mergeInstanceEntries = (previous, next) => {
    if (!previous) {
        return next;
    }
    const previousMetadata = isPlainRecord(previous.metadata) ? previous.metadata : {};
    const nextMetadata = isPlainRecord(next.metadata) ? next.metadata : {};
    const mergedMetadata = { ...previousMetadata, ...nextMetadata };
    return {
        ...previous,
        ...next,
        metadata: mergedMetadata,
        connected: Boolean(previous.connected || next.connected),
        status: next.status ||
            previous.status ||
            (previous.connected || next.connected ? 'connected' : 'disconnected'),
        tenantId: next.tenantId ?? previous.tenantId ?? null,
        name: next.name ?? previous.name ?? null,
        phoneNumber: next.phoneNumber ?? previous.phoneNumber ?? null,
        displayId: next.displayId || previous.displayId || next.id || previous.id,
        source: next.source ?? previous.source ?? null,
    };
};
export const normalizeInstanceRecord = (entry) => {
    if (!isPlainRecord(entry)) {
        return null;
    }
    const base = entry;
    const metadata = isPlainRecord(base.metadata) ? base.metadata : {};
    const profile = isPlainRecord(base.profile) ? base.profile : {};
    const details = isPlainRecord(base.details) ? base.details : {};
    const info = isPlainRecord(base.info) ? base.info : {};
    const mergedMetadata = {
        ...metadata,
        ...profile,
        ...details,
        ...info,
    };
    const id = pickStringValue(base.id, base.instanceId, base.instance_id, base.sessionId, base.session_id, mergedMetadata.id, mergedMetadata.instanceId, mergedMetadata.instance_id, mergedMetadata.sessionId, mergedMetadata.session_id) ?? null;
    if (!id) {
        return null;
    }
    const rawStatus = pickStringValue(base.status, base.connectionStatus, base.state, mergedMetadata.status, mergedMetadata.state) ?? null;
    const connectedValue = typeof base.connected === 'boolean'
        ? base.connected
        : typeof mergedMetadata.connected === 'boolean'
            ? mergedMetadata.connected
            : undefined;
    const normalizedStatusResult = normalizeWhatsAppStatus({ status: rawStatus, connected: connectedValue });
    const tenantId = resolveTenantId({ ...base, metadata: mergedMetadata });
    const name = pickStringValue(base.name, base.displayName, base.label, mergedMetadata.name, mergedMetadata.displayName, mergedMetadata.label, mergedMetadata.instanceName, mergedMetadata.sessionName, mergedMetadata.profileName) ?? resolveTenantDisplayName({ ...base, metadata: mergedMetadata });
    const phoneNumber = pickStringValue(base.phoneNumber, base.phone, base.number, mergedMetadata.phoneNumber, mergedMetadata.phone, mergedMetadata.number, mergedMetadata.msisdn) ?? null;
    const source = pickStringValue(base.source, mergedMetadata.source, mergedMetadata.origin, base.origin) ??
        (looksLikeWhatsAppJid(id) ? 'broker' : 'db');
    return {
        ...base,
        metadata: mergedMetadata,
        id,
        tenantId,
        name,
        phoneNumber,
        status: normalizedStatusResult.status,
        connected: normalizedStatusResult.connected,
        displayId: formatInstanceDisplayId(id),
        source,
    };
};
export const normalizeInstancesCollection = (rawList, options = {}) => {
    const allowedTenants = Array.isArray(options.allowedTenants)
        ? options.allowedTenants
            .filter((value) => typeof value === 'string')
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
        : [];
    const shouldFilterByTenant = (options.filterByTenant === true || options.enforceTenantScope === true) &&
        allowedTenants.length > 0;
    const order = [];
    const map = new Map();
    if (!Array.isArray(rawList)) {
        return [];
    }
    for (const entry of rawList) {
        const normalized = normalizeInstanceRecord(entry);
        if (!normalized) {
            continue;
        }
        if (shouldFilterByTenant &&
            normalized.tenantId &&
            !allowedTenants.includes(normalized.tenantId)) {
            continue;
        }
        const existing = map.get(normalized.id);
        const merged = mergeInstanceEntries(existing, normalized);
        if (!existing) {
            order.push(normalized.id);
        }
        map.set(normalized.id, merged);
    }
    return order.map((id) => map.get(id)).filter(Boolean);
};
export const unwrapWhatsAppResponse = (payload) => {
    if (!payload) {
        return {};
    }
    if (Array.isArray(payload)) {
        return payload;
    }
    if (payload && typeof payload === 'object') {
        const record = payload;
        if (record.data && typeof record.data === 'object') {
            return record.data;
        }
        if (record.result && typeof record.result === 'object') {
            return record.result;
        }
    }
    return payload;
};
export const parseInstancesPayload = (payload) => {
    const rootPayload = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload
        : null;
    const meta = rootPayload && metaIsRecord(rootPayload.meta)
        ? rootPayload.meta
        : {};
    const metaQrAvailable = typeof meta.qrAvailable === 'boolean'
        ? meta.qrAvailable
        : typeof meta.qr_available === 'boolean'
            ? meta.qr_available
            : undefined;
    const metaQrReason = typeof meta.qrReason === 'string'
        ? meta.qrReason
        : typeof meta.qr_reason === 'string'
            ? meta.qr_reason
            : null;
    const metaInstanceId = typeof meta.instanceId === 'string' && meta.instanceId.trim().length > 0
        ? meta.instanceId.trim()
        : null;
    const data = unwrapWhatsAppResponse(payload);
    const rootIsObject = data && typeof data === 'object' && !Array.isArray(data);
    let instances = [];
    if (rootIsObject && Array.isArray(data.instances)) {
        instances = ensureArrayOfObjects(data.instances)
            .map((entry) => normalizeInstanceRecord(entry))
            .filter(Boolean);
    }
    else if (rootIsObject && Array.isArray(data.items)) {
        instances = ensureArrayOfObjects(data.items)
            .map((entry) => normalizeInstanceRecord(entry))
            .filter(Boolean);
    }
    else if (rootIsObject && Array.isArray(data.data)) {
        instances = ensureArrayOfObjects(data.data)
            .map((entry) => normalizeInstanceRecord(entry))
            .filter(Boolean);
    }
    else if (Array.isArray(data)) {
        instances = ensureArrayOfObjects(data)
            .map((entry) => normalizeInstanceRecord(entry))
            .filter(Boolean);
    }
    const instanceRaw = extractInstanceFromPayload(rootIsObject ? data : null);
    const instance = normalizeInstanceRecord(instanceRaw) ?? null;
    if (instance && !instances.some((item) => item.id === instance.id)) {
        instances = [...instances, instance];
    }
    const statusPayload = rootIsObject && typeof data.status === 'object'
        ? data.status
        : rootIsObject && typeof data.instanceStatus === 'object'
            ? data.instanceStatus
            : null;
    const status = typeof statusPayload?.status === 'string'
        ? statusPayload.status
        : typeof data?.status === 'string'
            ? data.status
            : typeof instance?.status === 'string'
                ? instance.status
                : null;
    const connected = typeof data?.connected === 'boolean'
        ? data.connected
        : typeof statusPayload?.connected === 'boolean'
            ? statusPayload.connected
            : typeof instance?.connected === 'boolean'
                ? instance.connected
                : null;
    const rawInstanceId = data?.instanceId ?? metaInstanceId;
    const instanceId = typeof rawInstanceId === 'string' && rawInstanceId.trim().length > 0
        ? rawInstanceId.trim()
        : instance?.id ?? null;
    let qr = extractQrPayload((rootIsObject && data.qr !== undefined
        ? data.qr
        : null) ?? statusPayload ?? data);
    if (!qr && (metaQrAvailable !== undefined || metaQrReason)) {
        qr = normalizeQrPayloadContract({
            available: metaQrAvailable ?? false,
            reason: metaQrReason ?? null,
        });
    }
    else if (qr && metaQrReason && !qr.reason) {
        const normalizedMeta = normalizeQrPayloadContract({ reason: metaQrReason });
        if (normalizedMeta.reason) {
            qr = { ...qr, reason: normalizedMeta.reason };
        }
    }
    return {
        raw: payload,
        data,
        instances,
        instance,
        status,
        statusPayload,
        connected,
        instanceId,
        qr,
    };
};
function metaIsRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
export const resolveInstanceStatus = (instance) => {
    if (!instance || typeof instance !== 'object') {
        return null;
    }
    const record = instance;
    if (typeof record.status === 'string') {
        return record.status;
    }
    const nestedStatus = record.status;
    if (nestedStatus && typeof nestedStatus === 'object') {
        if (typeof nestedStatus.current === 'string') {
            return nestedStatus.current;
        }
        if (typeof nestedStatus.status === 'string') {
            return nestedStatus.status;
        }
    }
    return null;
};
export const resolveNormalizedInstanceStatus = (instance) => {
    const record = isPlainRecord(instance) ? instance : {};
    const resolvedStatus = resolveInstanceStatus(instance);
    const normalizedResolvedStatus = typeof resolvedStatus === 'string' ? resolvedStatus.toLowerCase() : null;
    const isExplicitlyConnected = record.connected === true;
    const isExplicitlyDisconnected = record.connected === false;
    if (isExplicitlyConnected) {
        return 'connected';
    }
    if (isExplicitlyDisconnected) {
        return 'disconnected';
    }
    return normalizedResolvedStatus || 'disconnected';
};
export const getStatusInfo = (instance) => {
    const record = isPlainRecord(instance) ? instance : {};
    const resolvedStatus = resolveInstanceStatus(instance);
    const normalizedStatus = normalizeWhatsAppStatus({
        status: resolvedStatus,
        connected: typeof record.connected === 'boolean' ? record.connected : undefined,
    });
    const statusKey = normalizedStatus.status ?? resolveNormalizedInstanceStatus(instance);
    const statusMap = {
        connected: { label: 'Conectado', variant: 'success' },
        connecting: { label: 'Conectando', variant: 'info' },
        reconnecting: { label: 'Reconectando', variant: 'info' },
        pending: { label: 'Pendente', variant: 'info' },
        disconnected: { label: 'Desconectado', variant: 'secondary' },
        qr_required: { label: 'QR necessário', variant: 'warning' },
        failed: { label: 'Falhou', variant: 'destructive' },
        error: { label: 'Erro', variant: 'destructive' },
    };
    const baseInfo = statusMap[statusKey] ?? {
        label: statusKey || 'Indefinido',
        variant: normalizedStatus.connected ? 'success' : 'secondary',
    };
    return {
        ...baseInfo,
        status: normalizedStatus.status ?? statusKey,
        connected: normalizedStatus.connected,
    };
};
export const resolveInstancePhone = (instance) => {
    if (!instance || typeof instance !== 'object') {
        return '';
    }
    const record = instance;
    const metadata = isPlainRecord(record.metadata) ? record.metadata : {};
    const candidates = [
        record.phoneNumber,
        record.number,
        record.msisdn,
        metadata.phoneNumber,
        metadata.phone_number,
        metadata.msisdn,
        record.jid,
        record.session,
    ];
    for (const candidate of candidates) {
        if (typeof candidate === 'string') {
            const trimmed = candidate.trim();
            if (trimmed.length > 0) {
                return trimmed;
            }
        }
    }
    return '';
};
export const shouldDisplayInstance = (instance) => {
    if (!instance || typeof instance !== 'object') {
        return false;
    }
    const record = instance;
    if (record.connected === true) {
        return true;
    }
    const status = resolveInstanceStatus(instance);
    const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : null;
    return normalizedStatus ? VISIBLE_INSTANCE_STATUSES.has(normalizedStatus) : false;
};
export const selectPreferredInstance = (list, options = {}) => {
    if (!Array.isArray(list) || list.length === 0) {
        return null;
    }
    const findMatch = (target) => {
        if (!target) {
            return null;
        }
        return list.find((item) => item.id === target || item.name === target) ?? null;
    };
    const preferred = findMatch(options.preferredInstanceId ?? null);
    if (preferred) {
        return preferred;
    }
    const campaign = findMatch(options.campaignInstanceId ?? null);
    if (campaign) {
        return campaign;
    }
    const connected = list.find((item) => item.connected === true);
    if (connected) {
        return connected;
    }
    return list[0] ?? null;
};
