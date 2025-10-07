import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { Prisma, WhatsAppInstanceStatus } from '@prisma/client';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  whatsappBrokerClient,
  WhatsAppBrokerNotConfiguredError,
  WhatsAppBrokerError,
  type WhatsAppStatus,
  type WhatsAppBrokerInstanceSnapshot,
  type WhatsAppInstance,
} from '../services/whatsapp-broker-client';
import { emitToTenant } from '../lib/socket-registry';
import { prisma } from '../lib/prisma';
import { logger } from '../config/logger';
import { assertValidSlug, toSlug } from '../lib/slug';

const respondWhatsAppNotConfigured = (res: Response, error: unknown): boolean => {
  if (error instanceof WhatsAppBrokerNotConfiguredError) {
    res.status(503).json({
      success: false,
      error: {
        code: 'WHATSAPP_NOT_CONFIGURED',
        message: error.message,
      },
    });
    return true;
  }

  return false;
};

const PRISMA_STORAGE_ERROR_CODES = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1003',
  'P1008',
  'P1010',
  'P2010',
  'P2021',
  'P2022',
  'P2023',
  'P2024',
  'P2025',
]);

const hasErrorName = (error: unknown, expected: string): boolean => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === expected
  );
};

const readPrismaErrorCode = (error: unknown): string | null => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }

  return null;
};

const respondWhatsAppStorageUnavailable = (res: Response, error: unknown): boolean => {
  const prismaCode = readPrismaErrorCode(error);

  if (prismaCode && PRISMA_STORAGE_ERROR_CODES.has(prismaCode)) {
    res.status(503).json({
      success: false,
      error: {
        code: 'WHATSAPP_STORAGE_UNAVAILABLE',
        message:
          'Serviço de armazenamento das instâncias WhatsApp indisponível. Verifique a conexão com o banco ou execute as migrações pendentes.',
        details: { prismaCode },
      },
    });
    return true;
  }

  if (
    hasErrorName(error, 'PrismaClientInitializationError') ||
    hasErrorName(error, 'PrismaClientRustPanicError')
  ) {
    res.status(503).json({
      success: false,
      error: {
        code: 'WHATSAPP_STORAGE_UNAVAILABLE',
        message:
          'Serviço de armazenamento das instâncias WhatsApp indisponível. Verifique a conexão com o banco ou execute as migrações pendentes.',
      },
    });
    return true;
  }

  return false;
};

const handleWhatsAppIntegrationError = (res: Response, error: unknown): boolean => {
  if (respondWhatsAppNotConfigured(res, error)) {
    return true;
  }

  if (respondWhatsAppStorageUnavailable(res, error)) {
    return true;
  }

  return false;
};

const resolveDefaultInstanceId = (): string =>
  (process.env.LEADENGINE_INSTANCE_ID || '').trim() || 'leadengine';

const looksLikeWhatsAppJid = (value: string): boolean =>
  typeof value === 'string' && value.toLowerCase().endsWith('@s.whatsapp.net');

const INVALID_INSTANCE_ID_MESSAGE = 'Identificador de instância inválido.';

const instanceIdParamValidator = () =>
  param('id')
    .custom((value, { req }) => {
      if (typeof value !== 'string') {
        throw new Error(INVALID_INSTANCE_ID_MESSAGE);
      }

      try {
        const decoded = decodeURIComponent(value);
        req.params.id = decoded;
        return true;
      } catch {
        throw new Error(INVALID_INSTANCE_ID_MESSAGE);
      }
    })
    .withMessage(INVALID_INSTANCE_ID_MESSAGE)
    .bail()
    .trim()
    .isLength({ min: 1 })
    .withMessage(INVALID_INSTANCE_ID_MESSAGE);

const BROKER_NOT_FOUND_CODES = new Set([
  'SESSION_NOT_FOUND',
  'BROKER_SESSION_NOT_FOUND',
  'INSTANCE_NOT_FOUND',
]);

const readBrokerErrorStatus = (error: unknown): number | null => {
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    return (error as { status: number }).status;
  }

  return null;
};

const readBrokerErrorCode = (error: unknown): string | null => {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    const normalized = ((error as { code: string }).code || '').trim();
    return normalized ? normalized.toUpperCase() : null;
  }

  return null;
};

const isBrokerMissingInstanceError = (error: unknown): boolean => {
  const status = readBrokerErrorStatus(error);
  const code = readBrokerErrorCode(error);
  return status === 404 || (code ? BROKER_NOT_FOUND_CODES.has(code) : false);
};

const router: Router = Router();

// ============================================================================
// WhatsApp Routes
// ============================================================================

type BrokerRateLimit = {
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
};

type BrokerSessionStatus = {
  status?: string;
  connected?: boolean;
  qrCode?: string;
  qrExpiresAt?: string;
  rate?: unknown;
};

type BrokerInstance = {
  id?: string;
  tenantId?: string;
  name?: string;
  status?: string;
  connected?: boolean;
  createdAt?: string;
  lastActivity?: string | null;
  phoneNumber?: string | null;
  user?: string | null;
  stats?: unknown;
  metadata?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
  info?: Record<string, unknown> | null;
};

type NormalizedInstance = {
  id: string;
  tenantId: string | null;
  name: string | null;
  status: 'connected' | 'connecting' | 'disconnected' | 'qr_required' | 'error' | 'pending' | 'failed';
  connected: boolean;
  createdAt: string | null;
  lastActivity: string | null;
  phoneNumber: string | null;
  user: string | null;
  agreementId: string | null;
  stats?: unknown;
  metrics?: Record<string, unknown> | null;
  messages?: Record<string, unknown> | null;
  rate?: Record<string, unknown> | null;
  rawStatus?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  lastError?: InstanceLastError | null;
};

type InstanceLastError = {
  code?: string | null;
  message?: string | null;
  requestId?: string | null;
  at?: string | null;
};

const compactRecord = (input: Record<string, unknown>): Record<string, unknown> => {
  const entries = Object.entries(input).filter(([, value]) => {
    if (value === undefined || value === null) {
      return false;
    }
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    return true;
  });

  return Object.fromEntries(entries);
};

const normalizeInstanceStatus = (
  status: unknown,
  connectedValue?: unknown
): { status: NormalizedInstance['status']; connected: boolean } => {
  const rawStatus = typeof status === 'string' ? status.toLowerCase() : undefined;
  const connected = Boolean(connectedValue ?? (rawStatus === 'connected'));

  const normalizedStatus: NormalizedInstance['status'] = (() => {
    switch (rawStatus) {
      case 'connected':
      case 'connecting':
      case 'qr_required':
      case 'disconnected':
      case 'pending':
      case 'failed':
        return rawStatus;
      case 'error':
        return 'error';
      default:
        return connected ? 'connected' : 'disconnected';
    }
  })();

  return { status: normalizedStatus, connected };
};

