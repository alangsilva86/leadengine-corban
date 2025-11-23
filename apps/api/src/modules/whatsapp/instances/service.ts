// Auto-generated WhatsApp instance services module
import { Prisma } from '@prisma/client';
import { normalizeWhatsAppStatus, WHATSAPP_STATUS } from '@leadengine/wa-status';
import { z } from 'zod';
import {
  whatsappBrokerClient,
  WhatsAppBrokerNotConfiguredError,
  WhatsAppBrokerError,
  type WhatsAppStatus,
  type WhatsAppBrokerInstanceSnapshot,
  type WhatsAppInstance as BrokerWhatsAppInstance,
  type DeleteInstanceOptions,
} from '../../../services/whatsapp-broker-client';
import { emitToTenant } from '../../../lib/socket-registry';
import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';
import { normalizePhoneNumber, PhoneNormalizationError } from '../../../utils/phone';
import { invalidateCampaignCache } from '../../../features/whatsapp-inbound/services/inbound-lead-service';
import {
  hasErrorName,
  readPrismaErrorCode,
  isDatabaseDisabledError,
  resolveWhatsAppStorageError,
  describeErrorForLog,
  logWhatsAppStorageError,
} from './errors';
import { isWhatsappRefreshDisabledOnStorageDegraded } from '../../../config/feature-flags';
import {
  appendInstanceHistory,
  buildHistoryEntry,
  compactRecord,
  findPhoneNumberInObject,
  isRecord,
  pickString,
  readLastErrorFromMetadata,
  withInstanceLastError,
} from './helpers';
import {
  archiveInstanceSnapshot,
  archiveDetachedInstance,
  readInstanceArchives,
  clearInstanceArchive,
} from './archive';
import { createSyncInstancesFromBroker, resolveSnapshotTenantId } from './sync';
import {
  invalidateCachedSnapshots,
  removeCachedSnapshot,
  scheduleWhatsAppDisconnectRetry,
  clearWhatsAppDisconnectRetry,
  SYNC_TTL_MS,
  type SnapshotCacheBackendType,
  type SnapshotCacheReadResult,
} from './cache';
import {
  normalizeInstanceStatusResponse,
  normalizeQr,
  extractQrImageBuffer,
  type NormalizedQr,
} from './qr';
import {
  resolveDefaultInstanceId,
  INVALID_INSTANCE_ID_MESSAGE,
  readBrokerErrorStatus,
} from './http';
import { createPrismaInstanceRepository, type InstanceRepository } from './instance-repository';
import { defaultInstanceMetrics, recordQrOutcome, safeIncrementHttpCounter, type InstanceMetrics } from './metrics';
import { createSnapshotCache, type SnapshotCache } from './snapshot-cache';
import {
  mapBrokerInstanceStatusToDbStatus,
  mapBrokerStatusToDbStatus,
} from './status-mapper';
import type {
  InstanceMetadata,
  NormalizedInstance,
  NormalizedInstanceStatus,
  StoredInstance,
} from './types';

const MAX_BFS_NODES = 5_000;
const CACHE_WRITE_TIMEOUT_MS = 5_000;
const MAX_SYNC_ATTEMPTS = 3;

type BrokerRateLimit = {
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
};

type BrokerSessionStatus = {
  status?: string | null;
  connected?: boolean | null;
  qrCode?: string | null;
  qrExpiresAt?: string | null;
  rate?: Record<string, unknown> | null;
};

export type InstanceCollectionDependencies = {
  repository: InstanceRepository;
  cache: SnapshotCache;
  metrics: InstanceMetrics;
  syncInstances: typeof syncInstancesFromBroker;
  brokerClient: typeof whatsappBrokerClient;
};

const normalizeKeyName = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const toNumeric = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  return isRecord(value) ? (value as Record<string, unknown>) : null;
};

const mergeRecords = (...sources: Array<Record<string, unknown> | null>): Record<string, unknown> | undefined => {
  const merged: Record<string, unknown> = {};
  let hasValue = false;

  for (const source of sources) {
    if (!isRecord(source)) {
      continue;
    }
    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      merged[key] = value;
      hasValue = true;
    }
  }

  return hasValue ? merged : undefined;
};

const tenantRefreshQueues = new Map<string, Promise<unknown>>();

const enqueueTenantRefresh = async <T>(tenantId: string, task: () => Promise<T>): Promise<T> => {
  const previous = tenantRefreshQueues.get(tenantId) ?? Promise.resolve();
  const next = previous.finally(() => task());
  const tracking = next.then(() => undefined, () => undefined);
  tenantRefreshQueues.set(tenantId, tracking);

  try {
    return await next;
  } finally {
    if (tenantRefreshQueues.get(tenantId) === tracking) {
      tenantRefreshQueues.delete(tenantId);
    }
  }
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => Error): Promise<T> => {
  let timeoutHandle: NodeJS.Timeout | null = null;

  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(onTimeout()), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};

export const collectNumericFromSources = (
  sources: unknown[],
  keywords: string[],
): number | null => {
  const normalizedKeywords = keywords.map(normalizeKeyName).filter((entry) => entry.length > 0);

  const inspect = (root: unknown, visited: Set<unknown>, override?: string[]): number | null => {
    if (!root || typeof root !== 'object') {
      return null;
    }

    const targetKeywords = override ?? normalizedKeywords;
    const queue = Array.isArray(root) ? [...root] : [root];
    let visitedCount = 0;

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || typeof current !== 'object') {
        continue;
      }
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      visitedCount += 1;
      if (visitedCount > MAX_BFS_NODES) {
        return null;
      }

      if (Array.isArray(current)) {
        for (const entry of current) {
          queue.push(entry);
        }
        continue;
      }

      for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
        const normalizedKey = normalizeKeyName(key);
        const hasMatch = targetKeywords.some((keyword) => normalizedKey.includes(keyword));
        if (hasMatch) {
          const numeric = toNumeric(value);
          if (numeric !== null) {
            return numeric;
          }
          if (value && typeof value === 'object') {
            const nested = inspect(
              value,
              visited,
              ['total', 'value', 'count', 'quantity'].map(normalizeKeyName),
            );
            if (nested !== null) {
              return nested;
            }
          }
        }

        if (value && typeof value === 'object') {
          queue.push(value);
        }
      }
    }

    return null;
  };

  for (const source of sources) {
    const result = inspect(source, new Set());
    if (result !== null) {
      return result;
    }
  }

  return null;
};

const locateStatusCountsCandidate = (sources: Record<string, unknown>[]): Record<string, unknown> | number[] | undefined => {
  const keywords = [
    'statuscounts',
    'statuscount',
    'statusmap',
    'statusmetrics',
    'statuses',
    'bystatus',
    'messagestatuscounts',
    'messagesstatuscounts',
    'status',
  ];
  const normalizedKeywords = keywords.map(normalizeKeyName);
  const statusKeys = new Set(['1', '2', '3', '4', '5']);
  const visited = new Set<unknown>();
  const queue: unknown[] = sources.filter((item) => item !== undefined && item !== null);
  let visitedCount = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') {
      continue;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    visitedCount += 1;
    if (visitedCount > MAX_BFS_NODES) {
      return undefined;
    }

    if (Array.isArray(current)) {
      if (current.length > 0 && current.every((entry) => typeof entry === 'number')) {
        return current;
      }
      for (const entry of current) {
        queue.push(entry);
      }
      continue;
    }

    const record = current as Record<string, unknown>;
    const numericKeys = Object.keys(record).filter((key) => statusKeys.has(key));
    if (numericKeys.length >= 3) {
      return record;
    }

    for (const [key, value] of Object.entries(record)) {
      const normalizedKey = normalizeKeyName(key);
      if (normalizedKeywords.some((keyword) => normalizedKey.includes(keyword))) {
        if (value && typeof value === 'object') {
          return value as Record<string, unknown>;
        }
      }
        if (value && typeof value === 'object') {
          queue.push(value);
        }
    }
  }

  return undefined;
};

