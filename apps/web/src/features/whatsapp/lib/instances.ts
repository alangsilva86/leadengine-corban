import { normalizeQrPayload as normalizeQrPayloadContract } from '@ticketz/wa-contracts';
import { extractQrPayload } from '../utils/qr.js';

export const looksLikeWhatsAppJid = (value: unknown): value is string =>
  typeof value === 'string' && value.toLowerCase().endsWith('@s.whatsapp.net');

export const VISIBLE_INSTANCE_STATUSES = new Set([
  'connected',
  'connecting',
  'reconnecting',
  'disconnected',
  'qr_required',
  'error',
]);

export const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

export const pickStringValue = (...values: unknown[]): string | null => {
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

export const extractInstanceFromPayload = (
  payload: unknown,
): Record<string, unknown> | null => {
  if (!isPlainRecord(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (isPlainRecord(record.instance)) {
    return record.instance as Record<string, unknown>;
  }

  if (record.data !== undefined) {
    const nested = extractInstanceFromPayload(record.data);
    if (nested) {
      return nested;
    }
  }

  if (
    'id' in record ||
    'name' in record ||
    'status' in record ||
    'connected' in record
  ) {
    return record;
  }

  return null;
};

export const formatInstanceDisplayId = (value: string | null | undefined): string => {
  if (typeof value !== 'string') {
    return '';
  }
  if (looksLikeWhatsAppJid(value)) {
    return value.replace(/@s\.whatsapp\.net$/i, '@wa');
  }
  return value;
};

export const ensureArrayOfObjects = <T extends Record<string, unknown>>(value: unknown): T[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is T => Boolean(item && typeof item === 'object'));
};

export interface NormalizedInstance {
  id: string;
  tenantId: string | null;
  name: string | null;
  phoneNumber: string | null;
  status: string;
  connected: boolean;
  displayId: string;
  source: string | null;
  metadata: Record<string, unknown>;
  [key: string]: unknown;
}

const mergeInstanceEntries = (
  previous: NormalizedInstance | undefined,
  next: NormalizedInstance,
): NormalizedInstance => {
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
    status:
      next.status ||
      previous.status ||
      (previous.connected || next.connected ? 'connected' : 'disconnected'),
    tenantId: next.tenantId ?? previous.tenantId ?? null,
    name: next.name ?? previous.name ?? null,
    phoneNumber: next.phoneNumber ?? previous.phoneNumber ?? null,
    displayId: next.displayId || previous.displayId || next.id || previous.id,
    source: (next.source as string | null | undefined) ?? previous.source ?? null,
  };
};

export const normalizeInstanceRecord = (entry: unknown): NormalizedInstance | null => {
  if (!isPlainRecord(entry)) {
    return null;
  }

  const base = entry;
  const metadata = isPlainRecord(base.metadata) ? base.metadata : {};
  const profile = isPlainRecord(base.profile) ? base.profile : {};
  const details = isPlainRecord(base.details) ? base.details : {};
  const info = isPlainRecord(base.info) ? base.info : {};
  const mergedMetadata: Record<string, unknown> = {
    ...metadata,
    ...profile,
    ...details,
    ...info,
  };

  const id =
    pickStringValue(
      base.id,
      base.instanceId,
      (base as Record<string, unknown>).instance_id,
      base.sessionId,
      (base as Record<string, unknown>).session_id,
      mergedMetadata.id,
      mergedMetadata.instanceId,
      mergedMetadata.instance_id,
      mergedMetadata.sessionId,
      mergedMetadata.session_id,
    ) ?? null;

  if (!id) {
    return null;
  }

  const rawStatus =
    pickStringValue(
      base.status,
      (base as Record<string, unknown>).connectionStatus,
      (base as Record<string, unknown>).state,
      mergedMetadata.status,
      mergedMetadata.state,
    ) ?? null;

  const normalizedStatus = rawStatus ? rawStatus.toLowerCase() : null;

  const connectedValue =
    typeof base.connected === 'boolean'
      ? base.connected
      : typeof mergedMetadata.connected === 'boolean'
        ? mergedMetadata.connected
        : normalizedStatus === 'connected';

  const tenantId =
    pickStringValue(
      base.tenantId,
      (base as Record<string, unknown>).tenant_id,
      mergedMetadata.tenantId,
      mergedMetadata.tenant_id,
      base.agreementId,
      mergedMetadata.agreementId,
      base.accountId,
      mergedMetadata.accountId,
    ) ?? null;

  const name =
    pickStringValue(
      base.name,
      (base as Record<string, unknown>).displayName,
      (base as Record<string, unknown>).label,
      mergedMetadata.name,
      mergedMetadata.displayName,
      mergedMetadata.label,
      mergedMetadata.instanceName,
      mergedMetadata.sessionName,
      mergedMetadata.profileName,
    ) ?? null;

  const phoneNumber =
    pickStringValue(
      base.phoneNumber,
      (base as Record<string, unknown>).phone,
      (base as Record<string, unknown>).number,
      mergedMetadata.phoneNumber,
      mergedMetadata.phone,
      mergedMetadata.number,
      mergedMetadata.msisdn,
    ) ?? null;

  const source =
    pickStringValue(base.source, mergedMetadata.source, mergedMetadata.origin, base.origin) ??
    (looksLikeWhatsAppJid(id) ? 'broker' : 'db');

  const statusValue = normalizedStatus || (connectedValue ? 'connected' : 'disconnected');

  return {
    ...base,
    metadata: mergedMetadata,
    id,
    tenantId,
    name,
    phoneNumber,
    status: statusValue,
    connected: Boolean(connectedValue),
    displayId: formatInstanceDisplayId(id),
    source,
  };
};

export interface NormalizeOptions {
  allowedTenants?: string[];
  filterByTenant?: boolean;
  enforceTenantScope?: boolean;
}

export const normalizeInstancesCollection = (
  rawList: unknown,
  options: NormalizeOptions = {},
): NormalizedInstance[] => {
  const allowedTenants = Array.isArray(options.allowedTenants)
    ? options.allowedTenants
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : [];

  const shouldFilterByTenant =
    (options.filterByTenant === true || options.enforceTenantScope === true) &&
    allowedTenants.length > 0;

  const order: string[] = [];
  const map = new Map<string, NormalizedInstance>();

  if (!Array.isArray(rawList)) {
    return [];
  }

  for (const entry of rawList) {
    const normalized = normalizeInstanceRecord(entry);
    if (!normalized) {
      continue;
    }

    if (
      shouldFilterByTenant &&
      normalized.tenantId &&
      !allowedTenants.includes(normalized.tenantId)
    ) {
      continue;
    }

    const existing = map.get(normalized.id);
    const merged = mergeInstanceEntries(existing, normalized);

    if (!existing) {
      order.push(normalized.id);
    }

    map.set(normalized.id, merged);
  }

  return order.map((id) => map.get(id)).filter(Boolean) as NormalizedInstance[];
};

export const unwrapWhatsAppResponse = (payload: unknown): unknown => {
  if (!payload) {
    return {};
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (record.data && typeof record.data === 'object') {
      return record.data;
    }
    if (record.result && typeof record.result === 'object') {
      return record.result;
    }
  }

  return payload;
};

export interface ParsedInstancesPayload {
  raw: unknown;
  data: unknown;
  instances: NormalizedInstance[];
  instance: NormalizedInstance | null;
  status: string | null;
  statusPayload: unknown;
  connected: boolean | null;
  instanceId: string | null;
  qr: unknown;
}

export const parseInstancesPayload = (payload: unknown): ParsedInstancesPayload => {
  const rootPayload =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  const meta =
    rootPayload && metaIsRecord(rootPayload.meta)
      ? (rootPayload.meta as Record<string, unknown>)
      : {};
  const metaQrAvailable =
    typeof meta.qrAvailable === 'boolean'
      ? meta.qrAvailable
      : typeof meta.qr_available === 'boolean'
        ? meta.qr_available
        : undefined;
  const metaQrReason =
    typeof meta.qrReason === 'string'
      ? meta.qrReason
      : typeof meta.qr_reason === 'string'
        ? meta.qr_reason
        : null;
  const metaInstanceId =
    typeof meta.instanceId === 'string' && meta.instanceId.trim().length > 0
      ? meta.instanceId.trim()
      : null;

  const data = unwrapWhatsAppResponse(payload);
  const rootIsObject = data && typeof data === 'object' && !Array.isArray(data);

  let instances: NormalizedInstance[] = [];
  if (rootIsObject && Array.isArray((data as Record<string, unknown>).instances)) {
    instances = ensureArrayOfObjects((data as Record<string, unknown>).instances)
      .map((entry) => normalizeInstanceRecord(entry))
      .filter(Boolean) as NormalizedInstance[];
  } else if (rootIsObject && Array.isArray((data as Record<string, unknown>).items)) {
    instances = ensureArrayOfObjects((data as Record<string, unknown>).items)
      .map((entry) => normalizeInstanceRecord(entry))
      .filter(Boolean) as NormalizedInstance[];
  } else if (rootIsObject && Array.isArray((data as Record<string, unknown>).data)) {
    instances = ensureArrayOfObjects((data as Record<string, unknown>).data)
      .map((entry) => normalizeInstanceRecord(entry))
      .filter(Boolean) as NormalizedInstance[];
  } else if (Array.isArray(data)) {
    instances = ensureArrayOfObjects(data)
      .map((entry) => normalizeInstanceRecord(entry))
      .filter(Boolean) as NormalizedInstance[];
  }

  const instanceRaw = extractInstanceFromPayload(rootIsObject ? (data as Record<string, unknown>) : null);
  const instance = normalizeInstanceRecord(instanceRaw) ?? null;

  if (instance && !instances.some((item) => item.id === instance.id)) {
    instances = [...instances, instance];
  }

  const statusPayload =
    rootIsObject && typeof (data as Record<string, unknown>).status === 'object'
      ? (data as Record<string, unknown>).status
      : rootIsObject && typeof (data as Record<string, unknown>).instanceStatus === 'object'
        ? (data as Record<string, unknown>).instanceStatus
        : null;

  const status =
    typeof (statusPayload as Record<string, unknown> | null)?.status === 'string'
      ? ((statusPayload as Record<string, unknown>).status as string)
      : typeof (data as Record<string, unknown>)?.status === 'string'
        ? ((data as Record<string, unknown>).status as string)
        : typeof instance?.status === 'string'
          ? instance.status
          : null;

  const connected =
    typeof (data as Record<string, unknown>)?.connected === 'boolean'
      ? ((data as Record<string, unknown>).connected as boolean)
      : typeof (statusPayload as Record<string, unknown> | null)?.connected === 'boolean'
        ? ((statusPayload as Record<string, unknown>).connected as boolean)
        : typeof instance?.connected === 'boolean'
          ? instance.connected
          : null;

  const rawInstanceId = (data as Record<string, unknown>)?.instanceId ?? metaInstanceId;
  const instanceId =
    typeof rawInstanceId === 'string' && rawInstanceId.trim().length > 0
      ? rawInstanceId.trim()
      : instance?.id ?? null;

  let qr = extractQrPayload(
    (rootIsObject && (data as Record<string, unknown>).qr !== undefined
      ? (data as Record<string, unknown>).qr
      : null) ?? statusPayload ?? data,
  );

  if (!qr && (metaQrAvailable !== undefined || metaQrReason)) {
    qr = normalizeQrPayloadContract({
      available: metaQrAvailable ?? false,
      reason: metaQrReason ?? null,
    });
  } else if (qr && metaQrReason && !qr.reason) {
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

function metaIsRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export const resolveInstanceStatus = (instance: unknown): string | null => {
  if (!instance || typeof instance !== 'object') {
    return null;
  }

  const record = instance as Record<string, unknown>;
  if (typeof record.status === 'string') {
    return record.status;
  }

  const nestedStatus = record.status;
  if (nestedStatus && typeof nestedStatus === 'object') {
    if (typeof (nestedStatus as Record<string, unknown>).current === 'string') {
      return (nestedStatus as Record<string, unknown>).current as string;
    }
    if (typeof (nestedStatus as Record<string, unknown>).status === 'string') {
      return (nestedStatus as Record<string, unknown>).status as string;
    }
  }

  return null;
};

export interface InstanceStatusInfo {
  label: string;
  variant: string;
}

export const getStatusInfo = (instance: unknown): InstanceStatusInfo => {
  const record = isPlainRecord(instance) ? instance : {};
  const resolvedStatus = resolveInstanceStatus(instance);
  const statusMap: Record<string, InstanceStatusInfo> = {
    connected: { label: 'Conectado', variant: 'success' },
    connecting: { label: 'Conectando', variant: 'info' },
    reconnecting: { label: 'Reconectando', variant: 'info' },
    pending: { label: 'Pendente', variant: 'info' },
    disconnected: { label: 'Desconectado', variant: 'secondary' },
    qr_required: { label: 'QR necessário', variant: 'warning' },
    failed: { label: 'Falhou', variant: 'destructive' },
    error: { label: 'Erro', variant: 'destructive' },
  };

  const isExplicitlyConnected = record.connected === true;
  const isExplicitlyDisconnected = record.connected === false;

  const normalizedStatus = (() => {
    const statusKey = typeof resolvedStatus === 'string' ? resolvedStatus : null;
    if (statusKey && statusMap[statusKey]) {
      return statusKey;
    }

    if (isExplicitlyConnected) {
      return 'connected';
    }

    if (isExplicitlyDisconnected) {
      return 'disconnected';
    }

    return statusKey || 'disconnected';
  })();

  return statusMap[normalizedStatus] || {
    label: normalizedStatus || 'Indefinido',
    variant: isExplicitlyConnected ? 'success' : 'secondary',
  };
};

export const resolveInstancePhone = (instance: unknown): string => {
  if (!instance || typeof instance !== 'object') {
    return '';
  }

  const record = instance as Record<string, unknown>;
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

export const shouldDisplayInstance = (instance: unknown): boolean => {
  if (!instance || typeof instance !== 'object') {
    return false;
  }

  const record = instance as Record<string, unknown>;
  if (record.connected === true) {
    return true;
  }

  const status = resolveInstanceStatus(instance)?.toLowerCase();
  return status ? VISIBLE_INSTANCE_STATUSES.has(status) : false;
};

export interface SelectInstanceOptions {
  preferredInstanceId?: string | null;
  campaignInstanceId?: string | null;
}

export const selectPreferredInstance = (
  list: NormalizedInstance[],
  options: SelectInstanceOptions = {},
): NormalizedInstance | null => {
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }

  const findMatch = (target: string | null | undefined) => {
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