const pickString = (...values: unknown[]): string | null => {
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

const normalizeInstance = (instance: unknown): NormalizedInstance | null => {
  if (!instance || typeof instance !== 'object') {
    return null;
  }

  const source = instance as BrokerInstance & Record<string, unknown>;

  const metadataSources = [
    source.metadata,
    source.profile,
    source.details,
    source.info,
  ].filter((value): value is Record<string, unknown> => Boolean(value && typeof value === 'object'));

  const metadata = metadataSources.reduce<Record<string, unknown>>((acc, entry) => {
    return { ...acc, ...entry };
  }, {});

  const idCandidate = [
    source.id,
    source.instanceId,
    source.sessionId,
    source._id,
    metadata.id,
    metadata.instanceId,
    metadata.sessionId,
    metadata._id,
  ]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find((value) => value.length > 0);

  if (!idCandidate) {
    return null;
  }

  const { status, connected } = normalizeInstanceStatus(
    source.status ?? metadata.status ?? metadata.state,
    source.connected ?? metadata.connected ?? metadata.isConnected ?? metadata.connected_at
  );

  return {
    id: idCandidate,
    tenantId:
      pickString(source.tenantId, metadata.tenantId, metadata.tenant_id) ?? null,
    name:
      pickString(
        source.name,
        metadata.name,
        metadata.displayName,
        metadata.sessionName,
        metadata.instanceName,
        metadata.profileName
      ) ?? null,
    status,
    connected,
    createdAt:
      pickString(source.createdAt, source.created_at, metadata.createdAt, metadata.created_at) ??
      null,
    lastActivity:
      pickString(
        source.lastActivity,
        metadata.lastActivity,
        metadata.last_activity,
        metadata.lastActiveAt,
        metadata.last_active_at,
        metadata.lastSeen,
        metadata.last_seen
      ) ?? null,
    phoneNumber:
      pickString(
        source.phoneNumber,
        metadata.phoneNumber,
        metadata.phone_number,
        metadata.msisdn,
        metadata.phone
      ) ?? null,
    user: pickString(source.user, metadata.user, metadata.userName, metadata.username, metadata.operator) ?? null,
    agreementId: extractAgreementIdFromMetadata(metadata) ?? null,
    stats:
      (typeof source.stats === 'object' && source.stats !== null
        ? source.stats
        : typeof metadata.stats === 'object' && metadata.stats !== null
          ? metadata.stats
          : undefined),
    metadata,
    lastError: readLastErrorFromMetadata(metadata),
  };
};

const ensureUniqueInstanceId = async (tenantId: string, base: string): Promise<string> => {
  const normalizedBase = toSlug(base, 'instance');

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const candidate = attempt === 0 ? normalizedBase : `${normalizedBase}-${attempt + 1}`;
    const existing = await prisma.whatsAppInstance.findFirst({
      where: {
        tenantId,
        id: candidate,
      },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new Error('Unable to allocate unique WhatsApp instance id');
};

type StoredInstance = NonNullable<Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>>>;

type InstanceMetadata = Record<string, unknown> | null | undefined;

type PrismaTransactionClient = Prisma.TransactionClient;

const buildHistoryEntry = (action: string, actorId: string, details?: Record<string, unknown>) => ({
  action,
  by: actorId,
  at: new Date().toISOString(),
  ...(details ?? {}),
});

const extractAgreementIdFromMetadata = (metadata: InstanceMetadata): string | null => {
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
    source.agreement
  );

  if (direct) {
    return direct;
  }

  const agreementObject = source.agreement && typeof source.agreement === 'object'
    ? (source.agreement as Record<string, unknown>)
    : null;

  if (agreementObject) {
    const nested = pickString(
      agreementObject.id,
      agreementObject.agreementId,
      agreementObject.slug,
      agreementObject.code
    );
    if (nested) {
      return nested;
    }
  }

  return null;
};

const readLastErrorFromMetadata = (metadata: InstanceMetadata): InstanceLastError | null => {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const source = metadata as Record<string, unknown>;
  const payload = source.lastError && typeof source.lastError === 'object'
    ? (source.lastError as Record<string, unknown>)
    : null;

  if (!payload) {
    return null;
  }

  const message = pickString(payload.message, payload.error, payload.description);
  const code = pickString(payload.code, payload.errorCode, payload.error_code);
  const requestId = pickString(
    payload.requestId,
    payload.request_id,
    payload.traceId,
    payload.trace_id
  );
  const at = pickString(payload.at, payload.timestamp, payload.attemptedAt, payload.attempted_at);

  if (!message && !code && !requestId && !at) {
    return null;
  }

  return {
    ...(code ? { code } : {}),
    ...(message ? { message } : {}),
    ...(requestId ? { requestId } : {}),
    ...(at ? { at } : {}),
  };
};

const withInstanceLastError = (
  metadata: InstanceMetadata,
  error: InstanceLastError | null
): Prisma.JsonObject => {
  const base: Record<string, unknown> =
    metadata && typeof metadata === 'object' ? { ...(metadata as Record<string, unknown>) } : {};

  if (error && (error.code || error.message || error.requestId)) {
    const normalized = compactRecord({
      code: error.code ?? undefined,
      message: error.message ?? undefined,
      requestId: error.requestId ?? undefined,
      at: error.at ?? new Date().toISOString(),
    });
    base.lastError = normalized;
  } else {
    delete base.lastError;
  }

  return base as Prisma.JsonObject;
};

const appendInstanceHistory = (metadata: InstanceMetadata, entry: ReturnType<typeof buildHistoryEntry>): Prisma.JsonObject => {
  const base: Record<string, unknown> = metadata && typeof metadata === 'object' ? { ...(metadata as Record<string, unknown>) } : {};
  const history = Array.isArray(base.history) ? [...(base.history as unknown[])] : [];
  history.push(entry);
  base.history = history.slice(-50);
  return base as Prisma.JsonObject;
};

const mapDbStatusToNormalized = (
  status: WhatsAppInstanceStatus | null | undefined
): NormalizedInstance['status'] => {
  switch (status) {
    case 'connected':
      return 'connected';
    case 'connecting':
      return 'connecting';
    case 'pending':
      return 'pending';
    case 'failed':
      return 'failed';
    case 'error':
      return 'error';
    default:
      return 'disconnected';
  }
};

const mapBrokerStatusToDbStatus = (
  status: WhatsAppStatus | null | undefined
): WhatsAppInstanceStatus => {
  if (!status) {
    return 'disconnected';
  }

  switch (status.status) {
    case 'connected':
      return 'connected';
    case 'connecting':
      return 'connecting';
    case 'qr_required':
      return 'connecting';
    case 'disconnected':
      return 'disconnected';
    case 'pending':
      return 'pending';
    case 'failed':
      return 'failed';
    default:
      return 'error';
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  return isRecord(value) ? (value as Record<string, unknown>) : null;
};

const mergeRecords = (
  ...sources: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> | undefined => {
  const merged: Record<string, unknown> = {};
  let hasValue = false;

  for (const source of sources) {
    if (!isRecord(source)) {
      continue;
    }

    for (const [key, value] of Object.entries(source)) {
      merged[key] = value;
      hasValue = true;
    }
  }

  return hasValue ? merged : undefined;
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

const collectNumericFromSources = (sources: unknown[], keywords: string[]): number | null => {
  const normalizedKeywords = keywords.map(normalizeKeyName).filter((entry) => entry.length > 0);

  const inspect = (
    root: unknown,
    visited: Set<unknown>,
    override?: string[]
  ): number | null => {
    if (!root || typeof root !== 'object') {
      return null;
    }

    const targetKeywords = override ?? normalizedKeywords;
    const queue: unknown[] = Array.isArray(root) ? [...root] : [root];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || typeof current !== 'object') {
        continue;
      }

      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      if (Array.isArray(current)) {
        for (const entry of current) {
          queue.push(entry);
        }
        continue;
      }

      for (const [key, value] of Object.entries(current)) {
        const normalizedKey = normalizeKeyName(key);
        const hasMatch = targetKeywords.some((keyword) => normalizedKey.includes(keyword));

        if (hasMatch) {
          const numeric = toNumeric(value);
          if (numeric !== null) {
            return numeric;
          }

          if (value && typeof value === 'object') {
            const nested = inspect(value, visited, ['total', 'value', 'count', 'quantity'].map(normalizeKeyName));
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

const locateStatusCountsCandidate = (sources: unknown[]): unknown => {
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

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') {
      continue;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

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
          return value;
        }
      }
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return undefined;
};

const normalizeStatusCountsData = (rawCounts: unknown): Record<string, number> | null => {
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

const locateRateSourceCandidate = (sources: unknown[]): Record<string, unknown> | null => {
  const keywords = ['rateusage', 'ratelimit', 'ratelimiter', 'rate', 'throttle', 'quota'];
  const normalizedKeywords = keywords.map(normalizeKeyName);
  const visited = new Set<unknown>();
  const queue: unknown[] = sources.filter((item) => item !== undefined && item !== null);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') {
      continue;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

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

const normalizeRateUsageData = (rawRate: unknown): {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
} | null => {
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
  const percentageValue = limitValue > 0 ? Math.min(100, Math.round((usedValue / limitValue) * 100)) : usedValue > 0 ? 100 : 0;

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

const normalizePhoneCandidate = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const digits = trimmed.replace(/\D+/g, '');
  if (digits.length >= 8) {
    return trimmed;
  }

  return null;
};

const extractPhoneFromJidString = (value: string | null | undefined): string | null => {
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

const readRecordString = (
  source: Record<string, unknown> | null | undefined,
  key: string
): string | null => {
  if (!source) {
    return null;
  }
  const value = source[key];
  return typeof value === 'string' ? value : null;
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

  const queue: Array<Record<string, unknown>> = [value];
  const visited = new Set<Record<string, unknown>>();

  while (queue.length > 0) {
    const current = queue.shift()!;
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
        queue.push(entry);
      }
    }
  }

  return null;
};

const findPhoneNumberInObject = (value: unknown): string | null => {
  if (!isRecord(value) && !Array.isArray(value)) {
    return null;
  }

  const queue: Array<Record<string, unknown>> = [];
  const visited = new Set<unknown>();

  const enqueue = (entry: unknown): void => {
    if (visited.has(entry)) {
      return;
    }

    if (Array.isArray(entry)) {
      visited.add(entry);
      entry.forEach(enqueue);
      return;
    }

    if (isRecord(entry)) {
      visited.add(entry);
      queue.push(entry);
    }
  };

  enqueue(value);

  const preferredKeys = ['phoneNumber', 'phone_number', 'msisdn'];
  const fallbackKeys = ['whatsappNumber', 'whatsapp_number', 'jid', 'number', 'address'];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const key of preferredKeys) {
      const candidate = normalizePhoneCandidate(current[key]);
      if (candidate) {
        return candidate;
      }
    }

    for (const key of fallbackKeys) {
      const candidate = normalizePhoneCandidate(current[key]);
      if (candidate) {
        return candidate;
      }
    }

    for (const entry of Object.values(current)) {
      enqueue(entry);
    }
  }

  return null;
};

const resolvePhoneNumber = (
  instance: StoredInstance,
  metadata: Record<string, unknown>,
  brokerStatus?: WhatsAppStatus | null
): string | null => {
  const brokerRecord = brokerStatus ? ((brokerStatus as unknown) as Record<string, unknown>) : null;
  const rawStatus = brokerStatus?.raw && isRecord(brokerStatus.raw) ? brokerStatus.raw : null;

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
    rawStatus?.msisdn
  );

  if (phone) {
    return phone;
  }

  const brokerRecordObject = isRecord(brokerRecord) ? (brokerRecord as Record<string, unknown>) : null;
  const rawStatusObject = isRecord(rawStatus) ? (rawStatus as Record<string, unknown>) : null;
  const metadataObject = isRecord(metadata) ? (metadata as Record<string, unknown>) : null;

  const phoneFromJid =
    extractPhoneFromJidString(readRecordString(brokerRecordObject, 'jid')) ??
    extractPhoneFromJidString(
      isRecord(brokerRecordObject?.user)
        ? readRecordString(brokerRecordObject!.user as Record<string, unknown>, 'id')
        : null
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

const mapBrokerInstanceStatusToDbStatus = (status: string | null | undefined): WhatsAppInstanceStatus => {
  switch (status) {
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
      return 'error';
  }
};

const serializeStoredInstance = (
  instance: StoredInstance,
  brokerStatus?: WhatsAppStatus | null
): NormalizedInstance & { brokerId: string } => {
  const normalizedStatus = brokerStatus?.status ?? mapDbStatusToNormalized(instance.status);
  const connected = brokerStatus?.connected ?? instance.connected;
  const rawStatus =
    brokerStatus?.raw && typeof brokerStatus.raw === 'object' && brokerStatus.raw !== null
      ? (brokerStatus.raw as Record<string, unknown>)
      : brokerStatus
        ? (brokerStatus as unknown as Record<string, unknown>)
        : null;

  const stats =
    mergeRecords(
      asRecord(brokerStatus?.stats),
      asRecord(brokerStatus?.messages),
      asRecord(rawStatus?.stats),
      asRecord(rawStatus?.messages),
      asRecord(rawStatus?.metrics),
      asRecord(rawStatus?.counters),
      asRecord(rawStatus?.status),
      asRecord((instance.metadata as Record<string, unknown> | null)?.stats)
    ) ?? undefined;

  let metrics =
    mergeRecords(
      asRecord(brokerStatus?.metrics),
      asRecord(brokerStatus?.rateUsage),
      asRecord(rawStatus?.metrics),
      asRecord(rawStatus?.messages),
      asRecord(rawStatus?.stats)
    ) ?? undefined;

  const messages =
    asRecord(brokerStatus?.messages) ??
    asRecord(rawStatus?.messages) ??
    null;

  const rate =
    mergeRecords(
      asRecord(brokerStatus?.rate),
      asRecord(brokerStatus?.rateUsage),
      asRecord(rawStatus?.rate),
      asRecord(rawStatus?.rateUsage)
    ) ?? null;

  const baseMetadata = (instance.metadata as Record<string, unknown> | null) ?? {};
  const metadata: Record<string, unknown> = { ...baseMetadata };

  if (brokerStatus?.metrics && typeof brokerStatus.metrics === 'object') {
    metadata.brokerMetrics = brokerStatus.metrics;
  }
  if (brokerStatus?.rateUsage && typeof brokerStatus.rateUsage === 'object') {
    metadata.brokerRateUsage = brokerStatus.rateUsage;
  }

  const phoneNumber = resolvePhoneNumber(instance, metadata, brokerStatus);

  const brokerRecord = brokerStatus
    ? ((brokerStatus as unknown) as Record<string, unknown>)
    : null;

  const dataSources: unknown[] = [
    metrics,
    stats,
    messages,
    rawStatus,
    brokerRecord,
  ].filter((value) => value !== undefined && value !== null);

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

  metrics = Object.keys(normalizedMetrics).length > 0 ? normalizedMetrics : undefined;
  if (metrics) {
    metadata.normalizedMetrics = normalizedMetrics;
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

  const lastError = readLastErrorFromMetadata(metadata);

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

const normalizeQr = (
  value: unknown
): { qr: string | null; qrCode: string | null; expiresAt: string | null; qrExpiresAt: string | null } => {
  if (!value || typeof value !== 'object') {
    return { qr: null, qrCode: null, expiresAt: null, qrExpiresAt: null };
  }

  const source = value as Record<string, unknown>;
  const qrSource =
    typeof source.qr === 'object' && source.qr !== null
      ? (source.qr as Record<string, unknown>)
      : {};

  const qrCandidate = pickString(
    typeof source.qr === 'string' ? source.qr : null,
    qrSource.qr,
    qrSource.qrCode,
    qrSource.qr_code,
    qrSource.code,
    source.qrCode,
    source.qr_code
  );

  const qrCodeCandidate = pickString(
    source.qrCode,
    source.qr_code,
    qrSource.qrCode,
    qrSource.qr_code,
    qrSource.code,
    typeof source.qr === 'string' ? source.qr : null
  );

  const qrExpiresAt =
    pickString(source.qrExpiresAt, source.qr_expires_at, qrSource.expiresAt, qrSource.expires_at) ?? null;

  return {
    qr: qrCandidate,
    qrCode: qrCodeCandidate ?? qrCandidate,
    expiresAt:
      pickString(source.expiresAt, source.expires_at, qrSource.expiresAt, qrSource.expires_at) ?? qrExpiresAt,
    qrExpiresAt,
  };
};

const extractQrImageBuffer = (qr: ReturnType<typeof normalizeQr>): Buffer | null => {
  const candidate = (qr.qrCode || qr.qr || '').trim();
  if (!candidate) {
    return null;
  }

  const dataUrlMatch = candidate.match(/^data:image\/(?:png|jpeg);base64,(?<data>[a-z0-9+/=_-]+)$/i);
  const base64Candidate = dataUrlMatch?.groups?.data ?? candidate;
  const sanitized = base64Candidate.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = sanitized.length % 4 === 0 ? '' : '='.repeat(4 - (sanitized.length % 4));
  const normalized = sanitized + padding;

  try {
    const buffer = Buffer.from(normalized, 'base64');
    return buffer.length > 0 ? buffer : null;
  } catch (_error) {
    return null;
  }
};

const normalizeInstanceStatusResponse = (
  status: WhatsAppStatus | null | undefined
): {
  status: NormalizedInstance['status'];
  connected: boolean;
  qr: string | null;
  qrCode: string | null;
  expiresAt: string | null;
  qrExpiresAt: string | null;
} => {
  if (!status) {
    return {
      status: 'disconnected',
      connected: false,
      qr: null,
      qrCode: null,
      expiresAt: null,
      qrExpiresAt: null,
    };
  }

  return {
    status: status.status,
    connected: status.connected,
    qr: status.qr,
    qrCode: status.qrCode,
    expiresAt: status.expiresAt,
    qrExpiresAt: status.qrExpiresAt,
  };
};

type SyncInstancesResult = {
  instances: StoredInstance[];
  snapshots: WhatsAppBrokerInstanceSnapshot[];
};

const syncInstancesFromBroker = async (
  tenantId: string,
  existing: StoredInstance[],
  prefetchedSnapshots?: WhatsAppBrokerInstanceSnapshot[]
): Promise<SyncInstancesResult> => {
  const brokerSnapshots = prefetchedSnapshots ?? (await whatsappBrokerClient.listInstances(tenantId));
  if (!brokerSnapshots.length) {
    logger.info('🛰️ [WhatsApp] Broker returned zero instances', { tenantId });
    return { instances: existing, snapshots: brokerSnapshots };
  }

  const existingById = new Map(existing.map((item) => [item.id, item]));
  const existingByBrokerId = new Map(existing.map((item) => [item.brokerId, item]));

  logger.info('🛰️ [WhatsApp] Broker instances snapshot', {
    tenantId,
    brokerCount: brokerSnapshots.length,
    ids: brokerSnapshots.map((snapshot) => snapshot.instance.id),
  });

  const parseDateValue = (value: unknown): Date | null => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) {
        return new Date(parsed);
      }
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }

    return null;
  };

  for (const snapshot of brokerSnapshots) {
    const brokerInstance = snapshot.instance;
    const brokerStatus = snapshot.status ?? null;
    const instanceId = typeof brokerInstance.id === 'string' ? brokerInstance.id.trim() : '';
    if (!instanceId) {
      continue;
    }

    const existingInstance =
      existingByBrokerId.get(instanceId) ?? existingById.get(instanceId) ?? null;
    const derivedStatus = brokerStatus
      ? mapBrokerStatusToDbStatus(brokerStatus)
      : mapBrokerInstanceStatusToDbStatus(brokerInstance.status ?? null);
    const derivedConnected = brokerStatus?.connected ?? Boolean(brokerInstance.connected);
    const phoneNumber = ((): string | null => {
      const metadata = (existingInstance?.metadata as Record<string, unknown> | null) ?? {};
      const brokerMetadata = brokerStatus?.raw && isRecord(brokerStatus.raw) ? brokerStatus.raw : {};
      const primary = pickString(
        brokerInstance.phoneNumber,
        metadata.phoneNumber,
        metadata.phone_number,
        metadata.msisdn,
        metadata.phone,
        metadata.number,
        brokerMetadata.phoneNumber,
        brokerMetadata.phone_number,
        brokerMetadata.msisdn,
        brokerMetadata.number,
        brokerMetadata.address
      );

      if (primary) {
        return primary;
      }

      return (
        findPhoneNumberInObject(metadata) ??
        findPhoneNumberInObject(brokerMetadata) ??
        findPhoneNumberInObject(brokerStatus) ??
        null
      );
    })();

    const historyEntry = buildHistoryEntry('broker-sync', 'system', {
      status: derivedStatus,
      connected: derivedConnected,
      ...(phoneNumber ? { phoneNumber } : {}),
      ...(brokerStatus?.metrics ? { metrics: brokerStatus.metrics } : {}),
      ...(brokerStatus?.stats ? { stats: brokerStatus.stats } : {}),
    });

    const brokerRaw = brokerStatus?.raw && isRecord(brokerStatus.raw) ? brokerStatus.raw : null;
    const lastActivityCandidate =
      parseDateValue(brokerInstance.lastActivity) ??
      parseDateValue(brokerRaw?.['lastActivity']) ??
      parseDateValue(brokerRaw?.['lastSeen']) ??
      parseDateValue(brokerRaw?.['last_active_at']) ??
      parseDateValue(brokerRaw?.['lastSeenAt']) ??
      null;

    const derivedLastSeenAt = derivedConnected
      ? new Date()
      : lastActivityCandidate ?? existingInstance?.lastSeenAt ?? null;

    const brokerSnapshotMetadata: Record<string, unknown> = {
      syncedAt: new Date().toISOString(),
      status: brokerStatus?.status ?? derivedStatus,
      connected: derivedConnected,
      phoneNumber: phoneNumber ?? null,
      metrics: brokerStatus?.metrics ?? null,
      stats: brokerStatus?.stats ?? brokerInstance.stats ?? null,
      rate: brokerStatus?.rate ?? null,
      rateUsage: brokerStatus?.rateUsage ?? null,
      messages: brokerStatus?.messages ?? null,
      qr: brokerStatus
        ? {
            qr: brokerStatus.qr,
            qrCode: brokerStatus.qrCode,
            qrExpiresAt: brokerStatus.qrExpiresAt,
            expiresAt: brokerStatus.expiresAt,
          }
        : null,
    };

    if (brokerStatus?.raw && isRecord(brokerStatus.raw)) {
      brokerSnapshotMetadata.raw = brokerStatus.raw;
    }

    if (existingInstance) {
      logger.info('🛰️ [WhatsApp] Sync updating stored instance from broker', {
        tenantId,
        instanceId,
        status: derivedStatus,
        connected: derivedConnected,
        phoneNumber,
      });
      const metadataWithHistory = appendInstanceHistory(
        existingInstance.metadata as InstanceMetadata,
        historyEntry
      ) as Record<string, unknown>;
      metadataWithHistory.lastBrokerSnapshot = brokerSnapshotMetadata;
      const metadataWithoutError = withInstanceLastError(metadataWithHistory, null);

      await prisma.whatsAppInstance.update({
        where: { id: existingInstance.id },
        data: {
          tenantId,
          name: brokerInstance.name ?? existingInstance.name ?? instanceId,
          status: derivedStatus,
          connected: derivedConnected,
          brokerId: instanceId,
          ...(phoneNumber ? { phoneNumber } : {}),
          ...(derivedLastSeenAt ? { lastSeenAt: derivedLastSeenAt } : {}),
          metadata: metadataWithoutError,
        },
      });

      emitToTenant(tenantId, 'whatsapp.instance.updated', {
        id: instanceId,
        status: derivedStatus,
        connected: derivedConnected,
        phoneNumber,
        syncedAt: new Date().toISOString(),
        history: historyEntry,
      });
    } else {
      logger.info('🛰️ [WhatsApp] Sync creating instance missing from storage', {
        tenantId,
        instanceId,
        status: derivedStatus,
        connected: derivedConnected,
        phoneNumber,
      });
      const baseMetadata: InstanceMetadata = {
        origin: 'broker-sync',
      };

      const metadataWithHistory = appendInstanceHistory(baseMetadata, historyEntry) as Record<
        string,
        unknown
      >;
      metadataWithHistory.lastBrokerSnapshot = brokerSnapshotMetadata;
      const metadataWithoutError = withInstanceLastError(metadataWithHistory, null);

      await prisma.whatsAppInstance.create({
        data: {
          id: instanceId,
          tenantId,
          name: brokerInstance.name ?? instanceId,
          brokerId: instanceId,
          status: derivedStatus,
          connected: derivedConnected,
          phoneNumber,
          ...(derivedLastSeenAt ? { lastSeenAt: derivedLastSeenAt } : {}),
          metadata: metadataWithoutError,
        },
      });

      emitToTenant(tenantId, 'whatsapp.instance.created', {
        id: instanceId,
        status: derivedStatus,
        connected: derivedConnected,
        phoneNumber,
        syncedAt: new Date().toISOString(),
        history: historyEntry,
      });
    }
  }

  const refreshed = (await prisma.whatsAppInstance.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
  })) as StoredInstance[];

  return { instances: refreshed, snapshots: brokerSnapshots };
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
};

const toPublicInstance = (
  value: ReturnType<typeof serializeStoredInstance>
): NormalizedInstance => {
  const { brokerId: _brokerId, ...publicInstance } = value;
  return publicInstance;
};

const collectInstancesForTenant = async (
  tenantId: string,
  options: InstanceCollectionOptions = {}
): Promise<InstanceCollectionResult> => {
  const fetchSnapshots = options.fetchSnapshots ?? true;

  let storedInstances =
    options.existing ??
    ((await prisma.whatsAppInstance.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    })) as StoredInstance[]);

  let snapshots = options.snapshots ?? null;

  const refreshFlag = options.refresh;
  const shouldRefresh =
    refreshFlag === undefined
      ? fetchSnapshots
      : Boolean(refreshFlag) || storedInstances.length === 0;

  if (shouldRefresh) {
    try {
      const syncResult = await syncInstancesFromBroker(
        tenantId,
        storedInstances,
        snapshots ?? undefined
      );
      storedInstances = syncResult.instances;
      snapshots = syncResult.snapshots;
    } catch (error) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        if (options.refresh) {
          throw error;
        }
        logger.info('🛰️ [WhatsApp] Broker not configured during sync; returning cached instances', {
          tenantId,
        });
        snapshots = [];
      } else {
        throw error;
      }
    }
  } else if (fetchSnapshots) {
    if (!snapshots) {
      snapshots = await whatsappBrokerClient.listInstances(tenantId);
    }
  } else if (!snapshots) {
    snapshots = [];
  }

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

  for (const stored of storedInstances) {
    const snapshot = snapshotMap.get(stored.id) ??
      (stored.brokerId ? snapshotMap.get(stored.brokerId) : undefined);
    const brokerStatus = snapshot?.status ?? null;
    const serialized = serializeStoredInstance(stored, brokerStatus);

    if (serialized.phoneNumber && serialized.phoneNumber !== stored.phoneNumber) {
      await prisma.whatsAppInstance.update({
        where: { id: stored.id },
        data: { phoneNumber: serialized.phoneNumber },
      });
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

  return {
    entries,
    instances,
    rawInstances: entries.map(({ serialized }) => serialized),
    map,
    snapshots: snapshots ?? [],
  };
};

type InstanceOperationContext = {
  stored: StoredInstance;
  entry: InstanceCollectionEntry | null;
  brokerStatus: WhatsAppStatus | null;
  serialized: ReturnType<typeof serializeStoredInstance>;
  instance: NormalizedInstance;
  status: ReturnType<typeof normalizeInstanceStatusResponse>;
  qr: ReturnType<typeof normalizeQr>;
  instances: NormalizedInstance[];
};

const resolveInstanceOperationContext = async (
  tenantId: string,
  instance: StoredInstance,
  options: { refresh?: boolean; fetchSnapshots?: boolean } = {}
): Promise<InstanceOperationContext> => {
  const collection = await collectInstancesForTenant(tenantId, {
    refresh: options.refresh,
    fetchSnapshots: options.fetchSnapshots,
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

const disconnectStoredInstance = async (
  tenantId: string,
  stored: StoredInstance,
  actorId: string,
  options: { wipe?: boolean } = {}
): Promise<InstanceOperationContext> => {
  const disconnectOptions = options.wipe === undefined ? undefined : { wipe: options.wipe };

  await whatsappBrokerClient.disconnectInstance(stored.brokerId, {
    ...(disconnectOptions ?? {}),
    instanceId: stored.id,
  });

  const context = await resolveInstanceOperationContext(tenantId, stored, { refresh: true });

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

  return context;
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

const resolveTenantSessionId = (tenantId: string): string => tenantId;

// GET /api/integrations/whatsapp/instances - List WhatsApp instances
router.get(
  '/whatsapp/instances',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const refreshQuery = req.query.refresh;
    const refreshToken = Array.isArray(refreshQuery) ? refreshQuery[0] : refreshQuery;
    const normalizedRefresh =
      typeof refreshToken === 'string' ? refreshToken.trim().toLowerCase() : null;
    const hasRefreshParam = normalizedRefresh !== null;
    const refreshRequested = hasRefreshParam
      ? normalizedRefresh === '1' || normalizedRefresh === 'true' || normalizedRefresh === 'yes'
      : undefined;
    const agreementQuery = req.query.agreementId;
    const agreementIdCandidate = Array.isArray(agreementQuery) ? agreementQuery[0] : agreementQuery;
    const agreementId =
      typeof agreementIdCandidate === 'string' && agreementIdCandidate.trim().length > 0
        ? agreementIdCandidate.trim()
        : null;

    logger.info('🛰️ [WhatsApp] List instances requested', {
      tenantId,
      refreshRequested,
      agreementId,
    });

    try {
      const collectionOptions =
        refreshRequested === undefined ? {} : { refresh: refreshRequested };

      const { instances } = await collectInstancesForTenant(tenantId, collectionOptions);

      const filteredInstances =
        agreementId === null
          ? instances
          : instances.filter((instance) => instance.agreementId === agreementId);

      const warnings: Array<{ code: string; message: string }> = [];
      if (agreementId && filteredInstances.length === 0) {
        warnings.push({
          code: 'NO_INSTANCES_FOR_AGREEMENT',
          message: `Nenhuma instância WhatsApp encontrada para o convênio ${agreementId}.`,
        });
      }

      logger.info('🛰️ [WhatsApp] Returning instances to client', {
        tenantId,
        count: filteredInstances.length,
        refreshRequested,
        agreementId,
      });

      const responsePayload: {
        success: true;
        data: { instances: NormalizedInstance[] };
        meta?: { warnings: Array<{ code: string; message: string }> };
      } = {
        success: true,
        data: {
          instances: filteredInstances,
        },
      };

      if (warnings.length > 0) {
        responsePayload.meta = { warnings };
      }

      res.json(responsePayload);
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/instances - Create a WhatsApp instance
router.post(
  '/whatsapp/instances',
  body('id').optional().isString().isLength({ min: 1 }),
  body('name').isString().isLength({ min: 1 }),
  body('agreementId').optional().isString().isLength({ min: 1 }),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { id, name, agreementId } = req.body as {
      id?: string;
      name: string;
      agreementId?: string;
    };

    const normalizedName = name.trim();
    const slugCandidate = toSlug(normalizedName, '');

    if (!slugCandidate) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INSTANCE_NAME',
          message: 'Informe um nome válido utilizando letras minúsculas, números ou hífens.',
        },
      });
      return;
    }

    try {
      assertValidSlug(slugCandidate, 'nome');
    } catch (validationError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INSTANCE_NAME',
          message: validationError instanceof Error ? validationError.message : 'Nome inválido para instância.',
        },
      });
      return;
    }

    const requestedIdSource = typeof id === 'string' && id.trim().length > 0 ? id : slugCandidate;
    const normalizedAgreementId =
      typeof agreementId === 'string' && agreementId.trim().length > 0
        ? agreementId.trim()
        : null;
    try {
      const normalizedId = await ensureUniqueInstanceId(tenantId, requestedIdSource);
      let brokerInstance: WhatsAppInstance | null = null;

      try {
        brokerInstance = await whatsappBrokerClient.createInstance({
          tenantId,
          name: normalizedName,
          instanceId: normalizedId,
        });
      } catch (brokerError) {
        if (brokerError instanceof WhatsAppBrokerError || hasErrorName(brokerError, 'WhatsAppBrokerError')) {
          const normalizedError = brokerError as WhatsAppBrokerError;
          logger.warn('WhatsApp broker rejected instance creation request', {
            tenantId,
            name: normalizedName,
            error: normalizedError.message,
            code: normalizedError.code,
            status: normalizedError.status,
            requestId: normalizedError.requestId,
          });

          res.status(502).json({
            success: false,
            error: {
              code: normalizedError.code || 'BROKER_ERROR',
              message: normalizedError.message || 'WhatsApp broker request failed',
              details: compactRecord({
                status: normalizedError.status,
                requestId: normalizedError.requestId ?? undefined,
              }),
            },
          });
          return;
        }

        if (handleWhatsAppIntegrationError(res, brokerError)) {
          return;
        }

        throw brokerError;
      }

      const brokerId = brokerInstance?.id;
      if (!brokerId) {
        logger.warn('WhatsApp broker did not return an instance id, falling back to requested identifier', {
          tenantId,
          requestedId: normalizedId,
        });
      }
      const resolvedBrokerId = brokerId ?? normalizedId;
      const actorId = req.user?.id ?? 'system';
      const historyEntry = buildHistoryEntry(
        'created',
        actorId,
        compactRecord({
          name: normalizedName,
          brokerId: resolvedBrokerId,
          agreementId: normalizedAgreementId ?? undefined,
        })
      );
      const metadata = appendInstanceHistory(
        compactRecord({
          displayId: normalizedId,
          slug: slugCandidate,
          brokerId: resolvedBrokerId,
          ...(normalizedAgreementId
            ? { agreementId: normalizedAgreementId, agreement: { id: normalizedAgreementId } }
            : {}),
        }),
        historyEntry
      );
      const metadataWithoutError = withInstanceLastError(metadata, null);
      const derivedStatus = brokerInstance
        ? mapBrokerInstanceStatusToDbStatus(brokerInstance.status)
        : 'pending';
      const isConnected = brokerInstance?.connected ?? false;
      const instance = await prisma.whatsAppInstance.create({
        data: {
          id: normalizedId,
          tenantId,
          name: normalizedName,
          brokerId: resolvedBrokerId,
          status: derivedStatus,
          connected: isConnected,
          phoneNumber: brokerInstance?.phoneNumber ?? null,
          metadata: metadataWithoutError,
        },
      });

      const { brokerId: _brokerId, ...payload } = serializeStoredInstance(instance as StoredInstance, null);

      logger.info('WhatsApp instance created', {
        tenantId,
        instanceId: normalizedId,
        brokerId: resolvedBrokerId,
        actorId,
      });

      emitToTenant(tenantId, 'whatsapp.instance.created', {
        id: instance.id,
        status: instance.status,
        connected: instance.connected,
        ...(normalizedAgreementId ? { agreementId: normalizedAgreementId } : {}),
        ...(instance.phoneNumber ? { phoneNumber: instance.phoneNumber } : {}),
        brokerId: resolvedBrokerId,
        syncedAt: new Date().toISOString(),
        history: historyEntry,
      });

      res.status(201).json({
        success: true,
        data: payload,
      });
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        res.status(409).json({
          success: false,
          error: {
            code: 'INSTANCE_ALREADY_EXISTS',
            message: 'Já existe uma instância WhatsApp com este identificador.',
          },
        });
        return;
      }

      if (error instanceof Prisma.PrismaClientValidationError) {
        logger.error('WhatsApp instance creation rejected: invalid payload', {
          tenantId,
          error,
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INSTANCE_PAYLOAD',
            message:
              'Não foi possível criar a instância WhatsApp. Verifique os dados enviados e tente novamente.',
          },
        });
        return;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error('WhatsApp instance creation failed due to storage error', {
          tenantId,
          code: error.code,
          meta: error.meta,
        });

        res.status(503).json({
          success: false,
          error: {
            code: 'WHATSAPP_STORAGE_UNAVAILABLE',
            message:
              'Serviço de armazenamento das instâncias WhatsApp indisponível. Verifique a conexão com o banco ou execute as migrações pendentes.',
          },
        });
        return;
      }

      throw error;
    }
  })
);