export const normalizeStatusCountsData = (
  rawCounts: Record<string, unknown> | number[] | null | undefined,
): Record<string, number> | null => {
  if (!rawCounts) {
    return null;
  }

  const defaultKeys = ['1', '2', '3', '4', '5'];
  const normalizedEntries = new Map<string, number>();

  if (Array.isArray(rawCounts)) {
    rawCounts.forEach((value, index) => {
      const numeric = toNumeric(value);
      if (numeric === null) {
        return;
      }
      normalizedEntries.set(normalizeKeyName(String(index + 1)), numeric);
    });
  } else if (typeof rawCounts === 'object') {
    for (const [key, value] of Object.entries(rawCounts)) {
      const numeric = toNumeric(value);
      if (numeric === null) {
        continue;
      }
      normalizedEntries.set(normalizeKeyName(key), numeric);
    }
  }

  if (normalizedEntries.size === 0) {
    return null;
  }

  const result: Record<string, number> = {};
  defaultKeys.forEach((key) => {
    const normalizedKey = normalizeKeyName(key);
    const candidates = [
      normalizedKey,
      normalizeKeyName(`status_${key}`),
      normalizeKeyName(`status${key}`),
    ];

    let resolved = 0;
    for (const candidate of candidates) {
      if (normalizedEntries.has(candidate)) {
        resolved = normalizedEntries.get(candidate) ?? 0;
        break;
      }
    }
    result[key] = resolved;
  });

  return result;
};

const locateRateSourceCandidate = (sources: Record<string, unknown>[]): Record<string, unknown> | null => {
  const keywords = ['rateusage', 'ratelimit', 'ratelimiter', 'rate', 'throttle', 'quota'];
  const normalizedKeywords = keywords.map(normalizeKeyName);
  const visited = new Set<unknown>();
  const queue: unknown[] = sources.filter((item) => item !== undefined && item !== null);
  let visitedCount = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') {
      continue;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    visitedCount += 1;
    if (visitedCount > MAX_BFS_NODES) {
      return null;
    }

    if (Array.isArray(current)) {
      for (const entry of current) {
        queue.push(entry);
      }
      continue;
    }

    const record = current as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      const normalizedKey = normalizeKeyName(key);
      if (normalizedKeywords.some((keyword) => normalizedKey.includes(keyword))) {
        if (value && typeof value === 'object') {
          return value as Record<string, unknown>;
        }
      }
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return null;
};

export const normalizeRateUsageData = (
  rawRate: Record<string, unknown> | null | undefined,
): Record<string, number> | null => {
  if (!rawRate || typeof rawRate !== 'object') {
    return null;
  }

  const source = rawRate as Record<string, unknown>;
  const used =
    collectNumericFromSources([source], ['usage', 'used', 'current', 'value', 'count', 'consumed']) ??
    null;
  const limit =
    collectNumericFromSources([source], ['limit', 'max', 'maximum', 'quota', 'total', 'capacity']) ??
    null;
  const remaining =
    collectNumericFromSources([source], ['remaining', 'left', 'available', 'saldo', 'restante']) ??
    null;

  const resolvedLimit = typeof limit === 'number' ? Math.max(0, limit) : null;
  let resolvedUsed = typeof used === 'number' ? Math.max(0, used) : null;
  let resolvedRemaining = typeof remaining === 'number' ? Math.max(0, remaining) : null;

  if (resolvedUsed === null && resolvedRemaining !== null && resolvedLimit !== null) {
    resolvedUsed = Math.max(0, resolvedLimit - resolvedRemaining);
  }

  if (resolvedRemaining === null && resolvedLimit !== null && resolvedUsed !== null) {
    resolvedRemaining = Math.max(0, resolvedLimit - resolvedUsed);
  }

  const usedValue = resolvedUsed ?? 0;
  const limitValue = resolvedLimit ?? 0;
  const remainingValue = resolvedRemaining ?? (limitValue ? Math.max(0, limitValue - usedValue) : 0);
  const percentageValue =
    limitValue > 0 ? Math.min(100, Math.round((usedValue / limitValue) * 100)) : usedValue > 0 ? 100 : 0;

  if (!usedValue && !limitValue && !remainingValue) {
    return null;
  }

  return {
    used: usedValue,
    limit: limitValue,
    remaining: remainingValue,
    percentage: percentageValue,
  };
};

const readRecordString = (
  source: Record<string, unknown> | null,
  key: string,
): string | null => {
  if (!source) {
    return null;
  }
  const value = source[key];
  return typeof value === 'string' ? value : null;
};

const extractPhoneFromJidString = (value: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || !trimmed.includes('@')) {
    return null;
  }

  const local = trimmed.split('@')[0] ?? '';
  const digits = local.replace(/\D+/g, '');
  if (digits.length < 8) {
    return null;
  }
  return `+${digits}`;
};

const findPhoneFromJid = (value: unknown): string | null => {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return extractPhoneFromJidString(value);
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const result = findPhoneFromJid(entry);
      if (result) {
        return result;
      }
    }
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const queue: Record<string, unknown>[] = [value as Record<string, unknown>];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift() as Record<string, unknown>;
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    for (const entry of Object.values(current)) {
      if (typeof entry === 'string') {
        const phone = extractPhoneFromJidString(entry);
        if (phone) {
          return phone;
        }
      } else if (Array.isArray(entry)) {
        for (const nested of entry) {
          const phone = findPhoneFromJid(nested);
          if (phone) {
            return phone;
          }
        }
      } else if (isRecord(entry)) {
        queue.push(entry as Record<string, unknown>);
      }
    }
  }

  return null;
};

const resolvePhoneNumber = (
  instance: StoredInstance,
  metadata: Record<string, unknown>,
  brokerStatus: WhatsAppStatus | null,
): string | null => {
  const brokerRecord = asRecord(brokerStatus);
  const rawStatus = asRecord(brokerStatus?.raw);
  const phone = pickString(
    instance.phoneNumber,
    metadata.phoneNumber,
    metadata.phone_number,
    metadata.msisdn,
    metadata.phone,
    metadata.number,
    brokerRecord?.phoneNumber,
    brokerRecord?.phone_number,
    brokerRecord?.msisdn,
    rawStatus?.phoneNumber,
    rawStatus?.phone_number,
    rawStatus?.msisdn,
  );

  if (phone) {
    try {
      const normalized = normalizePhoneNumber(phone);
      return normalized.e164;
    } catch (error) {
      if (!(error instanceof PhoneNormalizationError)) {
        logger.warn('whatsapp.instances.phone.normalizeUnexpected', {
          tenantId: instance.tenantId,
          error: String(error),
        });
      }
      const digits = phone.replace(/\D+/g, '');
      return digits ? `+${digits}` : phone;
    }
  }

  const brokerRecordObject = isRecord(brokerRecord) ? (brokerRecord as Record<string, unknown>) : null;
  const rawStatusObject = isRecord(rawStatus) ? (rawStatus as Record<string, unknown>) : null;
  const metadataObject = isRecord(metadata) ? (metadata as Record<string, unknown>) : null;

  const phoneFromJid =
    extractPhoneFromJidString(readRecordString(brokerRecordObject, 'jid')) ??
    extractPhoneFromJidString(
      isRecord(brokerRecordObject?.user)
        ? readRecordString(brokerRecordObject.user as Record<string, unknown>, 'id')
        : null,
    ) ??
    extractPhoneFromJidString(readRecordString(rawStatusObject, 'jid')) ??
    extractPhoneFromJidString(readRecordString(metadataObject, 'jid')) ??
    findPhoneFromJid(metadata) ??
    findPhoneFromJid(rawStatus) ??
    findPhoneFromJid(brokerRecord);

  if (phoneFromJid) {
    return phoneFromJid;
  }

  return (
    findPhoneNumberInObject(metadata) ??
    findPhoneNumberInObject(rawStatus) ??
    findPhoneNumberInObject(brokerRecord) ??
    null
  );
};