const connectInstanceHandler = async (req: Request, res: Response) => {
  const instanceId = req.params.id;
  const tenantId = req.user!.tenantId;
  const actorId = req.user?.id ?? 'system';

  try {
    const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

    if (!instance || instance.tenantId !== tenantId) {
      res.status(404).json({
        success: false,
        error: {
          code: 'INSTANCE_NOT_FOUND',
          message: 'Instância WhatsApp não encontrada.',
        },
      });
      return;
    }

    try {
      await whatsappBrokerClient.connectInstance(instance.brokerId, { instanceId: instance.id });
    } catch (error) {
      if (error instanceof WhatsAppBrokerError) {
        logger.warn('WhatsApp broker rejected connect request', {
          tenantId,
          instanceId: instance.id,
          status: error.status,
          code: error.code,
          requestId: error.requestId,
        });

        const failureHistory = buildHistoryEntry('connect-instance-failed', actorId, {
          code: error.code,
          message: error.message,
          requestId: error.requestId ?? null,
        });

        const metadataWithHistory = appendInstanceHistory(
          instance.metadata as InstanceMetadata,
          failureHistory
        );
        const metadataWithError = withInstanceLastError(metadataWithHistory, {
          code: error.code,
          message: error.message,
          requestId: error.requestId ?? null,
        });

        await prisma.whatsAppInstance.update({
          where: { id: instance.id },
          data: {
            status: 'failed',
            connected: false,
            metadata: metadataWithError,
          },
        });

        if (isBrokerMissingInstanceError(error)) {
          res.status(422).json({
            success: false,
            error: {
              code: 'BROKER_NOT_FOUND',
              message: 'Instance not found in broker',
              details: compactRecord({
                instanceId: instance.id,
                requestId: error.requestId ?? undefined,
              }),
            },
          });
          return;
        }

        res.status(502).json({
          success: false,
          error: {
            code: error.code || 'BROKER_ERROR',
            message: error.message || 'WhatsApp broker request failed',
            details: compactRecord({
              status: error.status,
              requestId: error.requestId ?? undefined,
            }),
          },
        });
        return;
      }

      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }

      throw error;
    }

    const context = await resolveInstanceOperationContext(tenantId, instance as StoredInstance, {
      refresh: true,
    });

    if (!context.status.connected) {
      logger.warn('WhatsApp instance did not report connected status after connect', {
        tenantId,
        instanceId: instance.id,
        status: context.status.status,
      });
    }

    const historyEntry = buildHistoryEntry('connect-instance', actorId, {
      status: context.status.status,
      connected: context.status.connected,
    });

    const metadataWithHistory = appendInstanceHistory(
      context.stored.metadata as InstanceMetadata,
      historyEntry
    );
    const metadataWithoutError = withInstanceLastError(metadataWithHistory, null);

    const derivedStatus = context.brokerStatus
      ? mapBrokerStatusToDbStatus(context.brokerStatus)
      : mapBrokerInstanceStatusToDbStatus(context.status.status);

    await prisma.whatsAppInstance.update({
      where: { id: context.stored.id },
      data: {
        status: derivedStatus,
        connected: context.status.connected,
        metadata: metadataWithoutError,
        lastSeenAt: context.status.connected ? new Date() : context.stored.lastSeenAt,
      },
    });

    res.json({
      success: true,
      data: {
        instance: context.instance,
        status: context.status,
        connected: context.status.connected,
        qr: context.qr,
        instances: context.instances,
      },
    });
  } catch (error: unknown) {
    if (handleWhatsAppIntegrationError(res, error)) {
      return;
    }
    throw error;
  }
};