const normalizeInstance = (instance: BrokerWhatsAppInstance | null | undefined): NormalizedInstance | null => {
  if (!instance) {
    return null;
  }

  const id = typeof instance.id === 'string' && instance.id.trim().length > 0 ? instance.id.trim() : null;
  if (!id) {
    return null;
  }

  const status: NormalizedInstance['status'] = (() => {
    const rawStatus: string | null = typeof instance.status === 'string' ? instance.status : null;
    switch (rawStatus) {
      case 'connected':
        return 'connected';
      case 'connecting':
      case 'qr_required':
        return 'connecting';
      case 'disconnected':
        return 'disconnected';
      case 'pending':
        return 'pending';
      case 'failed':
        return 'failed';
      default:
        return instance.connected ? 'connected' : 'disconnected';
    }
  })();

  const connected = Boolean(instance.connected ?? status === 'connected');
  const name = typeof instance.name === 'string' && instance.name.trim().length > 0 ? instance.name.trim() : id;

  return {
    id,
    tenantId: instance.tenantId ?? null,
    name,
    status,
    connected,
    createdAt: instance.createdAt ?? null,
    lastActivity: instance.lastActivity ?? null,
    phoneNumber: instance.phoneNumber ?? null,
    user: instance.user ?? null,
    agreementId: null,
    stats: instance.stats ?? null,
    metrics: isRecord((instance as { metrics?: unknown }).metrics)
      ? ((instance as { metrics?: Record<string, unknown> | null }).metrics ?? null)
      : null,
    messages: null,
    rate: null,
    rawStatus: null,
    metadata: {},
    lastError: null,
  };
};

const slugifyInstanceId = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
};

const generateInstanceIdSuggestion = async (
  tenantId: string,
  baseName: string,
  fallbackId: string,
): Promise<string> => {
  const base = slugifyInstanceId(baseName) || slugifyInstanceId(fallbackId) || 'whatsapp-instance';

  const exists = async (candidate: string) => {
    const match = await prisma.whatsAppInstance.findFirst({
      where: { tenantId, id: candidate },
      select: { id: true },
    });
    return Boolean(match);
  };

  const suffix = () => Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, '0');

  const maxLength = 40;
  let candidate = base.slice(0, maxLength);
  let attempts = 0;

  while (await exists(candidate) && attempts < 5) {
    const suffixValue = suffix();
    const trimmedBase = candidate.slice(0, Math.max(0, maxLength - suffixValue.length - 1));
    candidate = `${trimmedBase}-${suffixValue}`.replace(/^-+/, '');
    attempts += 1;
  }

  return candidate || fallbackId || `instance-${suffix()}`;
};

export class WhatsAppInstanceAlreadyExistsError extends Error {
  code = 'INSTANCE_ALREADY_EXISTS';
  status = 409;
  suggestedId: string | null;

  constructor(message = 'Já existe uma instância WhatsApp com esse identificador.', suggestedId: string | null = null) {
    super(message);
    this.name = 'WhatsAppInstanceAlreadyExistsError';
    this.suggestedId = suggestedId;
  }
}

export class WhatsAppInstanceInvalidPayloadError extends Error {
  code = 'INVALID_INSTANCE_PAYLOAD';
  status = 400;

  constructor(message = 'Não foi possível criar a instância WhatsApp com os dados fornecidos.') {
    super(message);
    this.name = 'WhatsAppInstanceInvalidPayloadError';
  }
}

export const createWhatsAppInstanceSchema = z
  .object({
    name: z.string({ required_error: 'Nome da instância é obrigatório.' }).trim().min(1, 'Nome da instância é obrigatório.'),
    id: z
      .string()
      .transform((value) => value.trim())
      .refine((value) => value.length > 0, INVALID_INSTANCE_ID_MESSAGE)
      .optional(),
    tenantId: z.string().optional().transform((value) => (typeof value === 'string' ? value.trim() : value)),
  })
  .transform((data) => ({
    ...data,
    id: data.id && data.id.length > 0 ? data.id : undefined,
    tenantId: data.tenantId && data.tenantId.length > 0 ? data.tenantId : undefined,
  }));

export const executeSideEffects = async (
  effects: Array<() => Promise<void> | void>,
  context: Record<string, unknown>,
): Promise<void> => {
  for (const effect of effects) {
    try {
      await effect();
    } catch (error) {
      logger.warn('whatsapp.instances.sideEffect.failed', {
        ...context,
        error: describeErrorForLog(error),
      });
    }
  }
};

const BROKER_NOT_FOUND_CODES = new Set(['SESSION_NOT_FOUND', 'BROKER_SESSION_NOT_FOUND', 'INSTANCE_NOT_FOUND']);
const BROKER_ALREADY_DISCONNECTED_CODES = new Set([
  'SESSION_NOT_CONNECTED',
  'SESSION_ALREADY_DISCONNECTED',
  'SESSION_ALREADY_LOGGED_OUT',
  'SESSION_NOT_OPEN',
  'SESSION_CLOSED',
  'ALREADY_DISCONNECTED',
  'ALREADY_LOGGED_OUT',
  'SESSION_NOT_INITIALIZED',
]);

const readBrokerErrorCode = (error: unknown): string | null => {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    const normalized = ((error as { code: string }).code ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }
  return null;
};

const readBrokerErrorMessage = (error: unknown): string | null => {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    const normalized = ((error as { message: string }).message || '').trim();
    return normalized.length > 0 ? normalized : null;
  }
  return null;
};

export const isBrokerMissingInstanceError = (error: unknown): boolean => {
  const status = readBrokerErrorStatus(error);
  const code = readBrokerErrorCode(error);
  return status === 404 || (code ? BROKER_NOT_FOUND_CODES.has(code) : false);
};

const includesBrokerMessageKeyword = (message: string | null, keywords: string[]): boolean => {
  if (!message) {
    return false;
  }
  const normalized = message.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
};

export const isBrokerAlreadyDisconnectedError = (error: unknown): boolean => {
  const code = readBrokerErrorCode(error);
  if (code && (BROKER_ALREADY_DISCONNECTED_CODES.has(code) || BROKER_NOT_FOUND_CODES.has(code))) {
    return true;
  }

  const message = readBrokerErrorMessage(error);
  if (
    includesBrokerMessageKeyword(message, [
      'already disconnected',
      'already logged out',
      'not connected',
      'session closed',
      'sessão já desconectada',
      'sessão encerrada',
      'não está conectada',
    ])
  ) {
    return true;
  }

  const status = readBrokerErrorStatus(error);
  return status === 409 || status === 410 || status === 404;
};

const extractAgreementIdFromMetadata = (metadata: Record<string, unknown> | null | undefined): string | null => {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }
  const source = metadata as Record<string, unknown>;
  const direct = pickString(
    source.agreementId,
    source.agreement_id,
    source.agreementCode,
    source.agreementSlug,
    source.tenantAgreement,
    source.agreement,
  );
  if (direct) {
    return direct;
  }
  const nested =
    isRecord(source.agreement) && typeof (source.agreement as Record<string, unknown>).id === 'string'
      ? ((source.agreement as Record<string, unknown>).id as string)
      : null;
  return nested ?? null;
};

export const serializeStoredInstance = (
  instance: StoredInstance,
  brokerStatus: WhatsAppStatus | null,
) => {
  const normalized = normalizeWhatsAppStatus({
    status: brokerStatus?.status ?? instance.status,
    connected: brokerStatus?.connected ?? instance.connected,
  });
  const normalizedStatus: NormalizedInstance['status'] = normalized.status;
  const connected = normalized.connected;
  const rawStatus =
    asRecord(brokerStatus?.raw) ??
    (isRecord(brokerStatus) ? (brokerStatus as Record<string, unknown>) : null);

  const stats =
    mergeRecords(
      asRecord(brokerStatus?.stats),
      asRecord(brokerStatus?.messages),
      asRecord(rawStatus?.stats as Record<string, unknown> | null),
      asRecord(rawStatus?.messages as Record<string, unknown> | null),
      asRecord(rawStatus?.metrics as Record<string, unknown> | null),
      asRecord((rawStatus as Record<string, unknown> | null)?.counters),
      asRecord((rawStatus as Record<string, unknown> | null)?.status),
      asRecord((instance.metadata as Record<string, unknown> | null)?.stats),
    ) ?? undefined;

  let metrics =
    mergeRecords(
      asRecord(brokerStatus?.metrics),
      asRecord(brokerStatus?.rateUsage),
      asRecord(rawStatus?.metrics as Record<string, unknown> | null),
      asRecord(rawStatus?.messages as Record<string, unknown> | null),
      asRecord(rawStatus?.stats as Record<string, unknown> | null),
    ) ?? null;

  const baseMetadata = (instance.metadata as Record<string, unknown>) ?? {};
  const cachedNormalized =
    typeof baseMetadata.normalizedMetrics === 'object' ? baseMetadata.normalizedMetrics : null;
  const brokerBroughtNewMetrics =
    Boolean(brokerStatus?.metrics) ||
    Boolean(brokerStatus?.rateUsage) ||
    Boolean(rawStatus?.metrics) ||
    Boolean(rawStatus?.messages) ||
    Boolean(rawStatus?.stats);

  if (!brokerBroughtNewMetrics && cachedNormalized && (!metrics || Object.keys(metrics).length === 0)) {
    metrics = { ...(cachedNormalized as Record<string, unknown>) };
  }

  const messages = asRecord(brokerStatus?.messages) ?? asRecord(rawStatus?.messages) ?? null;
  const rate =
    mergeRecords(
      asRecord(brokerStatus?.rate),
      asRecord(brokerStatus?.rateUsage),
      asRecord(rawStatus?.rate as Record<string, unknown> | null),
      asRecord((rawStatus as Record<string, unknown> | null)?.rateUsage),
    ) ?? null;

  const metadata = { ...baseMetadata };
  if (brokerStatus?.metrics && typeof brokerStatus.metrics === 'object') {
    metadata.brokerMetrics = brokerStatus.metrics;
  }
  if (brokerStatus?.rateUsage && typeof brokerStatus.rateUsage === 'object') {
    metadata.brokerRateUsage = brokerStatus.rateUsage;
  }

  const phoneNumber = resolvePhoneNumber(instance, metadata, brokerStatus);
  const brokerRecord = brokerStatus ? brokerStatus : null;

  const dataSources = [metrics, stats, messages, rawStatus, brokerRecord].filter(
    (value) => value !== undefined && value !== null,
  ) as Record<string, unknown>[];

  const sentMetric = collectNumericFromSources(dataSources, [
    'messagessent',
    'messagesent',
    'totalsent',
    'senttotal',
    'sent',
    'enviadas',
    'enviados',
  ]);
  const queuedMetric = collectNumericFromSources(dataSources, [
    'queue',
    'queued',
    'pending',
    'waiting',
    'fila',
    'aguardando',
  ]);
  const failedMetric = collectNumericFromSources(dataSources, [
    'fail',
    'failed',
    'failure',
    'falha',
    'falhas',
    'error',
    'errors',
    'erro',
    'erros',
  ]);

  const statusCountsCandidate = locateStatusCountsCandidate(dataSources);
  const normalizedStatusCounts = normalizeStatusCountsData(statusCountsCandidate);
  const rateSourceCandidate = locateRateSourceCandidate(dataSources);
  const normalizedRateUsage = normalizeRateUsageData(rateSourceCandidate);

  const normalizedMetrics: Record<string, unknown> = metrics ? { ...metrics } : {};
  if (sentMetric !== null) {
    normalizedMetrics.messagesSent = sentMetric;
    normalizedMetrics.sent = sentMetric;
  }
  if (queuedMetric !== null) {
    normalizedMetrics.queued = queuedMetric;
    normalizedMetrics.pending = queuedMetric;
  }
  if (failedMetric !== null) {
    normalizedMetrics.failed = failedMetric;
    normalizedMetrics.errors = failedMetric;
  }
  if (normalizedStatusCounts) {
    normalizedMetrics.statusCounts = normalizedStatusCounts;
  }
  if (normalizedRateUsage) {
    normalizedMetrics.rateUsage = normalizedRateUsage;
  }
  if (Object.keys(normalizedMetrics).length > 0) {
    metrics = normalizedMetrics;
    metadata.normalizedMetrics = normalizedMetrics;
  } else {
    metrics = null;
  }

  const agreementId = extractAgreementIdFromMetadata(metadata) ?? null;
  if (agreementId && typeof metadata.agreementId !== 'string') {
    metadata.agreementId = agreementId;
  }
  if (agreementId) {
    const agreementMetadata =
      metadata.agreement && typeof metadata.agreement === 'object'
        ? { ...(metadata.agreement as Record<string, unknown>) }
        : {};
    if (!agreementMetadata.id) {
      agreementMetadata.id = agreementId;
    }
    metadata.agreement = agreementMetadata;
  }

  const lastError = readLastErrorFromMetadata(metadata as InstanceMetadata);

  return {
    id: instance.id,
    tenantId: instance.tenantId,
    name: instance.name,
    status: normalizedStatus,
    connected,
    createdAt: instance.createdAt.toISOString(),
    lastActivity: instance.lastSeenAt ? instance.lastSeenAt.toISOString() : null,
    phoneNumber,
    user: null,
    agreementId,
    stats,
    metrics,
    messages,
    rate,
    rawStatus,
    metadata,
    lastError,
    brokerId: instance.brokerId,
  };
};

export const syncInstancesFromBroker = createSyncInstancesFromBroker({
  prisma,
  logger,
  whatsappBrokerClient,
  emitToTenant,
  readInstanceArchives,
  appendInstanceHistory,
  buildHistoryEntry,
  withInstanceLastError,
  findPhoneNumberInObject,
  pickString,
  mapBrokerStatusToDbStatus,
  mapBrokerInstanceStatusToDbStatus,
  metrics: defaultInstanceMetrics,
});

export const defaultInstanceCollectionDependencies: InstanceCollectionDependencies = {
  repository: createPrismaInstanceRepository(prisma),
  cache: createSnapshotCache(),
  metrics: defaultInstanceMetrics,
  syncInstances: syncInstancesFromBroker,
  brokerClient: whatsappBrokerClient,
};

const toJsonObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  try {
    return JSON.parse(JSON.stringify(value ?? {}));
  } catch {
    return {};
  }
};