const connectInstanceMiddleware = [
  instanceIdParamValidator(),
  validateRequest,
  requireTenant,
  asyncHandler(connectInstanceHandler),
];

// POST /api/integrations/whatsapp/instances/:id/connect - Connect a WhatsApp instance
router.post('/whatsapp/instances/:id/connect', ...connectInstanceMiddleware);

// Legacy alias kept for backwards compatibility
router.post('/whatsapp/instances/:id/start', ...connectInstanceMiddleware);

// POST /api/integrations/whatsapp/instances/connect - Connect the default WhatsApp instance
router.post(
  '/whatsapp/instances/connect',
  body('instanceId').optional().isString().trim().notEmpty(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const requestedInstanceId =
      typeof req.body?.instanceId === 'string' ? req.body.instanceId.trim() : '';
    const instanceId = requestedInstanceId || resolveDefaultInstanceId();
    const tenantId = req.user!.tenantId;

    try {
      const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

      if (!instance || instance.tenantId !== tenantId) {
        res.status(404).json({
          success: false,
          error: {
            code: 'INSTANCE_NOT_FOUND',
            message: 'Instância WhatsApp não encontrada.',
          },
        });
        return;
      }

      try {
        await whatsappBrokerClient.connectInstance(instance.brokerId, { instanceId: instance.id });
      } catch (error) {
        if (error instanceof WhatsAppBrokerError) {
          logger.warn('WhatsApp broker rejected default connect request', {
            tenantId,
            instanceId: instance.id,
            status: error.status,
            code: error.code,
            requestId: error.requestId,
          });

          const failureHistory = buildHistoryEntry('connect-instance-failed', req.user?.id ?? 'system', {
            code: error.code,
            message: error.message,
            requestId: error.requestId ?? null,
          });

          const metadataWithHistory = appendInstanceHistory(
            instance.metadata as InstanceMetadata,
            failureHistory
          );
          const metadataWithError = withInstanceLastError(metadataWithHistory, {
            code: error.code,
            message: error.message,
            requestId: error.requestId ?? null,
          });

          await prisma.whatsAppInstance.update({
            where: { id: instance.id },
            data: {
              status: 'failed',
              connected: false,
              metadata: metadataWithError,
            },
          });

          if (isBrokerMissingInstanceError(error)) {
            res.status(422).json({
              success: false,
              error: {
                code: 'BROKER_NOT_FOUND',
                message: 'Instance not found in broker',
                details: compactRecord({
                  instanceId: instance.id,
                  requestId: error.requestId ?? undefined,
                }),
              },
            });
            return;
          }

          res.status(502).json({
            success: false,
            error: {
              code: error.code || 'BROKER_ERROR',
              message: error.message || 'WhatsApp broker request failed',
              details: compactRecord({
                status: error.status,
                requestId: error.requestId ?? undefined,
              }),
            },
          });
          return;
        }

        if (handleWhatsAppIntegrationError(res, error)) {
          return;
        }

        throw error;
      }

      const context = await resolveInstanceOperationContext(tenantId, instance as StoredInstance, {
        refresh: true,
      });

      const metadataEntry = buildHistoryEntry('connect-instance', req.user?.id ?? 'system', {
        status: context.status.status,
        connected: context.status.connected,
      });

      const metadataWithHistory = appendInstanceHistory(
        context.stored.metadata as InstanceMetadata,
        metadataEntry
      );
      const metadataWithoutError = withInstanceLastError(metadataWithHistory, null);

      const derivedStatus = context.brokerStatus
        ? mapBrokerStatusToDbStatus(context.brokerStatus)
        : mapBrokerInstanceStatusToDbStatus(context.status.status);

      await prisma.whatsAppInstance.update({
        where: { id: context.stored.id },
        data: {
          status: derivedStatus,
          connected: context.status.connected,
          metadata: metadataWithoutError,
          lastSeenAt: context.status.connected ? new Date() : context.stored.lastSeenAt,
        },
      });

      res.json({
        success: true,
        data: {
          instanceId: context.instance.id,
          instance: context.instance,
          status: context.status,
          connected: context.status.connected,
          qr: context.qr,
          instances: context.instances,
        },
      });
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/instances/:id/stop - Disconnect a WhatsApp instance
router.post(
  '/whatsapp/instances/:id/stop',
  instanceIdParamValidator(),
  body('wipe').optional().isBoolean(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = req.params.id;
    const wipe = typeof req.body?.wipe === 'boolean' ? req.body.wipe : undefined;
    const disconnectOptions = wipe === undefined ? undefined : { wipe };
    const tenantId = req.user!.tenantId;

    try {
      const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

      if (!instance || instance.tenantId !== tenantId) {
        res.status(404).json({
          success: false,
          error: {
            code: 'INSTANCE_NOT_FOUND',
            message: 'Instância WhatsApp não encontrada.',
          },
        });
        return;
      }

      await whatsappBrokerClient.disconnectInstance(instance.brokerId, {
        ...(disconnectOptions ?? {}),
        instanceId: instance.id,
      });

      const context = await resolveInstanceOperationContext(tenantId, instance as StoredInstance, {
        refresh: true,
      });

      if (context.status.connected) {
        logger.warn('WhatsApp instance still connected after disconnect request', {
          tenantId,
          instanceId: instance.id,
          status: context.status.status,
        });
      }

      const historyEntry = buildHistoryEntry('disconnect-instance', req.user?.id ?? 'system', {
        status: context.status.status,
        connected: context.status.connected,
        wipe: Boolean(wipe),
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

      res.json({
        success: true,
        data: {
          instance: context.instance,
          status: context.status,
          connected: context.status.connected,
          qr: context.qr,
          instances: context.instances,
        },
      });
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }
      throw error;
    }
  })
);

router.delete(
  '/whatsapp/instances/:id',
  instanceIdParamValidator(),
  query('wipe').optional().isBoolean().toBoolean(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = req.params.id.trim();
    const tenantId = req.user!.tenantId;
    const wipe = typeof req.query?.wipe === 'boolean' ? (req.query.wipe as boolean) : false;

    try {
      if (looksLikeWhatsAppJid(instanceId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'USE_DISCONNECT_FOR_JID',
            message:
              'Instâncias sincronizadas diretamente com o WhatsApp devem ser desconectadas via POST /api/integrations/whatsapp/instances/:id/disconnect.',
            details: { instanceId },
          },
        });
        return;
      }

      const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

      if (!instance || instance.tenantId !== tenantId) {
        res.status(404).json({
          success: false,
          error: {
            code: 'INSTANCE_NOT_FOUND',
            message: 'Instância WhatsApp não encontrada.',
          },
        });
        return;
      }

      const campaignsToRemove: Array<{ id: string; name: string | null }> = await prisma.campaign.findMany({
        where: {
          tenantId,
          whatsappInstanceId: instance.id,
        },
        select: {
          id: true,
          name: true,
        },
      });

      await whatsappBrokerClient.deleteInstance(instance.brokerId, {
        instanceId: instance.id,
        wipe,
      });

      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        if (campaignsToRemove.length > 0) {
          const campaignIds = campaignsToRemove.map((campaign) => campaign.id);
          await tx.campaign.deleteMany({ where: { id: { in: campaignIds } } });
        }

        await tx.whatsAppInstance.delete({ where: { id: instance.id } });
      });

      logger.info('WhatsApp instance deleted', {
        tenantId,
        instanceId: instance.id,
        actorId: req.user?.id ?? 'unknown',
        removedCampaigns: campaignsToRemove.length,
        campaignIds: campaignsToRemove.map((campaign) => campaign.id),
        wipe,
      });

      res.status(204).send();
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/instances/disconnect - Disconnect the default WhatsApp instance
router.post(
  '/whatsapp/instances/disconnect',
  body('wipe').optional().isBoolean(),
  body('instanceId').optional().isString().trim().notEmpty(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const requestedInstanceId =
      typeof req.body?.instanceId === 'string' ? req.body.instanceId.trim() : '';
    const instanceId = requestedInstanceId || resolveDefaultInstanceId();
    const wipe = typeof req.body?.wipe === 'boolean' ? req.body.wipe : undefined;
    const tenantId = req.user!.tenantId;

    try {
      const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

      if (!instance || instance.tenantId !== tenantId) {
        res.status(404).json({
          success: false,
          error: {
            code: 'INSTANCE_NOT_FOUND',
            message: 'Instância WhatsApp não encontrada.',
          },
        });
        return;
      }

      const context = await disconnectStoredInstance(
        tenantId,
        instance as StoredInstance,
        req.user?.id ?? 'system',
        wipe === undefined ? {} : { wipe }
      );

      res.json({
        success: true,
        data: {
          instanceId: context.instance.id,
          instance: context.instance,
          status: context.status,
          connected: context.status.connected,
          qr: context.qr,
          instances: context.instances,
        },
      });
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }
      throw error;
    }
  })
);

router.post(
  '/whatsapp/instances/:id/disconnect',
  instanceIdParamValidator(),
  body('wipe').optional().isBoolean(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const actorId = req.user?.id ?? 'system';
    const instanceId = req.params.id.trim();
    const wipe = typeof req.body?.wipe === 'boolean' ? (req.body.wipe as boolean) : undefined;

    try {
      const storedInstance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

      if (storedInstance && storedInstance.tenantId !== tenantId) {
        res.status(404).json({
          success: false,
          error: {
            code: 'INSTANCE_NOT_FOUND',
            message: 'Instância WhatsApp não encontrada.',
          },
        });
        return;
      }

      if (storedInstance) {
        const context = await disconnectStoredInstance(
          tenantId,
          storedInstance as StoredInstance,
          actorId,
          wipe === undefined ? {} : { wipe }
        );

        res.json({
          success: true,
          data: {
            instanceId: context.instance.id,
            instance: context.instance,
            status: context.status,
            connected: context.status.connected,
            qr: context.qr,
            instances: context.instances,
            existed: true,
          },
        });
        return;
      }

      if (!looksLikeWhatsAppJid(instanceId)) {
        res.json({
          success: true,
          data: {
            instanceId,
            disconnected: true,
            existed: false,
          },
        });
        return;
      }

      try {
        await whatsappBrokerClient.disconnectInstance(instanceId, {
          instanceId,
          ...(wipe === undefined ? {} : { wipe }),
        });

        res.json({
          success: true,
          data: {
            instanceId,
            disconnected: true,
            existed: true,
            connected: false,
          },
        });
      } catch (error) {
        if (isBrokerMissingInstanceError(error)) {
          res.json({
            success: true,
            data: {
              instanceId,
              disconnected: true,
              existed: false,
            },
          });
          return;
        }

        if (handleWhatsAppIntegrationError(res, error)) {
          return;
        }

        throw error;
      }
    } catch (error) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// GET /api/integrations/whatsapp/instances/:id/qr - Fetch QR code for a WhatsApp instance
router.get(
  '/whatsapp/instances/:id/qr',
  instanceIdParamValidator(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = req.params.id;
    const tenantId = req.user!.tenantId;

    try {
      const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

      if (!instance || instance.tenantId !== tenantId) {
        res.status(404).json({
          success: false,
          error: {
            code: 'INSTANCE_NOT_FOUND',
            message: 'Instância WhatsApp não encontrada.',
          },
        });
        return;
      }

      const qrCode = await whatsappBrokerClient.getQrCode(instance.brokerId, { instanceId: instance.id });
      const context = await resolveInstanceOperationContext(tenantId, instance as StoredInstance, {
        fetchSnapshots: false,
      });

      const qr = normalizeQr({ ...context.qr, ...qrCode });

      res.json({
        success: true,
        data: {
          instance: context.instance,
          status: context.status,
          qr,
          instances: context.instances,
        },
      });
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// GET /api/integrations/whatsapp/instances/:id/qr.png - Fetch QR code image for a WhatsApp instance
router.get(
  '/whatsapp/instances/:id/qr.png',
  instanceIdParamValidator(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = req.params.id;
    const tenantId = req.user!.tenantId;

    try {
      const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

      if (!instance || instance.tenantId !== tenantId) {
        res.sendStatus(404);
        return;
      }

      const qrCode = await whatsappBrokerClient.getQrCode(instance.brokerId, { instanceId: instance.id });
      const normalized = normalizeQr(qrCode);
      const buffer = extractQrImageBuffer(normalized);

      if (!buffer) {
        res.sendStatus(404);
        return;
      }

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'private, max-age=5');
      res.send(buffer);
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// GET /api/integrations/whatsapp/instances/qr - Fetch QR code for the default WhatsApp instance
router.get(
  '/whatsapp/instances/qr',
  query('instanceId').optional().isString().trim().notEmpty(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const requestedInstanceId =
      typeof req.query.instanceId === 'string' ? req.query.instanceId.trim() : '';
    const instanceId = requestedInstanceId || resolveDefaultInstanceId();
    const tenantId = req.user!.tenantId;

    try {
      const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

      if (!instance || instance.tenantId !== tenantId) {
        res.status(404).json({
          success: false,
          error: {
            code: 'INSTANCE_NOT_FOUND',
            message: 'Instância WhatsApp não encontrada.',
          },
        });
        return;
      }

      const qrCode = await whatsappBrokerClient.getQrCode(instance.brokerId, { instanceId: instance.id });
      const context = await resolveInstanceOperationContext(tenantId, instance as StoredInstance, {
        fetchSnapshots: false,
      });

      const qr = normalizeQr({ ...context.qr, ...qrCode });

      res.json({
        success: true,
        data: {
          instanceId: context.instance.id,
          instance: context.instance,
          status: context.status,
          qr,
          connected: context.status.connected,
          instances: context.instances,
        },
      });
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// GET /api/integrations/whatsapp/instances/qr.png - Fetch QR code image for the default WhatsApp instance
router.get(
  '/whatsapp/instances/qr.png',
  query('instanceId').optional().isString().trim().notEmpty(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const requestedInstanceId =
      typeof req.query.instanceId === 'string' ? req.query.instanceId.trim() : '';
    const instanceId = requestedInstanceId || resolveDefaultInstanceId();
    const tenantId = req.user!.tenantId;

    try {
      const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

      if (!instance || instance.tenantId !== tenantId) {
        res.sendStatus(404);
        return;
      }

      const qrCode = await whatsappBrokerClient.getQrCode(instance.brokerId, { instanceId: instance.id });
      const normalized = normalizeQr(qrCode);
      const buffer = extractQrImageBuffer(normalized);

      if (!buffer) {
        res.sendStatus(404);
        return;
      }

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'private, max-age=5');
      res.send(buffer);
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// GET /api/integrations/whatsapp/instances/:id/status - Retrieve instance status
router.get(
  '/whatsapp/instances/:id/status',
  instanceIdParamValidator(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = req.params.id;
    const tenantId = req.user!.tenantId;

    try {
      const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

      if (!instance || instance.tenantId !== tenantId) {
        res.status(404).json({
          success: false,
          error: {
            code: 'INSTANCE_NOT_FOUND',
            message: 'Instância WhatsApp não encontrada.',
          },
        });
        return;
      }

      const context = await resolveInstanceOperationContext(tenantId, instance as StoredInstance, {
        refresh: true,
      });

      const derivedStatus = context.brokerStatus
        ? mapBrokerStatusToDbStatus(context.brokerStatus)
        : mapBrokerInstanceStatusToDbStatus(context.status.status);

      await prisma.whatsAppInstance.update({
        where: { id: context.stored.id },
        data: {
          status: derivedStatus,
          connected: context.status.connected,
          lastSeenAt: context.status.connected ? new Date() : context.stored.lastSeenAt,
        },
      });

      res.json({
        success: true,
        data: {
          instance: context.instance,
          status: context.status,
          connected: context.status.connected,
          qr: context.qr,
          instances: context.instances,
        },
      });
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/session/connect - Conectar sessão única
router.post(
  '/whatsapp/session/connect',
  body('webhookUrl').optional().isURL(),
  body('forceReopen').optional().isBoolean().toBoolean(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const sessionId = resolveTenantSessionId(tenantId);
    const { webhookUrl, forceReopen } = req.body as {
      webhookUrl?: string;
      forceReopen?: boolean;
    };

    try {
      await whatsappBrokerClient.connectSession(sessionId, {
        webhookUrl,
        forceReopen,
      });
      const status = await whatsappBrokerClient.getSessionStatus<BrokerSessionStatus>(sessionId);

      res.json({
        success: true,
        data: normalizeSessionStatus(status),
      });
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/session/logout - Desconectar sessão
router.post(
  '/whatsapp/session/logout',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const sessionId = resolveTenantSessionId(tenantId);

    try {
      await whatsappBrokerClient.logoutSession(sessionId);
      const status = await whatsappBrokerClient.getSessionStatus<BrokerSessionStatus>(sessionId);

      res.json({
        success: true,
        data: normalizeSessionStatus(status),
      });
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// GET /api/integrations/whatsapp/session/status - Status da sessão única
router.get(
  '/whatsapp/session/status',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const sessionId = resolveTenantSessionId(tenantId);

    try {
      const status = await whatsappBrokerClient.getSessionStatus<BrokerSessionStatus>(sessionId);

      res.json({
        success: true,
        data: normalizeSessionStatus(status),
      });
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/messages - Enviar mensagem de texto
router.post(
  '/whatsapp/messages',
  body('to').isString().isLength({ min: 1 }),
  body('message').isString().isLength({ min: 1 }),
  body('previewUrl').optional().isBoolean().toBoolean(),
  body('externalId').optional().isString().isLength({ min: 1 }),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const sessionId = resolveTenantSessionId(tenantId);
    const { to, message, previewUrl, externalId } = req.body as {
      to: string;
      message: string;
      previewUrl?: boolean;
      externalId?: string;
    };

    try {
      const result = await whatsappBrokerClient.sendText<{
        externalId?: string;
        status?: string;
        rate?: unknown;
      }>({
        sessionId,
        to,
        message,
        previewUrl,
        externalId,
      });

      res.status(202).json({
        success: true,
        data: {
          externalId: typeof result?.externalId === 'string' ? result.externalId : null,
          status: typeof result?.status === 'string' ? result.status : 'queued',
          rate: parseRateLimit(result?.rate ?? null),
        },
      });
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/polls - Criar enquete
router.post(
  '/whatsapp/polls',
  body('to').isString().isLength({ min: 1 }),
  body('question').isString().isLength({ min: 1 }),
  body('options').isArray({ min: 2 }),
  body('options.*').isString().isLength({ min: 1 }),
  body('allowMultipleAnswers').optional().isBoolean().toBoolean(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const sessionId = resolveTenantSessionId(tenantId);
    const { to, question, options, allowMultipleAnswers } = req.body as {
      to: string;
      question: string;
      options: string[];
      allowMultipleAnswers?: boolean;
    };

    try {
      const poll = await whatsappBrokerClient.createPoll<{ rate?: unknown } & Record<string, unknown>>({
        sessionId,
        to,
        question,
        options,
        allowMultipleAnswers,
      });

      res.status(201).json({
        success: true,
        data: {
          poll,
          rate: parseRateLimit(poll?.rate ?? null),
        },
      });
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// GET /api/integrations/whatsapp/events - Listar eventos pendentes
router.get(
  '/whatsapp/events',
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('cursor').optional().isString(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const { limit, cursor } = req.query as { limit?: number; cursor?: string };

    try {
      const events = await whatsappBrokerClient.fetchEvents<{
        events?: unknown[];
        items?: unknown[];
        nextCursor?: string | null;
        nextId?: string | null;
        rate?: BrokerRateLimit | Record<string, unknown> | null;
      }>({
        limit,
        cursor,
      });

      const items = Array.isArray(events?.items)
        ? events.items
        : Array.isArray(events?.events)
          ? events.events
          : [];

      const nextCursorValue =
        typeof events?.nextCursor === 'string' && events.nextCursor.trim().length > 0
          ? events.nextCursor.trim()
          : typeof events?.nextId === 'string' && events.nextId.trim().length > 0
            ? events.nextId.trim()
            : null;

      res.json({
        success: true,
        data: {
          items,
          nextCursor: nextCursorValue,
          rate: parseRateLimit(events?.rate ?? null),
        },
      });
    } catch (error: unknown) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/events/ack - Confirmar processamento de eventos
router.post(
  '/whatsapp/events/ack',
  body('eventIds').isArray({ min: 1 }),
  body('eventIds.*').isString().isLength({ min: 1 }),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const { eventIds } = req.body as { eventIds: string[] };

    try {
      await whatsappBrokerClient.ackEvents({ ids: eventIds });

      res.json({
        success: true,
      });
    } catch (error) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }
      throw error;
    }
  })
);

// ============================================================================
// Health Check Routes
// ============================================================================

// GET /api/integrations/health - Health check das integrações
router.get(
  '/health',
  asyncHandler(async (_req: Request, res: Response) => {
    // TODO: Implementar health checks reais
    const health = {
      whatsapp: {
        status: 'healthy',
        instances: 2,
        connectedInstances: 1
      },
      timestamp: new Date()
    };

    res.json({
      success: true,
      data: health
    });
  })
);

export const __testing = {
  collectNumericFromSources,
  locateStatusCountsCandidate,
  normalizeStatusCountsData,
  locateRateSourceCandidate,
  normalizeRateUsageData,
  serializeStoredInstance,
};

export { router as integrationsRouter };