export const createWhatsAppInstance = async ({
  tenantId,
  actorId,
  input,
}: {
  tenantId: string;
  actorId: string;
  input: z.infer<typeof createWhatsAppInstanceSchema>;
}) => {
  const name = input.name.trim();
  const explicitId = input.id?.trim() ?? '';
  const instanceId = explicitId || name || resolveDefaultInstanceId();

  const existing = await prisma.whatsAppInstance.findFirst({
    where: {
      tenantId,
      id: instanceId,
    },
    select: { id: true },
  });

  if (existing) {
    const suggestion = await generateInstanceIdSuggestion(tenantId, name, instanceId);
    throw new WhatsAppInstanceAlreadyExistsError(undefined, suggestion);
  }

  safeIncrementHttpCounter();
  const brokerInstance = await whatsappBrokerClient.createInstance({
    tenantId,
    name,
    instanceId,
  });

  const brokerIdCandidate = typeof brokerInstance.id === 'string' ? brokerInstance.id.trim() : '';
  const brokerId = brokerIdCandidate.length > 0 ? brokerIdCandidate : instanceId;
  const brokerNameCandidate = typeof brokerInstance.name === 'string' ? brokerInstance.name.trim() : '';
  const displayName = brokerNameCandidate.length > 0 ? brokerNameCandidate : name;
  const mappedStatus = mapBrokerInstanceStatusToDbStatus(brokerInstance.status ?? null);
  const connected = Boolean(brokerInstance.connected ?? mappedStatus === 'connected');
  const phoneNumber =
    typeof brokerInstance.phoneNumber === 'string' && brokerInstance.phoneNumber.trim().length > 0
      ? brokerInstance.phoneNumber.trim()
      : null;

  const historyEntry = buildHistoryEntry(
    'created',
    actorId,
    compactRecord({
      status: mappedStatus,
      connected,
      name: displayName,
      phoneNumber: phoneNumber ?? undefined,
    }),
  );

  const baseMetadata: Record<string, unknown> = {
    displayId: instanceId,
    slug: instanceId,
    brokerId,
    displayName,
    label: displayName,
    origin: 'api-create',
  };
  const metadataWithHistory = appendInstanceHistory(baseMetadata, historyEntry);
  const metadataWithoutError = withInstanceLastError(metadataWithHistory, null);

  let stored: StoredInstance;
  try {
    stored = await prisma.whatsAppInstance.create({
      data: {
        id: instanceId,
        tenantId,
        name: displayName,
        brokerId,
        status: mappedStatus,
        connected,
        ...(phoneNumber ? { phoneNumber } : {}),
        metadata: metadataWithoutError,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const suggestion = await generateInstanceIdSuggestion(tenantId, name, instanceId);
      throw new WhatsAppInstanceAlreadyExistsError(undefined, suggestion);
    }
    if (error instanceof Prisma.PrismaClientValidationError) {
      throw new WhatsAppInstanceInvalidPayloadError();
    }
    throw error;
  }

  const serialized = serializeStoredInstance(stored, null);
  const sideEffects: Array<() => Promise<void> | void> = [
    async () => {
      await clearInstanceArchive(tenantId, stored.id, brokerId);
    },
    async () => {
      await removeCachedSnapshot(tenantId, instanceId, brokerId);
    },
    () => {
      emitToTenant(tenantId, 'whatsapp.instances.created', {
        instance: toJsonObject(serialized),
      });
    },
    () => {
      logger.info('whatsapp.instances.create.success', {
        tenantId,
        actorId,
        instanceId: serialized.id,
        brokerId,
        status: serialized.status,
        connected: serialized.connected,
      });
    },
  ];

  return {
    serialized,
    sideEffects,
    context: {
      tenantId,
      actorId,
      instanceId: serialized.id,
      brokerId,
    },
  };
};

type InstanceCollectionOptions = {
  refresh?: boolean;
  existing?: StoredInstance[];
  snapshots?: WhatsAppBrokerInstanceSnapshot[] | null;
  fetchSnapshots?: boolean;
};

type InstanceCollectionEntry = {
  stored: StoredInstance;
  serialized: ReturnType<typeof serializeStoredInstance>;
  status: WhatsAppStatus | null;
};

type InstanceCollectionResult = {
  entries: InstanceCollectionEntry[];
  instances: NormalizedInstance[];
  rawInstances: Array<ReturnType<typeof serializeStoredInstance>>;
  map: Map<string, InstanceCollectionEntry>;
  snapshots: WhatsAppBrokerInstanceSnapshot[];
  cacheHit?: boolean;
  cacheBackend?: SnapshotCacheBackendType;
  // observability
  shouldRefresh?: boolean;
  fetchSnapshots?: boolean;
  synced?: boolean;
  storageFallback?: boolean;
  warnings?: string[];
};

const toPublicInstance = (
  value: ReturnType<typeof serializeStoredInstance>
): NormalizedInstance => {
  const { brokerId: _brokerId, ...publicInstance } = value;
  return publicInstance;
};

const buildFallbackContextFromStored = (
  stored: StoredInstance
): InstanceOperationContext => {
  const serialized = serializeStoredInstance(stored, null);
  const instance = toPublicInstance(serialized);
  const status = normalizeInstanceStatusResponse(null);
  const qr = normalizeQr({
    qr: status.qr,
    qrCode: status.qrCode,
    qrExpiresAt: status.qrExpiresAt,
    expiresAt: status.expiresAt,
  });

  return {
    stored,
    entry: null,
    brokerStatus: null,
    serialized,
    instance,
    status,
    qr,
    instances: [instance],
  };
};

export const buildFallbackInstancesFromSnapshots = (
  tenantId: string,
  snapshots: WhatsAppBrokerInstanceSnapshot[]
): NormalizedInstance[] => {
  const instances: NormalizedInstance[] = [];

  for (const snapshot of snapshots) {
    const snapshotTenantId = resolveSnapshotTenantId(snapshot);
    if (!snapshotTenantId || snapshotTenantId !== tenantId) {
      continue;
    }

    const normalized = normalizeInstance(snapshot.instance);
    const status = normalizeInstanceStatusResponse(snapshot.status);
    const fallbackMetadataBase =
      (normalized?.metadata && typeof normalized.metadata === 'object'
        ? (normalized.metadata as Record<string, unknown>)
        : {}) ?? {};

    const fallbackMetadata: Record<string, unknown> = {
      ...fallbackMetadataBase,
      fallbackSource: 'broker-snapshot',
    };

    if (snapshot.status?.raw && typeof snapshot.status.raw === 'object') {
      fallbackMetadata.lastBrokerSnapshot = snapshot.status.raw;
    }

    if (normalized) {
      instances.push({
        ...normalized,
        tenantId: normalized.tenantId ?? snapshotTenantId ?? tenantId ?? null,
        status: status.status,
        connected: status.connected,
        stats: normalized.stats ?? snapshot.status?.stats ?? undefined,
        metrics: normalized.metrics ?? snapshot.status?.metrics ?? null,
        messages: normalized.messages ?? snapshot.status?.messages ?? null,
        rate:
          normalized.rate ??
          snapshot.status?.rate ??
          snapshot.status?.rateUsage ??
          null,
        rawStatus: normalized.rawStatus ?? snapshot.status?.raw ?? null,
        metadata: fallbackMetadata,
      });
      continue;
    }

    const instanceSource = snapshot.instance ?? ({} as BrokerWhatsAppInstance);
    const instanceId =
      typeof instanceSource.id === 'string' && instanceSource.id.trim().length > 0
        ? instanceSource.id.trim()
        : null;

    if (!instanceId) {
      continue;
    }

    const agreementId = (() => {
      if (typeof (instanceSource as { agreementId?: unknown }).agreementId === 'string') {
        const value = ((instanceSource as { agreementId?: string }).agreementId ?? '').trim();
        return value.length > 0 ? value : null;
      }
      return null;
    })();

    instances.push({
      id: instanceId,
      tenantId: instanceSource.tenantId ?? snapshotTenantId ?? tenantId ?? null,
      name: instanceSource.name ?? instanceId,
      status: status.status,
      connected: status.connected,
      createdAt: instanceSource.createdAt ?? null,
      lastActivity: instanceSource.lastActivity ?? null,
      phoneNumber: instanceSource.phoneNumber ?? null,
      user: instanceSource.user ?? null,
      agreementId,
      stats: snapshot.status?.stats ?? undefined,
      metrics: snapshot.status?.metrics ?? null,
      messages: snapshot.status?.messages ?? null,
      rate: snapshot.status?.rate ?? snapshot.status?.rateUsage ?? null,
      rawStatus: snapshot.status?.raw ?? null,
      metadata: fallbackMetadata,
      lastError: null,
    });
  }

  return instances;
};

export const collectInstancesForTenant = async (
  tenantId: string,
  options: InstanceCollectionOptions = {},
  dependencies: Partial<InstanceCollectionDependencies> = {}
): Promise<InstanceCollectionResult> => {
  const deps: InstanceCollectionDependencies = {
    ...defaultInstanceCollectionDependencies,
    ...dependencies,
  };
  const { cache, metrics, repository, syncInstances, brokerClient } = deps;

  const refreshFlag = options.refresh;
  const fetchSnapshots = options.fetchSnapshots ?? false;
  const warnings: string[] = [];

  let storageDegraded = false;
  let cacheHit: boolean | undefined;
  let cacheBackend: SnapshotCacheBackendType | undefined;

  const recordCacheOutcome = (result: SnapshotCacheReadResult | null): void => {
    if (!result) return;
    cacheHit = result.hit;
    cacheBackend = result.backend;
    const outcome = result.error ? 'error' : result.hit ? 'hit' : 'miss';
    metrics.recordSnapshotCacheOutcome(tenantId, result.backend, outcome);
    if (result.error) {
      warnings.push('Cache de snapshots indisponível; executando fallback.');
    }
  };

  // Load stored instances first (DB)
  let storedInstances: StoredInstance[];
  if (options.existing) {
    storedInstances = options.existing;
  } else {
    try {
      storedInstances = await repository.findByTenant(tenantId);
    } catch (error) {
      const { isStorageError } = resolveWhatsAppStorageError(error);
      if (!isStorageError) {
        throw error;
      }

      storageDegraded = true;
      warnings.push('Storage indisponível; exibindo dados cacheados sem refresh obrigatório.');
      logWhatsAppStorageError('collectInstancesForTenant.findInstances', error, { tenantId });
      storedInstances = [];
    }
  }

  // Prefer snapshots provided by caller
  let snapshots = options.snapshots ?? null;

  // Decide if we should actually refresh (sync DB with broker)
  let shouldRefresh = false;
  if (refreshFlag === true) {
    shouldRefresh = true; // explicit force
  } else if (refreshFlag === false) {
    shouldRefresh = false;
  } else {
    // default: do NOT sync unless we have nothing stored and caller allows snapshots
    shouldRefresh = Boolean(fetchSnapshots) && storedInstances.length === 0;
  }

  if (storageDegraded) {
    const refreshBlocked = isWhatsappRefreshDisabledOnStorageDegraded() || refreshFlag !== true;
    if (refreshBlocked) {
      shouldRefresh = false;
      warnings.push('Refresh automático adiado devido à indisponibilidade do storage.');
    }
  }

  // TTL: only applies when refresh wasn't explicitly forced
  if (shouldRefresh && refreshFlag !== true) {
    const last = await cache.getLastSyncAt(tenantId);
    if (last && Date.now() - last.getTime() < SYNC_TTL_MS) {
      shouldRefresh = false;
    }
  }

  const runCacheWrite = async (
    name: 'setLastSyncAt' | 'setCachedSnapshots',
    run: () => Promise<void>
  ): Promise<{ name: 'setLastSyncAt' | 'setCachedSnapshots'; durationMs: number }> => {
    const startedAt = Date.now();

    try {
      await withTimeout(
        run(),
        CACHE_WRITE_TIMEOUT_MS,
        () =>
          Object.assign(
            new Error(`cache write ${name} timed out after ${CACHE_WRITE_TIMEOUT_MS}ms`),
            { code: 'timeout' }
          )
      );
      const durationMs = Date.now() - startedAt;
      metrics.recordRefreshStepDuration(tenantId, name, durationMs, 'success');
      return { name, durationMs };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      metrics.recordRefreshStepDuration(tenantId, name, durationMs, 'failure');
      const errorCode =
        (error as { code?: string }).code ??
        (error as { name?: string }).name ??
        (error instanceof Error ? error.name : 'unknown');
      metrics.recordRefreshStepFailure(tenantId, name, errorCode);
      throw { name, error, durationMs };
    }
  };

  let synced = false;

  if (shouldRefresh) {
    await enqueueTenantRefresh(tenantId, async () => {
      for (let attempt = 0; attempt < MAX_SYNC_ATTEMPTS; attempt += 1) {
        await cache.invalidateCachedSnapshots(tenantId);
        try {
          metrics.incrementHttpCounter();
          const syncResult = await syncInstances(
            tenantId,
            storedInstances,
            snapshots ?? undefined
          );
          storedInstances = syncResult.instances;
          snapshots = syncResult.snapshots;
          if (!storageDegraded) {
            const cacheWrites = [
              {
                name: 'setLastSyncAt' as const,
                run: async () => {
                  await cache.setLastSyncAt(tenantId, new Date());
                },
              },
              ...(snapshots && snapshots.length > 0
                ? [
                    {
                      name: 'setCachedSnapshots' as const,
                      run: async () => {
                        const cacheWrite = await cache.setCachedSnapshots(
                          tenantId,
                          snapshots as WhatsAppBrokerInstanceSnapshot[],
                          30
                        );
                        cacheBackend ??= cacheWrite.backend;
                        cacheHit = cacheHit ?? false;
                        if (cacheWrite.error) {
                          warnings.push('Cache de snapshots não pôde ser preenchido após refresh.');
                        }
                      },
                    },
                  ]
                : []),
            ];

            const cacheWriteResults = await Promise.allSettled(
              cacheWrites.map(async ({ name, run }) => runCacheWrite(name, run))
            );

            for (const result of cacheWriteResults) {
              if (result.status === 'fulfilled') {
                logger.debug('whatsapp.instances.cache.write.success', {
                  tenantId,
                  operation: result.value.name,
                  durationMs: result.value.durationMs,
                  timeoutMs: CACHE_WRITE_TIMEOUT_MS,
                });
              } else {
                logger.warn('whatsapp.instances.cache.write.failure', {
                  tenantId,
                  operation: result.reason.name,
                  durationMs: result.reason.durationMs,
                  timeoutMs: CACHE_WRITE_TIMEOUT_MS,
                  error: describeErrorForLog(result.reason.error),
                });
              }
            }
          }
          metrics.recordRefreshOutcome(tenantId, 'success');
          synced = true;
          return;
        } catch (error) {
          const shouldRetryAfterUniqueConstraint =
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002' &&
            attempt < MAX_SYNC_ATTEMPTS - 1;

          if (shouldRetryAfterUniqueConstraint) {
            logger.warn('whatsapp.instances.sync.retryAfterP2002', {
              tenantId,
              attempt,
              error: describeErrorForLog(error),
            });
            await cache.invalidateCachedSnapshots(tenantId);
            snapshots = await brokerClient.listInstances(tenantId);
            storedInstances = await repository.findByTenant(tenantId);
            continue;
          }

          const errorCode =
            (error as { code?: string }).code ??
            (error as { name?: string }).name ??
            (error instanceof Error ? error.name : null);
          metrics.recordRefreshOutcome(tenantId, 'failure', errorCode);
          if (error instanceof WhatsAppBrokerNotConfiguredError) {
            if (options.refresh) {
              throw error;
            }
            logger.info('whatsapp.instances.sync.brokerNotConfigured', { tenantId });
            snapshots = [];
            return;
          }
          throw error;
        }
      }
    });
  } else if (fetchSnapshots) {
    // Snapshot mode (read-only): use cache first, then broker, and cache the result
    if (!snapshots) {
      const cached = await cache.getCachedSnapshots(tenantId);
      recordCacheOutcome(cached);
      snapshots = cached.snapshots;
    }
    if (!snapshots) {
      try {
        metrics.incrementHttpCounter();
        snapshots = await brokerClient.listInstances(tenantId);
        if (snapshots && snapshots.length > 0) {
          try {
            const cacheWrite = await runCacheWrite('setCachedSnapshots', async () => {
              const result = await cache.setCachedSnapshots(
                tenantId,
                snapshots as WhatsAppBrokerInstanceSnapshot[],
                30,
              );
              cacheBackend ??= result.backend;
              cacheHit = cacheHit ?? false;
              if (result.error) {
                warnings.push('Cache de snapshots não pôde ser preenchido após leitura direta do broker.');
              }
            });

            logger.debug('whatsapp.instances.cache.write.success', {
              tenantId,
              operation: cacheWrite.name,
              durationMs: cacheWrite.durationMs,
              timeoutMs: CACHE_WRITE_TIMEOUT_MS,
            });
          } catch (error) {
            logger.warn('whatsapp.instances.cache.write.failure', {
              tenantId,
              operation: 'setCachedSnapshots',
              error: describeErrorForLog(error),
              timeoutMs: CACHE_WRITE_TIMEOUT_MS,
            });
          }
        }
      } catch (error) {
        if (error instanceof WhatsAppBrokerNotConfiguredError) {
          snapshots = [];
        } else {
          throw error;
        }
      }
    }
  } else if (!snapshots) {
    snapshots = [];
  }

  if (storageDegraded && !snapshots) {
    const cached = await cache.getCachedSnapshots(tenantId);
    recordCacheOutcome(cached);
    snapshots = cached.snapshots;
  }

  // Index snapshots by id for quick lookups
  const snapshotMap = new Map<string, WhatsAppBrokerInstanceSnapshot>();
  if (snapshots) {
    for (const snapshot of snapshots) {
      const rawId = snapshot.instance?.id;
      const normalizedId = typeof rawId === 'string' ? rawId.trim() : '';
      if (normalizedId && !snapshotMap.has(normalizedId)) {
        snapshotMap.set(normalizedId, snapshot);
      }
    }
  }

  const entries: InstanceCollectionEntry[] = [];

  if (!storedInstances.length && snapshots?.length) {
    const fallbackInstances = buildFallbackInstancesFromSnapshots(tenantId, snapshots);
    return {
      entries,
      instances: fallbackInstances,
      rawInstances: [],
      map: new Map(),
      snapshots: snapshots ?? [],
      cacheHit,
      cacheBackend,
      shouldRefresh,
      fetchSnapshots,
      synced,
      storageFallback: true,
      warnings,
    } satisfies InstanceCollectionResult;
  }

  for (const stored of storedInstances) {
    const snapshot = snapshotMap.get(stored.id) ??
      (stored.brokerId ? snapshotMap.get(stored.brokerId) : undefined);
    const brokerStatus = snapshot?.status ?? null;
    const serialized = serializeStoredInstance(stored, brokerStatus);

    // Keep E.164 normalized phone in DB when we discover a better one
    if (serialized.phoneNumber && serialized.phoneNumber !== stored.phoneNumber) {
      await repository.updatePhoneNumber(stored.id, serialized.phoneNumber);
      stored.phoneNumber = serialized.phoneNumber;
    }

    entries.push({ stored, serialized, status: brokerStatus });
  }

  const map = new Map<string, InstanceCollectionEntry>();
  for (const entry of entries) {
    map.set(entry.stored.id, entry);
    if (entry.stored.brokerId && entry.stored.brokerId !== entry.stored.id) {
      map.set(entry.stored.brokerId, entry);
    }
  }

  const instances = entries.map(({ serialized }) => toPublicInstance(serialized));

  const result: InstanceCollectionResult = {
    entries,
    instances,
    rawInstances: entries.map(({ serialized }) => serialized),
    map,
    snapshots: snapshots ?? [],
    cacheHit,
    cacheBackend,
    shouldRefresh,
    fetchSnapshots,
    synced,
    storageFallback: storageDegraded,
    warnings,
  };

  return result;
};

export type InstanceOperationContext = {
  stored: StoredInstance;
  entry: InstanceCollectionEntry | null;
  brokerStatus: WhatsAppStatus | null;
  serialized: ReturnType<typeof serializeStoredInstance>;
  instance: NormalizedInstance;
  status: ReturnType<typeof normalizeInstanceStatusResponse>;
  qr: NormalizedQr;
  instances: NormalizedInstance[];
};

export const resolveInstanceOperationContext = async (
  tenantId: string,
  instance: StoredInstance,
  options: { refresh?: boolean; fetchSnapshots?: boolean } = {}
): Promise<InstanceOperationContext> => {
  const collection = await collectInstancesForTenant(tenantId, {
    ...(typeof options.refresh === 'boolean' ? { refresh: options.refresh } : {}),
    ...(typeof options.fetchSnapshots === 'boolean' ? { fetchSnapshots: options.fetchSnapshots } : {}),
  });

  const entry =
    collection.map.get(instance.id) ??
    (instance.brokerId ? collection.map.get(instance.brokerId) : undefined) ??
    null;

  const stored = entry?.stored ?? instance;
  const brokerStatus = entry?.status ?? null;
  const serialized = entry?.serialized ?? serializeStoredInstance(stored, brokerStatus);
  const publicInstance = toPublicInstance(serialized);
  const status = normalizeInstanceStatusResponse(brokerStatus);
  const qr = normalizeQr({
    qr: status.qr,
    qrCode: status.qrCode,
    qrExpiresAt: status.qrExpiresAt,
    expiresAt: status.expiresAt,
  });

  const existingIndex = collection.instances.findIndex((item) => item.id === publicInstance.id);
  const instances =
    existingIndex >= 0
      ? collection.instances.map((item, index) => (index === existingIndex ? publicInstance : item))
      : [...collection.instances, publicInstance];

  return {
    stored,
    entry,
    brokerStatus,
    serialized,
    instance: publicInstance,
    status,
    qr,
    instances,
  };
};

type InstanceStatusResponsePayload = {
  connected: boolean;
  status: ReturnType<typeof normalizeInstanceStatusResponse>;
  qr: NormalizedQr;
  instance: NormalizedInstance;
  instances: NormalizedInstance[];
  brokerStatus: WhatsAppStatus | null;
};

export const buildInstanceStatusPayload = (
  context: InstanceOperationContext,
  overrideQr?: NormalizedQr
): InstanceStatusResponsePayload => {
  const qr = overrideQr ?? context.qr;
  const status = {
    ...context.status,
    qr: qr.qr,
    qrCode: qr.qrCode,
    qrExpiresAt: qr.qrExpiresAt,
    expiresAt: qr.expiresAt,
    qrAvailable: qr.available,
    qrReason: qr.reason,
  };

  return {
    connected: status.connected,
    status,
    qr,
    instance: context.instance,
    instances: context.instances,
    brokerStatus: context.brokerStatus,
  };
};

export const fetchStatusWithBrokerQr = async (
  tenantId: string,
  stored: StoredInstance,
  options: { refresh?: boolean; fetchSnapshots?: boolean } = {}
): Promise<{ context: InstanceOperationContext; qr: NormalizedQr }> => {
  const { refresh, fetchSnapshots } = options;
  const contextOptions: { refresh?: boolean; fetchSnapshots?: boolean } = {};
  if (typeof refresh === 'boolean') {
    contextOptions.refresh = refresh;
  }
  if (typeof fetchSnapshots === 'boolean') {
    contextOptions.fetchSnapshots = fetchSnapshots;
  }

  let context: InstanceOperationContext | null = null;
  try {
    context = await resolveInstanceOperationContext(tenantId, stored, contextOptions);
  } catch (error) {
    const storageErrorLogged = logWhatsAppStorageError('instances.context', error, {
      tenantId,
      instanceId: stored.id,
      refresh,
      fetchSnapshots,
    });

    if (!storageErrorLogged) {
      throw error;
    }

    context = buildFallbackContextFromStored(stored);
  }

  const safeContext = context ?? buildFallbackContextFromStored(stored);

  try {
    try {
      safeIncrementHttpCounter();
    } catch {
      // metrics are best effort
    }

    const brokerQr = await whatsappBrokerClient.getQrCode(stored.brokerId ?? stored.id, {
      instanceId: stored.id,
    });
    const qr = normalizeQr(brokerQr);

    recordQrOutcome(tenantId, stored.id, 'success');

    return { context, qr };
    return { context: safeContext, qr };
  } catch (error) {
    const errorCode =
      (error as { code?: string }).code ??
      (error as { name?: string }).name ??
      (error instanceof Error ? error.name : null);
    recordQrOutcome(tenantId, stored.id, 'failure', errorCode);
    // ensure context is returned alongside broker errors when needed
    (error as { __context__?: InstanceOperationContext }).__context__ = safeContext;
    throw error;
  }
};

type DisconnectStoredInstanceResult =
  | { outcome: 'success'; context: InstanceOperationContext }
  | {
      outcome: 'retry';
      retry: { scheduledAt: string; status: number; requestId: string | null };
    };

export const disconnectStoredInstance = async (
  tenantId: string,
  stored: StoredInstance,
  actorId: string,
  options: { wipe?: boolean } = {}
): Promise<DisconnectStoredInstanceResult> => {
  const disconnectOptions = options.wipe === undefined ? undefined : { wipe: options.wipe };
  let cachedContext: InstanceOperationContext | null = null;

  try {
    await whatsappBrokerClient.disconnectInstance(stored.brokerId, {
      ...(disconnectOptions ?? {}),
      instanceId: stored.id,
    });
  } catch (error) {
    if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
      const brokerError = error as WhatsAppBrokerError;
      const brokerStatus = readBrokerErrorStatus(brokerError);

      if (
        isBrokerAlreadyDisconnectedError(brokerError) ||
        brokerStatus === 409 ||
        brokerStatus === 410
      ) {
        logger.info('whatsapp.instances.disconnect.alreadyStored', {
          tenantId,
          instanceId: stored.id,
          status: brokerStatus,
          code: brokerError.code,
          requestId: brokerError.requestId,
        });
        cachedContext = await resolveInstanceOperationContext(tenantId, stored, { refresh: true });
      } else if (brokerStatus !== null && brokerStatus >= 500) {
        const scheduledAt = new Date().toISOString();

        logger.warn('whatsapp.instances.disconnect.retryScheduled', {
          tenantId,
          instanceId: stored.id,
          brokerId: stored.brokerId,
          status: brokerStatus,
          code: brokerError.code,
          requestId: brokerError.requestId,
          wipe: Boolean(options.wipe),
        });

        await scheduleWhatsAppDisconnectRetry(tenantId, {
          instanceId: stored.id,
          status: brokerStatus,
          requestId: brokerError.requestId ?? null,
          wipe: Boolean(options.wipe),
          requestedAt: scheduledAt,
        });

        return {
          outcome: 'retry',
          retry: {
            scheduledAt,
            status: brokerStatus,
            requestId: brokerError.requestId ?? null,
          },
        };
      } else {
        throw brokerError;
      }
    } else {
      throw error;
    }
  }

  const context = cachedContext ?? (await resolveInstanceOperationContext(tenantId, stored, { refresh: true }));

  const historyEntry = buildHistoryEntry('disconnect-instance', actorId, {
    status: context.status.status,
    connected: context.status.connected,
    wipe: Boolean(options.wipe),
  });

  const metadataWithHistory = appendInstanceHistory(
    context.stored.metadata as InstanceMetadata,
    historyEntry
  );
  const metadataWithoutError = withInstanceLastError(metadataWithHistory, null);

  const derivedStatus = context.brokerStatus
    ? mapBrokerStatusToDbStatus(context.brokerStatus)
    : mapBrokerInstanceStatusToDbStatus(context.status.status);

  const lastSeenAt = context.status.connected ? context.stored.lastSeenAt : new Date();

  await prisma.whatsAppInstance.update({
    where: { id: context.stored.id },
    data: {
      status: derivedStatus,
      connected: context.status.connected,
      metadata: metadataWithoutError,
      lastSeenAt,
    },
  });

  return { outcome: 'success', context };
};

type DeleteStoredInstanceResult = {
  deletedAt: string;
  instances: NormalizedInstance[];
  context: InstanceOperationContext;
};

export const deleteStoredInstance = async (
  tenantId: string,
  stored: StoredInstance,
  actorId: string
): Promise<DeleteStoredInstanceResult> => {
  const context = await resolveInstanceOperationContext(tenantId, stored, {
    refresh: false,
    fetchSnapshots: true,
  });

  const deletedAt = new Date().toISOString();

  await archiveInstanceSnapshot(prisma, {
    tenantId,
    stored,
    actorId,
    deletedAt,
    serialized: context.serialized,
    status: context.status,
    qr: context.qr,
    brokerStatus: context.brokerStatus,
    instances: context.instances,
  });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.campaign.updateMany({
        where: { tenantId, whatsappInstanceId: stored.id },
        data: { whatsappInstanceId: null },
      });

      await tx.whatsAppSession.deleteMany({ where: { instanceId: stored.id } });
      await tx.whatsAppInstance.delete({ where: { id: stored.id } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      logger.warn('whatsapp.instances.delete.notFound', { tenantId, instanceId: stored.id });
    } else {
      throw error;
    }
  }

  try {
    await clearWhatsAppDisconnectRetry(tenantId, stored.id);
  } catch (error) {
    if (!logWhatsAppStorageError('deleteStoredInstance.clearRetry', error, { tenantId, instanceId: stored.id })) {
      throw error;
    }
  }

  invalidateCampaignCache(tenantId, stored.id);
  await removeCachedSnapshot(tenantId, stored.id, stored.brokerId);

  const collection = await collectInstancesForTenant(tenantId, {
    refresh: false,
    fetchSnapshots: false,
  });

  const sanitizedInstances = collection.instances.filter(
    (instance) => instance.id !== stored.id && instance.id !== stored.brokerId
  );

  return {
    deletedAt,
    instances: sanitizedInstances,
    context,
  };
};

const parseNumber = (input: unknown): number | null => {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input;
  }

  if (typeof input === 'string' && input.trim().length > 0) {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const parseRateLimit = (value: unknown): BrokerRateLimit | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as Record<string, unknown>;
  const limit = parseNumber(source.limit);
  const remaining = parseNumber(source.remaining);
  const resetCandidate = source.resetAt ?? source.reset ?? source.reset_at;
  let resetAt: string | null = null;

  if (typeof resetCandidate === 'string') {
    resetAt = resetCandidate;
  } else {
    const parsed = parseNumber(resetCandidate);
    resetAt = parsed !== null ? new Date(parsed).toISOString() : null;
  }

  if (limit === null && remaining === null && resetAt === null) {
    return null;
  }

  return { limit, remaining, resetAt };
};

const normalizeBaileysAck = (value: unknown): number | string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
};

const isBaileysAckFailure = (
  ack: number | string | null,
  status: unknown
): boolean => {
  if (typeof ack === 'number') {
    return ack < 0;
  }

  if (typeof ack === 'string') {
    const normalized = ack.trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    return normalized.includes('fail') || normalized.includes('erro');
  }

  if (typeof status === 'string') {
    const normalizedStatus = status.trim().toLowerCase();
    return normalizedStatus.includes('fail') || normalizedStatus.includes('erro');
  }

  return false;
};

const readMessageIdFromBrokerPayload = (
  payload: Record<string, unknown> | null | undefined
): string | null => {
  if (!payload) {
    return null;
  }

  const candidates = ['id', 'messageId', 'externalId'];
  for (const key of candidates) {
    const value = payload[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
};

const normalizeSessionStatus = (status: BrokerSessionStatus | null | undefined) => {
  const rawStatus = typeof status?.status === 'string' ? status.status.toLowerCase() : undefined;
  const connected = Boolean(status?.connected ?? (rawStatus === 'connected'));
  const normalizedStatus = ((): 'connected' | 'connecting' | 'disconnected' | 'qr_required' => {
    switch (rawStatus) {
      case 'connected':
      case 'connecting':
      case 'qr_required':
      case 'disconnected':
        return rawStatus;
      default:
        return connected ? 'connected' : 'disconnected';
    }
  })();

  return {
    status: normalizedStatus,
    connected,
    qrCode: typeof status?.qrCode === 'string' ? status.qrCode : null,
    qrExpiresAt: typeof status?.qrExpiresAt === 'string' ? status.qrExpiresAt : null,
    rate: parseRateLimit(status?.rate ?? null),
  };
};
