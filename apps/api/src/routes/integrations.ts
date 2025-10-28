// --- Controls and limits ---
const SYNC_TTL_MS = 30_000; // 30s cooldown for broker sync per tenant unless forced
const MAX_BFS_NODES = 5000; // hard cap for BFS scanners
const LAST_SYNC_KEY_PREFIX = 'whatsapp:instances:lastSync:tenant:';
const SNAPSHOT_CACHE_KEY_PREFIX = 'whatsapp:instances:snapshotCache:tenant:';

const getLastSyncAt = async (tenantId: string): Promise<Date | null> => {
  const key = `${LAST_SYNC_KEY_PREFIX}${tenantId}`;
  try {
    const rec = await prisma.integrationState.findUnique({ where: { key }, select: { value: true } });
    if (!rec?.value || typeof rec.value !== 'object' || rec.value === null) return null;
    const v = (rec.value as Record<string, unknown>).lastSyncAt;
    if (typeof v !== 'string') return null;
    const ts = Date.parse(v);
    return Number.isFinite(ts) ? new Date(ts) : null;
  } catch (error) {
    if (logWhatsAppStorageError('getLastSyncAt', error, { tenantId, key })) {
      return null;
    }
    throw error;
  }
};

const setLastSyncAt = async (tenantId: string, at: Date): Promise<void> => {
  const key = `${LAST_SYNC_KEY_PREFIX}${tenantId}`;
  const value: Prisma.JsonObject = { lastSyncAt: at.toISOString() };
  try {
    await prisma.integrationState.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  } catch (error) {
    if (logWhatsAppStorageError('setLastSyncAt', error, { tenantId, key })) {
      return;
    }
    throw error;
  }
};

type CachedSnapshots = { expiresAt: string; snapshots: WhatsAppBrokerInstanceSnapshot[] };

const getCachedSnapshots = async (tenantId: string): Promise<WhatsAppBrokerInstanceSnapshot[] | null> => {
  const key = `${SNAPSHOT_CACHE_KEY_PREFIX}${tenantId}`;
  try {
    const rec = await prisma.integrationState.findUnique({ where: { key }, select: { value: true } });
    if (!rec?.value || typeof rec.value !== 'object' || rec.value === null) return null;
    const v = rec.value as Record<string, unknown>;
    const expiresAt = typeof v.expiresAt === 'string' ? Date.parse(v.expiresAt) : NaN;
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
    const raw = (v.snapshots ?? null) as unknown;
    return Array.isArray(raw) ? (raw as WhatsAppBrokerInstanceSnapshot[]) : null;
  } catch (error) {
    if (logWhatsAppStorageError('getCachedSnapshots', error, { tenantId, key })) {
      return null;
    }
    throw error;
  }
};

const setCachedSnapshots = async (tenantId: string, snapshots: WhatsAppBrokerInstanceSnapshot[], ttlSeconds = 30): Promise<void> => {
  const key = `${SNAPSHOT_CACHE_KEY_PREFIX}${tenantId}`;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const value: Prisma.JsonObject = { expiresAt, snapshots: snapshots as unknown as Prisma.JsonArray };
  try {
    await prisma.integrationState.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  } catch (error) {
    if (logWhatsAppStorageError('setCachedSnapshots', error, { tenantId, key })) {
      return;
    }
    throw error;
  }
};

const removeCachedSnapshot = async (
  tenantId: string,
  instanceId: string,
  brokerId?: string | null
): Promise<void> => {
  const snapshots = await getCachedSnapshots(tenantId);
  if (!snapshots?.length) {
    return;
  }

  const normalizedInstanceId = instanceId.trim().toLowerCase();
  const normalizedBrokerId = brokerId?.trim().toLowerCase();

  const filtered = snapshots.filter((snapshot) => {
    const rawId = snapshot.instance?.id ?? '';
    const normalized = typeof rawId === 'string' ? rawId.trim().toLowerCase() : '';
    if (normalized && normalized === normalizedInstanceId) {
      return false;
    }
    if (normalizedBrokerId && normalized && normalized === normalizedBrokerId) {
      return false;
    }
    return true;
  });

  if (filtered.length === snapshots.length) {
    return;
  }

  try {
    await setCachedSnapshots(tenantId, filtered, 30);
  } catch (error) {
    if (!logWhatsAppStorageError('removeCachedSnapshot', error, { tenantId, instanceId, brokerId })) {
      throw error;
    }
  }
};
import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import {
  Prisma,
  WhatsAppInstanceStatus,
  type WhatsAppInstance as PrismaWhatsAppInstance,
} from '@prisma/client';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { z, type ZodIssue } from 'zod';
import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  whatsappBrokerClient,
  WhatsAppBrokerNotConfiguredError,
  WhatsAppBrokerError,
  type WhatsAppStatus,
  type WhatsAppBrokerInstanceSnapshot,
  type WhatsAppInstance as BrokerWhatsAppInstance,
  type DeleteInstanceOptions,
} from '../services/whatsapp-broker-client';
import { emitToTenant } from '../lib/socket-registry';
import { prisma } from '../lib/prisma';
import { logger } from '../config/logger';
import { respondWithValidationError } from '../utils/http-validation';
import { normalizePhoneNumber, PhoneNormalizationError } from '../utils/phone';
import { whatsappHttpRequestsCounter } from '../lib/metrics';
import { getMvpBypassTenantId } from '../config/feature-flags';
import { getWhatsAppTransport } from '../features/whatsapp-transport';
import { invalidateCampaignCache } from '../features/whatsapp-inbound/services/inbound-lead-service';

const normalizeQueryValue = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    return normalizeQueryValue(value[0]);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
};

const normalizeBooleanValue = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (['1', 'true', 'yes', 'y', 'sim'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'n', 'nao', 'não'].includes(normalized)) {
      return false;
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }

  return null;
};

const readInstanceIdParam = (req: Request): string | null => {
  const raw = req.params?.id;
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveRequestTenantId = (req: Request): string => {
  const queryTenant = normalizeQueryValue(req.query.tenantId);
  if (queryTenant) {
    return queryTenant;
  }

  const headerTenant = normalizeQueryValue(req.headers['x-tenant-id']);
  if (headerTenant) {
    return headerTenant;
  }

  const userTenant = typeof req.user?.tenantId === 'string' ? req.user.tenantId.trim() : '';
  if (userTenant.length > 0) {
    return userTenant;
  }

  const fallbackTenant = getMvpBypassTenantId();
  if (fallbackTenant) {
    return fallbackTenant;
  }

  return 'demo-tenant';
};

const resolveRequestActorId = (req: Request): string => {
  const userId = typeof req.user?.id === 'string' ? req.user.id.trim() : '';
  return userId.length > 0 ? userId : 'system';
};

const respondWhatsAppNotConfigured = (res: Response, error: unknown): boolean => {
  if (error instanceof WhatsAppBrokerNotConfiguredError) {
    res.locals.errorCode = 'WHATSAPP_NOT_CONFIGURED';
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

const DATABASE_DISABLED_ERROR_CODES = new Set([
  'DATABASE_DISABLED',
  'STORAGE_DATABASE_DISABLED',
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

const isDatabaseDisabledError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }

  if (hasErrorName(error, 'DatabaseDisabledError')) {
    return true;
  }

  const code = readPrismaErrorCode(error);
  if (code && DATABASE_DISABLED_ERROR_CODES.has(code)) {
    return true;
  }

  if (
    typeof error === 'object' &&
    'code' in (error as Record<string, unknown>) &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    const normalized = ((error as { code?: string }).code ?? '').toString().trim();
    if (DATABASE_DISABLED_ERROR_CODES.has(normalized)) {
      return true;
    }
  }

  return false;
};

const resolveWhatsAppStorageError = (
  error: unknown
): { isStorageError: boolean; prismaCode: string | null } => {
  if (isDatabaseDisabledError(error)) {
    return { isStorageError: true, prismaCode: 'DATABASE_DISABLED' };
  }

  const prismaCode = readPrismaErrorCode(error);

  if (prismaCode && PRISMA_STORAGE_ERROR_CODES.has(prismaCode)) {
    return { isStorageError: true, prismaCode };
  }

  if (
    hasErrorName(error, 'PrismaClientInitializationError') ||
    hasErrorName(error, 'PrismaClientRustPanicError')
  ) {
    return { isStorageError: true, prismaCode: null };
  }

  return { isStorageError: false, prismaCode: null };
};

const respondWhatsAppStorageUnavailable = (res: Response, error: unknown): boolean => {
  const { isStorageError, prismaCode } = resolveWhatsAppStorageError(error);

  if (!isStorageError) {
    return false;
  }

  const storageDisabled = prismaCode === 'DATABASE_DISABLED';

  if (storageDisabled) {
    res.locals.errorCode = 'DATABASE_DISABLED';
    res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_DISABLED',
        message: 'Persistência das instâncias WhatsApp está desabilitada neste ambiente.',
      },
    });
    return true;
  }

  res.locals.errorCode = 'WHATSAPP_STORAGE_UNAVAILABLE';
  res.status(503).json({
    success: false,
    error: {
      code: 'WHATSAPP_STORAGE_UNAVAILABLE',
      message:
        'Serviço de armazenamento das instâncias WhatsApp indisponível. Verifique a conexão com o banco ou execute as migrações pendentes.',
      ...(prismaCode ? { details: { prismaCode } } : {}),
    },
  });
  return true;
};

const describeErrorForLog = (error: unknown): unknown => {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }

  if (typeof error === 'object' && error !== null) {
    return error;
  }

  return { value: error };
};

function logWhatsAppStorageError(
  operation: string,
  error: unknown,
  context: Record<string, unknown> = {}
): boolean {
  const { isStorageError, prismaCode } = resolveWhatsAppStorageError(error);

  if (!isStorageError) {
    return false;
  }

  logger.warn(`whatsapp.storage.${operation}.failed`, {
    operation,
    ...(prismaCode ? { prismaCode } : {}),
    ...context,
    error: describeErrorForLog(error),
  });

  return true;
}

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
        const request = req as Request;
        (request.params as Record<string, string>).id = decoded;
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

type WhatsAppDisconnectRetryJob = {
  instanceId: string;
  tenantId: string;
  requestedAt: string;
  status: number | null;
  requestId: string | null;
  wipe: boolean;
};

type WhatsAppDisconnectRetryState = {
  jobs: WhatsAppDisconnectRetryJob[];
};

const WHATSAPP_DISCONNECT_RETRY_KEY_PREFIX = 'whatsapp:disconnect:retry:tenant:';
const MAX_DISCONNECT_RETRY_JOBS = 20;
const WHATSAPP_INSTANCE_ARCHIVE_KEY_PREFIX = 'whatsapp:instance:archive:';

const readDisconnectRetryState = (value: unknown): WhatsAppDisconnectRetryState | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const source = value as { jobs?: unknown };
  const jobsSource = Array.isArray(source.jobs) ? source.jobs : [];
  const jobs: WhatsAppDisconnectRetryJob[] = [];

  for (const entry of jobsSource) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const instanceId = typeof record.instanceId === 'string' ? record.instanceId.trim() : '';
    const tenantId = typeof record.tenantId === 'string' ? record.tenantId.trim() : '';
    const requestedAt = typeof record.requestedAt === 'string' ? record.requestedAt : '';
    const status = typeof record.status === 'number' ? record.status : null;
    const requestId = typeof record.requestId === 'string' ? record.requestId.trim() : null;
    const wipe = typeof record.wipe === 'boolean' ? record.wipe : false;

    if (!instanceId || !tenantId || !requestedAt) {
      continue;
    }

    jobs.push({ instanceId, tenantId, requestedAt, status, requestId, wipe });
  }

  return { jobs };
};

const scheduleWhatsAppDisconnectRetry = async (
  tenantId: string,
  job: Omit<WhatsAppDisconnectRetryJob, 'tenantId'>
): Promise<void> => {
  const key = `${WHATSAPP_DISCONNECT_RETRY_KEY_PREFIX}${tenantId}`;
  const normalizedJob: WhatsAppDisconnectRetryJob = {
    tenantId,
    instanceId: job.instanceId,
    status: Number.isFinite(job.status) ? (job.status as number) : null,
    requestId: job.requestId ?? null,
    wipe: Boolean(job.wipe),
    requestedAt:
      typeof job.requestedAt === 'string' && job.requestedAt.trim().length > 0
        ? job.requestedAt
        : new Date().toISOString(),
  };

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.integrationState.findUnique({ where: { key } });
      const currentState = readDisconnectRetryState(existing?.value) ?? { jobs: [] };
      const nextJobs = currentState.jobs.filter((entry) => entry.instanceId !== normalizedJob.instanceId);
      nextJobs.push(normalizedJob);

      const trimmedJobs = nextJobs.slice(-MAX_DISCONNECT_RETRY_JOBS);
      const jobsPayload: Prisma.JsonArray = trimmedJobs.map((job): Prisma.JsonObject => ({
        instanceId: job.instanceId,
        tenantId: job.tenantId,
        requestedAt: job.requestedAt,
        status: job.status,
        requestId: job.requestId,
        wipe: job.wipe,
      }));

      const value: Prisma.JsonObject = {
        jobs: jobsPayload,
      };

      if (existing) {
        await tx.integrationState.update({
          where: { key },
          data: { value },
        });
        return;
      }

      await tx.integrationState.create({
        data: {
          key,
          value,
        },
      });
    });
  } catch (error) {
    if (!logWhatsAppStorageError('scheduleDisconnectRetry', error, { tenantId, key })) {
      throw error;
    }
  }
};

const clearWhatsAppDisconnectRetry = async (
  tenantId: string,
  instanceId: string,
  client: PrismaTransactionClient | typeof prisma = prisma
): Promise<void> => {
  const key = `${WHATSAPP_DISCONNECT_RETRY_KEY_PREFIX}${tenantId}`;
  let existing;
  try {
    existing = await client.integrationState.findUnique({ where: { key } });
  } catch (error) {
    if (logWhatsAppStorageError('clearDisconnectRetry.read', error, { tenantId, key })) {
      return;
    }
    throw error;
  }
  const currentState = readDisconnectRetryState(existing?.value) ?? { jobs: [] };
  const remaining = currentState.jobs.filter((job) => job.instanceId !== instanceId);

  if (!existing) {
    return;
  }

  if (remaining.length === 0) {
    try {
      await client.integrationState.delete({ where: { key } });
    } catch (error) {
      if (
        !hasErrorName(error, 'PrismaClientKnownRequestError') &&
        !logWhatsAppStorageError('clearDisconnectRetry.delete', error, { tenantId, key })
      ) {
        throw error;
      }
    }
    return;
  }

  const jobsPayload: Prisma.JsonArray = remaining.map((job): Prisma.JsonObject => ({
    instanceId: job.instanceId,
    tenantId: job.tenantId,
    requestedAt: job.requestedAt,
    status: job.status,
    requestId: job.requestId,
    wipe: job.wipe,
  }));

  try {
    await client.integrationState.update({
      where: { key },
      data: { value: { jobs: jobsPayload } as Prisma.JsonObject },
    });
  } catch (error) {
    if (!logWhatsAppStorageError('clearDisconnectRetry.update', error, { tenantId, key })) {
      throw error;
    }
  }
};

const readBrokerErrorStatus = (error: unknown): number | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }

  if ('brokerStatus' in error && typeof (error as { brokerStatus?: unknown }).brokerStatus === 'number') {
    return (error as { brokerStatus: number }).brokerStatus;
  }

  if ('status' in error && typeof (error as { status?: unknown }).status === 'number') {
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

const readBrokerErrorMessage = (error: unknown): string | null => {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    const normalized = ((error as { message: string }).message || '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  return null;
};

const BROKER_ALREADY_CONNECTED_CODES = new Set([
  'SESSION_ALREADY_CONNECTED',
  'SESSION_ALREADY_OPEN',
  'SESSION_OPEN',
  'ALREADY_CONNECTED',
  'SESSION_INITIALIZED',
  'SESSION_ALREADY_INITIALIZED',
]);

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

const includesBrokerMessageKeyword = (message: string | null, keywords: string[]): boolean => {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
};

const isBrokerAlreadyConnectedError = (error: unknown): boolean => {
  const code = readBrokerErrorCode(error);
  if (code && BROKER_ALREADY_CONNECTED_CODES.has(code)) {
    return true;
  }

  const message = readBrokerErrorMessage(error);
  if (
    includesBrokerMessageKeyword(message, [
      'already connected',
      'already logged in',
      'session already open',
      'já conectad',
      'sessão já conectada',
    ])
  ) {
    return true;
  }

  const status = readBrokerErrorStatus(error);
  return status === 409 && includesBrokerMessageKeyword(message, ['connected', 'session open']);
};

const isBrokerAlreadyDisconnectedError = (error: unknown): boolean => {
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

const respondWhatsAppBrokerFailure = (res: Response, error: WhatsAppBrokerError): void => {
  res.status(502).json({
    success: false,
    error: {
      code: error.code || 'BROKER_ERROR',
      message: error.message || 'WhatsApp broker request failed',
      details: compactRecord({
        status: readBrokerErrorStatus(error),
        requestId: error.requestId ?? undefined,
      }),
    },
  });
};

const respondLegacyEndpointGone = (res: Response, message: string): void => {
  res.status(410).json({
    success: false,
    error: {
      code: 'ENDPOINT_GONE',
      message,
    },
  });
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

const buildInstanceArchiveKey = (tenantId: string, instanceId: string): string => {
  return `${WHATSAPP_INSTANCE_ARCHIVE_KEY_PREFIX}${tenantId}:${instanceId}`;
};

type InstanceArchiveInput = {
  tenantId: string;
  stored: StoredInstance;
  context: InstanceOperationContext;
  actorId: string;
  deletedAt: string;
};

const archiveInstanceSnapshot = async (
  client: PrismaTransactionClient | typeof prisma,
  input: InstanceArchiveInput
): Promise<void> => {
  const { tenantId, stored, context, actorId, deletedAt } = input;
  const key = buildInstanceArchiveKey(tenantId, stored.id);

  const serialized = serializeStoredInstance(context.stored, context.brokerStatus);

  const history =
    Array.isArray((stored.metadata as Record<string, unknown> | null)?.history) && (stored.metadata as Record<string, unknown> | null)?.history
      ? ((stored.metadata as Record<string, unknown>).history as unknown[])
      : [];

  const archivePayload: Prisma.JsonObject = {
    tenantId,
    instanceId: stored.id,
    brokerId: stored.brokerId,
    deletedAt,
    actorId,
    stored: toJsonObject(serialized),
    status: toJsonValue(context.status) ?? null,
    qr: toJsonValue(context.qr) ?? null,
    brokerStatus: toJsonValue(context.brokerStatus) ?? null,
    history: toJsonArray(history),
    instancesBeforeDeletion: toJsonArray(context.instances),
  };

  try {
    await client.integrationState.upsert({
      where: { key },
      update: { value: archivePayload },
      create: { key, value: archivePayload },
    });
  } catch (error) {
    if (!logWhatsAppStorageError('archiveInstanceSnapshot', error, { tenantId, key, instanceId: stored.id })) {
      throw error;
    }
  }
};

type InstanceArchiveRecord = {
  deletedAt: string | null;
};

const readInstanceArchives = async (
  tenantId: string,
  instanceIds: string[]
): Promise<Map<string, InstanceArchiveRecord>> => {
  const normalizedIds = Array.from(
    new Set(
      instanceIds
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0)
    )
  );

  if (normalizedIds.length === 0) {
    return new Map();
  }

  const keyPrefix = `${WHATSAPP_INSTANCE_ARCHIVE_KEY_PREFIX}${tenantId}:`;
  const keys = normalizedIds.map((instanceId) => `${keyPrefix}${instanceId}`);

  let rows;
  try {
    rows = await prisma.integrationState.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });
  } catch (error) {
    if (logWhatsAppStorageError('readInstanceArchives', error, { tenantId, keysCount: keys.length })) {
      return new Map();
    }
    throw error;
  }

  const archives = new Map<string, InstanceArchiveRecord>();

  for (const row of rows) {
    if (!row.key.startsWith(keyPrefix)) {
      continue;
    }

    const rawInstanceId = row.key.slice(keyPrefix.length);
    if (!rawInstanceId) {
      continue;
    }

    const instanceId = rawInstanceId.trim();
    if (!instanceId) {
      continue;
    }

    let deletedAt: string | null = null;
    const value = row.value;
    if (value && typeof value === 'object') {
      const raw = value as Record<string, unknown>;
      if (typeof raw.deletedAt === 'string') {
        const trimmed = raw.deletedAt.trim();
        if (trimmed.length > 0) {
          deletedAt = raw.deletedAt;
        }
      }
    }

    archives.set(instanceId, { deletedAt });
  }

  return archives;
};

const clearInstanceArchive = async (tenantId: string, instanceId: string): Promise<void> => {
  const normalized = typeof instanceId === 'string' ? instanceId.trim() : '';
  if (!normalized) {
    return;
  }

  const key = buildInstanceArchiveKey(tenantId, normalized);

  try {
    await prisma.integrationState.delete({ where: { key } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return;
    }

    if (!logWhatsAppStorageError('clearInstanceArchive', error, { tenantId, instanceId: normalized })) {
      throw error;
    }
  }
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

const toJsonValue = (value: unknown): Prisma.JsonValue => {
  if (value === null || value === Prisma.JsonNull) {
    return null;
  }

  if (value === undefined) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'bigint') {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }

  if (Array.isArray(value)) {
    const jsonArray: Prisma.JsonArray = value.map((entry) => toJsonValue(entry));
    return jsonArray;
  }

  if (typeof value === 'object') {
    const jsonObject: Prisma.JsonObject = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      jsonObject[key] = toJsonValue(entry);
    }
    return jsonObject;
  }

  return null;
};

const toJsonObject = (value: unknown): Prisma.JsonObject => {
  const json = toJsonValue(value);
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    return json as Prisma.JsonObject;
  }
  return {};
};

const toJsonArray = (value: unknown): Prisma.JsonArray => {
  const json = toJsonValue(value);
  return Array.isArray(json) ? (json as Prisma.JsonArray) : [];
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
    try {
      const normalized = normalizePhoneNumber(phone);
      return normalized.e164 as string;
    } catch (e) {
      if (!(e instanceof PhoneNormalizationError)) {
        logger.warn('whatsapp.instances.phone.normalizeUnexpected', { tenantId: instance.tenantId, error: String(e) });
      }
      // fallback: extract digits and prefix once
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

  let metrics: Record<string, unknown> | null =
    mergeRecords(
      asRecord(brokerStatus?.metrics),
      asRecord(brokerStatus?.rateUsage),
      asRecord(rawStatus?.metrics),
      asRecord(rawStatus?.messages),
      asRecord(rawStatus?.stats)
    ) ?? null;

  const baseMetadata = (instance.metadata as Record<string, unknown> | null) ?? {};
  const cachedNormalized = typeof baseMetadata.normalizedMetrics === 'object' ? (baseMetadata.normalizedMetrics as Record<string, unknown>) : null;

  const brokerBroughtNewMetrics =
    Boolean(brokerStatus?.metrics) || Boolean(brokerStatus?.rateUsage) ||
    Boolean(rawStatus?.metrics)   || Boolean(rawStatus?.messages)   || Boolean(rawStatus?.stats);

  if (!brokerBroughtNewMetrics && cachedNormalized && (!metrics || Object.keys(metrics).length === 0)) {
    metrics = { ...cachedNormalized };
  }

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
    logger.info('whatsapp.instances.sync.brokerEmpty', { tenantId });
    return { instances: existing, snapshots: brokerSnapshots };
  }

  const snapshotInstanceIds = brokerSnapshots
    .map((snapshot) => (typeof snapshot.instance?.id === 'string' ? snapshot.instance.id : ''))
    .filter((value) => value.length > 0);
  const archivedInstances = await readInstanceArchives(tenantId, snapshotInstanceIds);

  const existingById = new Map(existing.map((item) => [item.id, item]));
  const existingByBrokerId = new Map<string, StoredInstance>();

  for (const item of existing) {
    if (typeof item.brokerId !== 'string') {
      continue;
    }

    const trimmed = item.brokerId.trim();
    if (trimmed.length === 0) {
      continue;
    }

    existingByBrokerId.set(trimmed, item);
  }

  logger.info('whatsapp.instances.sync.snapshot', {
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

  const createdPayload: Array<{ id: string; status: WhatsAppInstanceStatus; connected: boolean; phoneNumber: string | null }> = [];
  const updatedPayload: Array<{ id: string; status: WhatsAppInstanceStatus; connected: boolean; phoneNumber: string | null }> = [];
  const unchangedIds: string[] = [];

  for (const snapshot of brokerSnapshots) {
    const brokerInstance = snapshot.instance;
    const brokerStatus = snapshot.status ?? null;
    const instanceId = typeof brokerInstance.id === 'string' ? brokerInstance.id.trim() : '';
    if (!instanceId) {
      continue;
    }

    const existingInstance = existingById.get(instanceId) ?? existingByBrokerId.get(instanceId) ?? null;
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
      const statusChanged = existingInstance.status !== derivedStatus;
      const connectedChanged = existingInstance.connected !== derivedConnected;
      const phoneChanged = (existingInstance.phoneNumber ?? null) !== (phoneNumber ?? null);
      const hasChange = statusChanged || connectedChanged || phoneChanged;
      // Sempre persistimos histórico/snapshot mesmo sem alteração de status para manter auditoria.
      const metadataShouldPersist = true;

      if (hasChange || metadataShouldPersist) {
        logger.info('whatsapp.instances.sync.updateStored', {
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
        const brokerNameCandidate =
          typeof brokerInstance.name === 'string' ? brokerInstance.name.trim() : '';
        const hasBrokerName = brokerNameCandidate.length > 0;
        const existingDisplayName =
          typeof existingInstance.name === 'string' && existingInstance.name.trim().length > 0
            ? existingInstance.name.trim()
            : null;

        if (hasBrokerName && existingDisplayName && existingDisplayName !== brokerNameCandidate) {
          logger.debug('whatsapp.instances.sync.preserveStoredName', {
            tenantId,
            instanceId,
            storedName: existingDisplayName,
            brokerNameCandidate,
            reason: 'preserve-user-defined-name',
          });
        } else if (hasBrokerName && !existingDisplayName) {
          logger.debug('whatsapp.instances.sync.useBrokerDisplayNameFallback', {
            tenantId,
            instanceId,
            brokerNameCandidate,
            reason: 'no-stored-name',
          });
        }

        const metadataNickname =
          typeof metadataWithHistory.displayName === 'string' && metadataWithHistory.displayName.trim().length > 0
            ? metadataWithHistory.displayName.trim()
            : null;
        const preservedDisplayName =
          metadataNickname ?? existingDisplayName ?? (hasBrokerName ? brokerNameCandidate : instanceId);
        metadataWithHistory.displayName = preservedDisplayName;
        metadataWithHistory.label = preservedDisplayName;
        const metadataWithoutError = withInstanceLastError(metadataWithHistory, null);

        const updateData: Prisma.WhatsAppInstanceUpdateArgs['data'] = {
          tenantId,
          status: derivedStatus,
          connected: derivedConnected,
          brokerId: instanceId,
          ...(phoneNumber ? { phoneNumber } : {}),
          ...(derivedLastSeenAt ? { lastSeenAt: derivedLastSeenAt } : {}),
          metadata: metadataWithoutError,
        };

        await prisma.whatsAppInstance.update({
          where: { id: existingInstance.id },
          data: updateData,
        });

        if (hasChange) {
          updatedPayload.push({
            id: existingInstance.id,
            status: derivedStatus,
            connected: derivedConnected,
            phoneNumber,
          });
        } else {
          unchangedIds.push(existingInstance.id);
        }
      } else {
        unchangedIds.push(existingInstance.id);
      }
    } else {
      const archiveRecord = archivedInstances.get(instanceId);
      if (archiveRecord?.deletedAt) {
        logger.info('whatsapp.instances.sync.skipDeleted', {
          tenantId,
          instanceId,
          deletedAt: archiveRecord.deletedAt,
        });
        continue;
      }

      logger.info('whatsapp.instances.sync.createMissing', {
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
      const snapshotDisplayName =
        typeof brokerInstance.name === 'string' && brokerInstance.name.trim().length > 0
          ? brokerInstance.name.trim()
          : instanceId;
      metadataWithHistory.displayName = snapshotDisplayName;
      metadataWithHistory.label = snapshotDisplayName;
      metadataWithHistory.slug = instanceId;
      const metadataWithoutError = withInstanceLastError(metadataWithHistory, null);

      await prisma.whatsAppInstance.create({
        data: {
          id: instanceId,
          tenantId,
          name: snapshotDisplayName,
          brokerId: instanceId,
          status: derivedStatus,
          connected: derivedConnected,
          phoneNumber,
          ...(derivedLastSeenAt ? { lastSeenAt: derivedLastSeenAt } : {}),
          metadata: metadataWithoutError,
        },
      });

      createdPayload.push({
        id: instanceId,
        status: derivedStatus,
        connected: derivedConnected,
        phoneNumber,
      });
    }
  }

  const refreshed = (await prisma.whatsAppInstance.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
  })) as StoredInstance[];

  emitToTenant(tenantId, 'whatsapp.instances.synced', {
    syncedAt: new Date().toISOString(),
    created: createdPayload,
    updated: updatedPayload,
    unchanged: unchangedIds,
    count: {
      created: createdPayload.length,
      updated: updatedPayload.length,
      unchanged: unchangedIds.length
    }
  });

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
  // observability
  shouldRefresh?: boolean;
  fetchSnapshots?: boolean;
  synced?: boolean;
};

const toPublicInstance = (
  value: ReturnType<typeof serializeStoredInstance>
): NormalizedInstance => {
  const { brokerId: _brokerId, ...publicInstance } = value;
  return publicInstance;
};

const buildFallbackInstancesFromSnapshots = (
  tenantId: string,
  snapshots: WhatsAppBrokerInstanceSnapshot[]
): NormalizedInstance[] => {
  const instances: NormalizedInstance[] = [];

  for (const snapshot of snapshots) {
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
        tenantId: normalized.tenantId ?? snapshot.instance?.tenantId ?? tenantId ?? null,
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
      tenantId: instanceSource.tenantId ?? tenantId ?? null,
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

const collectInstancesForTenant = async (
  tenantId: string,
  options: InstanceCollectionOptions = {}
): Promise<InstanceCollectionResult> => {
  const refreshFlag = options.refresh;
  const fetchSnapshots = options.fetchSnapshots ?? false;

  // Load stored instances first (DB)
  let storedInstances =
    options.existing ??
    ((await prisma.whatsAppInstance.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    })) as StoredInstance[]);

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

  // TTL: only applies when refresh wasn't explicitly forced
  if (shouldRefresh && refreshFlag !== true) {
    const last = await getLastSyncAt(tenantId);
    if (last && Date.now() - last.getTime() < SYNC_TTL_MS) {
      shouldRefresh = false;
    }
  }

  let synced = false;

  if (shouldRefresh) {
    try {
      try { whatsappHttpRequestsCounter?.inc?.(); } catch {}
      const syncResult = await syncInstancesFromBroker(
        tenantId,
        storedInstances,
        snapshots ?? undefined
      );
      storedInstances = syncResult.instances;
      snapshots = syncResult.snapshots;
      await setLastSyncAt(tenantId, new Date());
      // cache snapshots for short TTL to reduce pressure
      if (snapshots && snapshots.length > 0) {
        await setCachedSnapshots(tenantId, snapshots, 30);
      }
      synced = true;
    } catch (error) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        if (options.refresh) {
          throw error;
        }
        logger.info('whatsapp.instances.sync.brokerNotConfigured', { tenantId });
        snapshots = [];
      } else {
        throw error;
      }
    }
  } else if (fetchSnapshots) {
    // Snapshot mode (read-only): use cache first, then broker, and cache the result
    if (!snapshots) {
      snapshots = await getCachedSnapshots(tenantId);
    }
    if (!snapshots) {
      try {
        try { whatsappHttpRequestsCounter?.inc?.(); } catch {}
        snapshots = await whatsappBrokerClient.listInstances(tenantId);
        if (snapshots && snapshots.length > 0) {
          await setCachedSnapshots(tenantId, snapshots, 30);
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

  for (const stored of storedInstances) {
    const snapshot = snapshotMap.get(stored.id) ??
      (stored.brokerId ? snapshotMap.get(stored.brokerId) : undefined);
    const brokerStatus = snapshot?.status ?? null;
    const serialized = serializeStoredInstance(stored, brokerStatus);

    // Keep E.164 normalized phone in DB when we discover a better one
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

  const result: InstanceCollectionResult = {
    entries,
    instances,
    rawInstances: entries.map(({ serialized }) => serialized),
    map,
    snapshots: snapshots ?? [],
    shouldRefresh,
    fetchSnapshots,
    synced,
  };

  return result;
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
  qr: ReturnType<typeof normalizeQr>;
  instance: NormalizedInstance;
  instances: NormalizedInstance[];
  brokerStatus: WhatsAppStatus | null;
};

const buildInstanceStatusPayload = (
  context: InstanceOperationContext,
  overrideQr?: ReturnType<typeof normalizeQr>
): InstanceStatusResponsePayload => {
  const qr = overrideQr ?? context.qr;
  const status = {
    ...context.status,
    qr: qr.qr,
    qrCode: qr.qrCode,
    qrExpiresAt: qr.qrExpiresAt,
    expiresAt: qr.expiresAt,
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

const fetchStatusWithBrokerQr = async (
  tenantId: string,
  stored: StoredInstance,
  options: { refresh?: boolean; fetchSnapshots?: boolean } = {}
): Promise<{ context: InstanceOperationContext; qr: ReturnType<typeof normalizeQr> }> => {
  const context = await resolveInstanceOperationContext(tenantId, stored, {
    refresh: options.refresh,
    fetchSnapshots: options.fetchSnapshots,
  });

  try {
    try {
      whatsappHttpRequestsCounter?.inc?.();
    } catch {
      // metrics are best effort
    }

    const brokerQr = await whatsappBrokerClient.getQrCode(stored.brokerId ?? stored.id, {
      instanceId: stored.id,
    });
    const qr = normalizeQr(brokerQr);

    return { context, qr };
  } catch (error) {
    // ensure context is returned alongside broker errors when needed
    (error as { __context__?: InstanceOperationContext }).__context__ = context;
    throw error;
  }
};

type DisconnectStoredInstanceResult =
  | { outcome: 'success'; context: InstanceOperationContext }
  | {
      outcome: 'retry';
      retry: { scheduledAt: string; status: number; requestId: string | null };
    };

const disconnectStoredInstance = async (
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

const deleteStoredInstance = async (
  tenantId: string,
  stored: StoredInstance,
  actorId: string
): Promise<DeleteStoredInstanceResult> => {
  const context = await resolveInstanceOperationContext(tenantId, stored, {
    refresh: false,
    fetchSnapshots: true,
  });

  const deletedAt = new Date().toISOString();

  await archiveInstanceSnapshot(prisma, { tenantId, stored, context, actorId, deletedAt });

  await prisma.$transaction(async (tx) => {
    await tx.campaign.updateMany({
      where: { tenantId, whatsappInstanceId: stored.id },
      data: { whatsappInstanceId: null },
    });

    await tx.whatsAppSession.deleteMany({ where: { instanceId: stored.id } });
    await tx.whatsAppInstance.delete({ where: { id: stored.id } });
  });

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

// POST /api/integrations/whatsapp/instances - Create WhatsApp instance
router.post(
  '/whatsapp/instances',
  requireTenant,
  body('name')
    .isString()
    .withMessage('Nome da instância é obrigatório.')
    .bail()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Nome da instância é obrigatório.'),
  body('id')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage(INVALID_INSTANCE_ID_MESSAGE)
    .bail()
    .trim()
    .isLength({ min: 1 })
    .withMessage(INVALID_INSTANCE_ID_MESSAGE),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = resolveRequestTenantId(req);
    const actorId = resolveRequestActorId(req);

    const bodyPayload = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const name = typeof bodyPayload.name === 'string' ? bodyPayload.name.trim() : '';
    const explicitId = typeof bodyPayload.id === 'string' ? bodyPayload.id.trim() : '';
    const instanceId = explicitId || name || resolveDefaultInstanceId();

    let existing: { id: string } | null = null;
    try {
      existing = await prisma.whatsAppInstance.findUnique({
        where: {
          tenantId_id: {
            tenantId,
            id: instanceId,
          },
        },
        select: { id: true },
      });
    } catch (error) {
      if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }
      throw error;
    }

    if (existing) {
      res.status(409).json({
        success: false,
        error: {
          code: 'INSTANCE_ALREADY_EXISTS',
          message: 'Já existe uma instância WhatsApp com esse identificador.',
        },
      });
      return;
    }

    logger.info('whatsapp.instances.create.request', {
      tenantId,
      actorId,
      name,
      instanceId,
    });

    let brokerInstance: BrokerWhatsAppInstance;
    try {
      try {
        whatsappHttpRequestsCounter?.inc?.();
      } catch {
        // metrics are best-effort
      }

      brokerInstance = await whatsappBrokerClient.createInstance({
        tenantId,
        name,
        instanceId,
      });
    } catch (error) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        if (handleWhatsAppIntegrationError(res, error)) {
          return;
        }
      }

      if (error instanceof WhatsAppBrokerError) {
        logger.error('whatsapp.instances.create.brokerFailed', {
          tenantId,
          actorId,
          instanceId,
          error: describeErrorForLog(error),
        });
        respondWhatsAppBrokerFailure(res, error);
        return;
      }

      logger.error('whatsapp.instances.create.unexpected', {
        tenantId,
        actorId,
        instanceId,
        error: describeErrorForLog(error),
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INSTANCE_CREATE_FAILED',
          message: 'Falha inesperada ao criar instância WhatsApp.',
        },
      });
      return;
    }

    const brokerIdCandidate = typeof brokerInstance.id === 'string' ? brokerInstance.id.trim() : '';
    const brokerId = brokerIdCandidate.length > 0 ? brokerIdCandidate : instanceId;
    const brokerNameCandidate = typeof brokerInstance.name === 'string' ? brokerInstance.name.trim() : '';
    const displayName = brokerNameCandidate.length > 0 ? brokerNameCandidate : name;
    const mappedStatus = mapBrokerInstanceStatusToDbStatus(brokerInstance.status ?? null);
    const connected = Boolean(brokerInstance.connected ?? (mappedStatus === 'connected'));
    const phoneNumber = typeof brokerInstance.phoneNumber === 'string' && brokerInstance.phoneNumber.trim().length > 0
      ? brokerInstance.phoneNumber.trim()
      : null;

    const historyEntry = buildHistoryEntry('created', actorId, compactRecord({
      status: mappedStatus,
      connected,
      name: displayName,
      phoneNumber: phoneNumber ?? undefined,
    }));

    const baseMetadata: InstanceMetadata = {
      displayId: instanceId,
      slug: instanceId,
      brokerId,
      displayName,
      label: displayName,
      origin: 'api-create',
    };

    const metadataWithHistory = appendInstanceHistory(baseMetadata, historyEntry) as Record<string, unknown>;
    const metadataWithoutError = withInstanceLastError(metadataWithHistory, null);

    let stored: StoredInstance;
    try {
      stored = (await prisma.whatsAppInstance.create({
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
      })) as StoredInstance;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        res.status(409).json({
          success: false,
          error: {
            code: 'INSTANCE_ALREADY_EXISTS',
            message: 'Já existe uma instância WhatsApp com esse identificador.',
          },
        });
        return;
      }

      if (error instanceof Prisma.PrismaClientValidationError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INSTANCE_PAYLOAD',
            message: 'Não foi possível criar a instância WhatsApp com os dados fornecidos.',
          },
        });
        return;
      }

      if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }

      throw error;
    }

    try {
      await clearInstanceArchive(tenantId, stored.id);
    } catch (error) {
      logger.warn('whatsapp.instances.create.clearArchiveFailed', {
        tenantId,
        instanceId: stored.id,
        error: describeErrorForLog(error),
      });
    }

    const serialized = serializeStoredInstance(stored, null);

    await removeCachedSnapshot(tenantId, instanceId, brokerId);

    emitToTenant(tenantId, 'whatsapp.instances.created', {
      instance: toJsonObject(serialized),
    });

    logger.info('whatsapp.instances.create.success', {
      tenantId,
      actorId,
      instanceId: serialized.id,
      brokerId,
      status: serialized.status,
      connected: serialized.connected,
    });

    res.status(201).json({
      success: true,
      data: serialized,
    });
  })
);

// GET /api/integrations/whatsapp/instances - List WhatsApp instances
// simple in-memory rate-limiter (per-process)
const instancesRateWindow = new Map<string, number[]>();
const rateLimitInstances = (req: Request, res: Response, next: Function) => {
  const tenantId = resolveRequestTenantId(req);
  const refreshQuery = req.query.refresh;
  const refreshToken = Array.isArray(refreshQuery) ? refreshQuery[0] : refreshQuery;
  const normalizedRefresh = typeof refreshToken === 'string' ? refreshToken.trim().toLowerCase() : null;
  const forced = normalizedRefresh === '1' || normalizedRefresh === 'true' || normalizedRefresh === 'yes';
  const mode = typeof req.query.mode === 'string' ? req.query.mode : 'db';
  const key = `${tenantId}|${forced ? 'refresh' : mode}`;
  const now = Date.now();
  const windowMs = forced || mode === 'sync' ? 30_000 : 15_000;
  const max = forced || mode === 'sync' ? 2 : 10;
  const arr = (instancesRateWindow.get(key) ?? []).filter(ts => now - ts < windowMs);
  if (arr.length >= max) {
    res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Muitas requisições. Tente novamente em instantes.' } });
    return;
  }
  arr.push(now);
  instancesRateWindow.set(key, arr);
  next();
};

router.get(
  '/whatsapp/instances',
  requireTenant,
  rateLimitInstances as any,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = resolveRequestTenantId(req);
    const t0 = Date.now();

    // refresh override (legacy)
    const refreshQuery = req.query.refresh;
    const refreshToken = Array.isArray(refreshQuery) ? refreshQuery[0] : refreshQuery;
    const normalizedRefresh = typeof refreshToken === 'string' ? refreshToken.trim().toLowerCase() : null;
    const refreshRequested = normalizedRefresh === '1' || normalizedRefresh === 'true' || normalizedRefresh === 'yes';

    // mode = db | snapshot | sync
    const mode = typeof req.query.mode === 'string' ? (req.query.mode as string) : 'db';
    const baseOptions =
      mode === 'sync' ? { refresh: true, fetchSnapshots: true } :
      mode === 'snapshot' ? { refresh: false, fetchSnapshots: true } :
      { refresh: false, fetchSnapshots: false }; // db default

    // if ?refresh was provided, override options fully
    const collectionOptions = { ...baseOptions };
    if (normalizedRefresh !== null) {
      collectionOptions.refresh = refreshRequested;
      collectionOptions.fetchSnapshots = refreshRequested;
    }

    logger.info('whatsapp.instances.list.request', {
      tenantId,
      refreshRequested,
      mode,
      options: collectionOptions,
    });

    try {
      const result = await collectInstancesForTenant(tenantId, collectionOptions);
      let instancesResult = result.instances;

      // selective fields: basic | metrics | full
      const fields = typeof req.query.fields === 'string' ? req.query.fields : 'basic';

      const pickBasic = (i: NormalizedInstance) => ({
        id: i.id,
        tenantId: i.tenantId,
        name: i.name,
        status: i.status,
        connected: i.connected,
        phoneNumber: i.phoneNumber,
        lastActivity: i.lastActivity,
      });

      const pickMetrics = (i: NormalizedInstance) => ({
        ...pickBasic(i),
        metrics: i.metrics ?? null,
        rate: i.rate ?? null,
      });

      const instances =
        fields === 'full'
          ? instancesResult
          : fields === 'metrics'
            ? instancesResult.map(pickMetrics)
            : instancesResult.map(pickBasic);

      const payload = {
        success: true,
        data: { instances },
        meta: {
          tenantId,
          mode,
          refreshRequested,
          shouldRefresh: result.shouldRefresh ?? false,
          fetchSnapshots: result.fetchSnapshots ?? false,
          synced: result.synced ?? false,
          instancesCount: instances.length,
          durationMs: Date.now() - t0,
        },
      };

      logger.info('whatsapp.instances.list.response', {
        tenantId,
        mode,
        refreshRequested,
        shouldRefresh: result.shouldRefresh ?? false,
        fetchSnapshots: result.fetchSnapshots ?? false,
        synced: result.synced ?? false,
        instancesCount: instances.length,
        durationMs: payload.meta.durationMs,
      });

      res.status(200).json(payload);
    } catch (error) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }

      logger.error('whatsapp.instances.list.unexpected', {
        tenantId,
        error: describeErrorForLog(error),
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Falha ao listar instâncias do WhatsApp.',
        },
      });
    }
  })
);

router.get(
  '/whatsapp/instances/:id/status',
  requireTenant,
  instanceIdParamValidator(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = readInstanceIdParam(req);
    if (!instanceId) {
      const issues: ZodIssue[] = [
        {
          code: z.ZodIssueCode.custom,
          path: ['params', 'id'],
          message: INVALID_INSTANCE_ID_MESSAGE,
        },
      ];
      respondWithValidationError(res, issues);
      return;
    }

    const refreshQuery = normalizeBooleanValue(req.query.refresh);
    const snapshotsQuery = normalizeBooleanValue(req.query.snapshots);
    const refresh = refreshQuery === null ? true : refreshQuery;
    const fetchSnapshots = snapshotsQuery === null ? true : snapshotsQuery;
    const tenantId = resolveRequestTenantId(req);
    const startedAt = Date.now();

    logger.info('whatsapp.instances.status.request', {
      tenantId,
      instanceId,
      refresh,
      fetchSnapshots,
    });

    let stored: StoredInstance | null = null;
    try {
      stored = (await prisma.whatsAppInstance.findUnique({
        where: {
          tenantId_id: {
            tenantId,
            id: instanceId,
          },
        },
      })) as StoredInstance | null;
    } catch (error) {
      if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }
      throw error;
    }

    if (!stored) {
      logger.warn('whatsapp.instances.status.notFound', {
        tenantId,
        instanceId,
      });
      res.status(404).json({
        success: false,
        error: {
          code: 'INSTANCE_NOT_FOUND',
          message: 'Instância não localizada para o tenant informado.',
        },
      });
      return;
    }

    try {
      const context = await resolveInstanceOperationContext(tenantId, stored, {
        refresh,
        fetchSnapshots,
      });

      const payload = buildInstanceStatusPayload(context);
      const durationMs = Date.now() - startedAt;

      logger.info('whatsapp.instances.status.success', {
        tenantId,
        instanceId,
        refresh,
        fetchSnapshots,
        status: payload.status.status,
        connected: payload.connected,
        durationMs,
      });

      res.status(200).json({
        success: true,
        data: payload,
        meta: {
          tenantId,
          instanceId,
          refresh,
          fetchSnapshots,
          durationMs,
        },
      });
    } catch (error) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }

      if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }

      const durationMs = Date.now() - startedAt;

      logger.error('whatsapp.instances.status.failed', {
        tenantId,
        instanceId,
        refresh,
        fetchSnapshots,
        durationMs,
        error: describeErrorForLog(error),
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INSTANCE_STATUS_FAILED',
          message: 'Falha ao recuperar status da instância WhatsApp.',
        },
      });
    }
  })
);

router.get(
  '/whatsapp/instances/:id/qr',
  requireTenant,
  instanceIdParamValidator(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = readInstanceIdParam(req);
    if (!instanceId) {
      const issues: ZodIssue[] = [
        {
          code: z.ZodIssueCode.custom,
          path: ['params', 'id'],
          message: INVALID_INSTANCE_ID_MESSAGE,
        },
      ];
      respondWithValidationError(res, issues);
      return;
    }

    const refreshQuery = normalizeBooleanValue(req.query.refresh);
    const snapshotsQuery = normalizeBooleanValue(req.query.snapshots);
    const refresh = refreshQuery === null ? true : refreshQuery;
    const fetchSnapshots = snapshotsQuery === null ? true : snapshotsQuery;
    const tenantId = resolveRequestTenantId(req);
    const startedAt = Date.now();

    logger.info('whatsapp.instances.qr.request', {
      tenantId,
      instanceId,
      refresh,
      fetchSnapshots,
    });

    let stored: StoredInstance | null = null;
    try {
      stored = (await prisma.whatsAppInstance.findUnique({
        where: {
          tenantId_id: {
            tenantId,
            id: instanceId,
          },
        },
      })) as StoredInstance | null;
    } catch (error) {
      if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }
      throw error;
    }

    if (!stored) {
      logger.warn('whatsapp.instances.qr.notFound', {
        tenantId,
        instanceId,
      });
      res.status(404).json({
        success: false,
        error: {
          code: 'INSTANCE_NOT_FOUND',
          message: 'Instância não localizada para o tenant informado.',
        },
      });
      return;
    }

    const qrUnavailable = () => {
      res.status(404).json({
        success: false,
        error: {
          code: 'QR_NOT_AVAILABLE',
          message: 'QR Code não disponível no momento. Tente novamente em instantes.',
        },
      });
    };

    try {
      const { context, qr } = await fetchStatusWithBrokerQr(tenantId, stored, {
        refresh,
        fetchSnapshots,
      });

      if (!qr.qr && !qr.qrCode) {
        logger.warn('whatsapp.instances.qr.empty', {
          tenantId,
          instanceId,
          refresh,
          fetchSnapshots,
        });
        qrUnavailable();
        return;
      }

      const payload = buildInstanceStatusPayload(context, qr);
      const durationMs = Date.now() - startedAt;

      logger.info('whatsapp.instances.qr.success', {
        tenantId,
        instanceId,
        refresh,
        fetchSnapshots,
        connected: payload.connected,
        durationMs,
      });

      res.status(200).json({
        success: true,
        data: payload,
        meta: {
          tenantId,
          instanceId,
          refresh,
          fetchSnapshots,
          durationMs,
        },
      });
    } catch (error) {
      const context = (error as { __context__?: InstanceOperationContext }).__context__ ?? null;
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        if (handleWhatsAppIntegrationError(res, error)) {
          return;
        }
      } else if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
        const status = readBrokerErrorStatus(error);
        if (status === 404 || status === 410) {
          logger.warn('whatsapp.instances.qr.brokerNotReady', {
            tenantId,
            instanceId,
            refresh,
            fetchSnapshots,
            status,
          });
          qrUnavailable();
          return;
        }

        logger.error('whatsapp.instances.qr.brokerFailed', {
          tenantId,
          instanceId,
          refresh,
          fetchSnapshots,
          status,
          code: error.code,
          requestId: error.requestId,
          error: describeErrorForLog(error),
        });
        respondWhatsAppBrokerFailure(res, error);
        return;
      } else if (handleWhatsAppIntegrationError(res, error)) {
        return;
      } else if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }

      const durationMs = Date.now() - startedAt;

      logger.error('whatsapp.instances.qr.failed', {
        tenantId,
        instanceId,
        refresh,
        fetchSnapshots,
        durationMs,
        error: describeErrorForLog(error),
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INSTANCE_QR_FAILED',
          message: 'Falha ao recuperar QR Code da instância WhatsApp.',
        },
        ...(context
          ? {
              data: buildInstanceStatusPayload(context),
            }
          : {}),
      });
    }
  })
);

router.get(
  '/whatsapp/instances/:id/qr.png',
  requireTenant,
  instanceIdParamValidator(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = readInstanceIdParam(req);
    if (!instanceId) {
      const issues: ZodIssue[] = [
        {
          code: z.ZodIssueCode.custom,
          path: ['params', 'id'],
          message: INVALID_INSTANCE_ID_MESSAGE,
        },
      ];
      respondWithValidationError(res, issues);
      return;
    }

    const refreshQuery = normalizeBooleanValue(req.query.refresh);
    const snapshotsQuery = normalizeBooleanValue(req.query.snapshots);
    const refresh = refreshQuery === null ? true : refreshQuery;
    const fetchSnapshots = snapshotsQuery === null ? true : snapshotsQuery;
    const tenantId = resolveRequestTenantId(req);
    const startedAt = Date.now();

    logger.info('whatsapp.instances.qrImage.request', {
      tenantId,
      instanceId,
      refresh,
      fetchSnapshots,
    });

    let stored: StoredInstance | null = null;
    try {
      stored = (await prisma.whatsAppInstance.findUnique({
        where: {
          tenantId_id: {
            tenantId,
            id: instanceId,
          },
        },
      })) as StoredInstance | null;
    } catch (error) {
      if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }
      throw error;
    }

    if (!stored) {
      logger.warn('whatsapp.instances.qrImage.notFound', {
        tenantId,
        instanceId,
      });
      res.sendStatus(404);
      return;
    }

    try {
      const { context, qr } = await fetchStatusWithBrokerQr(tenantId, stored, {
        refresh,
        fetchSnapshots,
      });

      const buffer = extractQrImageBuffer(qr);
      if (!buffer) {
        logger.warn('whatsapp.instances.qrImage.empty', {
          tenantId,
          instanceId,
          refresh,
          fetchSnapshots,
        });
        res.sendStatus(404);
        return;
      }

      const durationMs = Date.now() - startedAt;

      logger.info('whatsapp.instances.qrImage.success', {
        tenantId,
        instanceId,
        refresh,
        fetchSnapshots,
        connected: context.status.connected,
        durationMs,
      });

      res.setHeader('content-type', 'image/png');
      res.status(200).send(buffer);
    } catch (error) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        if (handleWhatsAppIntegrationError(res, error)) {
          return;
        }
      } else if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
        const status = readBrokerErrorStatus(error);
        if (status === 404 || status === 410) {
          logger.warn('whatsapp.instances.qrImage.brokerNotReady', {
            tenantId,
            instanceId,
            refresh,
            fetchSnapshots,
            status,
          });
          res.sendStatus(404);
          return;
        }

        logger.error('whatsapp.instances.qrImage.brokerFailed', {
          tenantId,
          instanceId,
          refresh,
          fetchSnapshots,
          status,
          code: error.code,
          requestId: error.requestId,
          error: describeErrorForLog(error),
        });
        respondWhatsAppBrokerFailure(res, error);
        return;
      } else if (handleWhatsAppIntegrationError(res, error)) {
        return;
      } else if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }

      const durationMs = Date.now() - startedAt;

      logger.error('whatsapp.instances.qrImage.failed', {
        tenantId,
        instanceId,
        refresh,
        fetchSnapshots,
        durationMs,
        error: describeErrorForLog(error),
      });

      res.sendStatus(500);
    }
  })
);

router.get(
  '/whatsapp/instances/qr',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = resolveRequestTenantId(req);
    const instanceId = resolveDefaultInstanceId();
    const refreshQuery = normalizeBooleanValue(req.query.refresh);
    const snapshotsQuery = normalizeBooleanValue(req.query.snapshots);
    const refresh = refreshQuery === null ? true : refreshQuery;
    const fetchSnapshots = snapshotsQuery === null ? true : snapshotsQuery;
    const startedAt = Date.now();

    logger.info('whatsapp.instances.qrDefault.request', {
      tenantId,
      instanceId,
      refresh,
      fetchSnapshots,
    });

    let stored: StoredInstance | null = null;
    try {
      stored = (await prisma.whatsAppInstance.findUnique({
        where: {
          tenantId_id: {
            tenantId,
            id: instanceId,
          },
        },
      })) as StoredInstance | null;
    } catch (error) {
      if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }
      throw error;
    }

    if (!stored) {
      logger.warn('whatsapp.instances.qrDefault.notFound', {
        tenantId,
        instanceId,
      });
      res.status(404).json({
        success: false,
        error: {
          code: 'INSTANCE_NOT_FOUND',
          message: 'Instância padrão não localizada para o tenant informado.',
        },
      });
      return;
    }

    const qrUnavailable = () => {
      res.status(404).json({
        success: false,
        error: {
          code: 'QR_NOT_AVAILABLE',
          message: 'QR Code não disponível no momento. Tente novamente em instantes.',
        },
      });
    };

    try {
      const { context, qr } = await fetchStatusWithBrokerQr(tenantId, stored, {
        refresh,
        fetchSnapshots,
      });

      if (!qr.qr && !qr.qrCode) {
        logger.warn('whatsapp.instances.qrDefault.empty', {
          tenantId,
          refresh,
          fetchSnapshots,
        });
        qrUnavailable();
        return;
      }

      const payload = buildInstanceStatusPayload(context, qr);
      const durationMs = Date.now() - startedAt;

      logger.info('whatsapp.instances.qrDefault.success', {
        tenantId,
        refresh,
        fetchSnapshots,
        connected: payload.connected,
        durationMs,
      });

      res.status(200).json({
        success: true,
        data: {
          ...payload,
          instanceId: payload.instance.id,
        },
        meta: {
          tenantId,
          instanceId: payload.instance.id,
          refresh,
          fetchSnapshots,
          durationMs,
        },
      });
    } catch (error) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        if (handleWhatsAppIntegrationError(res, error)) {
          return;
        }
      } else if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
        const status = readBrokerErrorStatus(error);
        if (status === 404 || status === 410) {
          logger.warn('whatsapp.instances.qrDefault.brokerNotReady', {
            tenantId,
            refresh,
            fetchSnapshots,
            status,
          });
          qrUnavailable();
          return;
        }

        logger.error('whatsapp.instances.qrDefault.brokerFailed', {
          tenantId,
          refresh,
          fetchSnapshots,
          status,
          code: error.code,
          requestId: error.requestId,
          error: describeErrorForLog(error),
        });
        respondWhatsAppBrokerFailure(res, error);
        return;
      } else if (handleWhatsAppIntegrationError(res, error)) {
        return;
      } else if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }

      const durationMs = Date.now() - startedAt;

      logger.error('whatsapp.instances.qrDefault.failed', {
        tenantId,
        refresh,
        fetchSnapshots,
        durationMs,
        error: describeErrorForLog(error),
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INSTANCE_QR_FAILED',
          message: 'Falha ao recuperar QR Code da instância WhatsApp.',
        },
      });
    }
  })
);

router.get(
  '/whatsapp/instances/qr.png',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = resolveRequestTenantId(req);
    const instanceId = resolveDefaultInstanceId();
    const refreshQuery = normalizeBooleanValue(req.query.refresh);
    const snapshotsQuery = normalizeBooleanValue(req.query.snapshots);
    const refresh = refreshQuery === null ? true : refreshQuery;
    const fetchSnapshots = snapshotsQuery === null ? true : snapshotsQuery;
    const startedAt = Date.now();

    logger.info('whatsapp.instances.qrDefaultImage.request', {
      tenantId,
      instanceId,
      refresh,
      fetchSnapshots,
    });

    let stored: StoredInstance | null = null;
    try {
      stored = (await prisma.whatsAppInstance.findUnique({
        where: {
          tenantId_id: {
            tenantId,
            id: instanceId,
          },
        },
      })) as StoredInstance | null;
    } catch (error) {
      if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }
      throw error;
    }

    if (!stored) {
      logger.warn('whatsapp.instances.qrDefaultImage.notFound', {
        tenantId,
        instanceId,
      });
      res.sendStatus(404);
      return;
    }

    try {
      const { qr } = await fetchStatusWithBrokerQr(tenantId, stored, {
        refresh,
        fetchSnapshots,
      });
      const buffer = extractQrImageBuffer(qr);

      if (!buffer) {
        logger.warn('whatsapp.instances.qrDefaultImage.empty', {
          tenantId,
          instanceId,
          refresh,
          fetchSnapshots,
        });
        res.sendStatus(404);
        return;
      }

      const durationMs = Date.now() - startedAt;

      logger.info('whatsapp.instances.qrDefaultImage.success', {
        tenantId,
        instanceId,
        refresh,
        fetchSnapshots,
        durationMs,
      });

      res.setHeader('content-type', 'image/png');
      res.status(200).send(buffer);
    } catch (error) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        if (handleWhatsAppIntegrationError(res, error)) {
          return;
        }
      } else if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
        const status = readBrokerErrorStatus(error);
        if (status === 404 || status === 410) {
          logger.warn('whatsapp.instances.qrDefaultImage.brokerNotReady', {
            tenantId,
            instanceId,
            refresh,
            fetchSnapshots,
            status,
          });
          res.sendStatus(404);
          return;
        }

        logger.error('whatsapp.instances.qrDefaultImage.brokerFailed', {
          tenantId,
          instanceId,
          refresh,
          fetchSnapshots,
          status,
          code: error.code,
          requestId: error.requestId,
          error: describeErrorForLog(error),
        });
        respondWhatsAppBrokerFailure(res, error);
        return;
      } else if (handleWhatsAppIntegrationError(res, error)) {
        return;
      } else if (respondWhatsAppStorageUnavailable(res, error)) {
        return;
      }

      const durationMs = Date.now() - startedAt;

      logger.error('whatsapp.instances.qrDefaultImage.failed', {
        tenantId,
        instanceId,
        refresh,
        fetchSnapshots,
        durationMs,
        error: describeErrorForLog(error),
      });

      res.sendStatus(500);
    }
  })
);

router.post(
  '/whatsapp/instances/disconnect',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = resolveRequestTenantId(req);
    const actorId = resolveRequestActorId(req);
    const defaultInstanceId = resolveDefaultInstanceId();

    try {
      const stored = await prisma.whatsAppInstance.findUnique({
        where: {
          tenantId_id: {
            tenantId,
            id: defaultInstanceId,
          },
        },
      });

      if (!stored) {
        res.status(404).json({
          success: false,
          error: {
            code: 'DEFAULT_INSTANCE_NOT_FOUND',
            message: 'Instância WhatsApp padrão não localizada para o tenant informado.',
          },
        });
        return;
      }

      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      const wipeValue =
        normalizeBooleanValue(req.query.wipe) ?? normalizeBooleanValue(body.wipe);
      const disconnectOptions: { wipe?: boolean } =
        wipeValue === null ? {} : { wipe: wipeValue === true };

      const result = await disconnectStoredInstance(tenantId, stored, actorId, disconnectOptions);

      if (result.outcome === 'retry') {
        res.status(202).json({
          success: true,
          data: {
            instanceId: stored.id,
            disconnected: false,
            pending: true,
            existed: true,
            connected: null,
            retry: result.retry,
          },
        });
        return;
      }

      try {
        await clearWhatsAppDisconnectRetry(tenantId, stored.id);
      } catch (error) {
        if (!logWhatsAppStorageError('disconnect.clearRetry', error, { tenantId, instanceId: stored.id })) {
          throw error;
        }
      }

      await removeCachedSnapshot(tenantId, stored.id, stored.brokerId);

      const { context } = result;

      res.status(200).json({
        success: true,
        data: {
          instanceId: context.instance.id,
          disconnected: !context.status.connected,
          pending: false,
          existed: true,
          connected: context.status.connected,
          status: context.status,
          qr: context.qr,
          instance: context.instance,
          instances: context.instances,
        },
      });
    } catch (error) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }

      logger.error('whatsapp.instances.disconnect.defaultFailed', {
        tenantId,
        actorId,
        instanceId: defaultInstanceId,
        error: describeErrorForLog(error),
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INSTANCE_DISCONNECT_FAILED',
          message: 'Falha ao desconectar instância WhatsApp.',
        },
      });
    }
  })
);

router.post(
  '/whatsapp/instances/:id/disconnect',
  requireTenant,
  instanceIdParamValidator(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = readInstanceIdParam(req);
    if (!instanceId) {
      const issues: ZodIssue[] = [
        {
          code: z.ZodIssueCode.custom,
          path: ['params', 'id'],
          message: INVALID_INSTANCE_ID_MESSAGE,
        },
      ];
      respondWithValidationError(res, issues);
      return;
    }

    const tenantId = resolveRequestTenantId(req);
    const actorId = resolveRequestActorId(req);
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const wipeValue =
      normalizeBooleanValue(req.query.wipe) ?? normalizeBooleanValue(body.wipe);
    const disconnectOptions: { wipe?: boolean } =
      wipeValue === null ? {} : { wipe: wipeValue === true };

    if (looksLikeWhatsAppJid(instanceId)) {
      try {
        try {
          whatsappHttpRequestsCounter?.inc?.();
        } catch {
          // optional metric
        }

        await whatsappBrokerClient.disconnectInstance(instanceId, {
          instanceId,
          ...(disconnectOptions ?? {}),
        });

        try {
          await clearWhatsAppDisconnectRetry(tenantId, instanceId);
        } catch (error) {
          if (!logWhatsAppStorageError('disconnect.clearRetry', error, { tenantId, instanceId })) {
            throw error;
          }
        }

        await removeCachedSnapshot(tenantId, instanceId, instanceId);

        res.status(200).json({
          success: true,
          data: {
            instanceId,
            disconnected: true,
            pending: false,
            existed: true,
            connected: null,
          },
        });
        return;
      } catch (error) {
        if (error instanceof WhatsAppBrokerNotConfiguredError) {
          if (handleWhatsAppIntegrationError(res, error)) {
            return;
          }
        }

        if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
          const brokerError = error as WhatsAppBrokerError;
          const brokerStatus = readBrokerErrorStatus(brokerError);

          if (isBrokerAlreadyDisconnectedError(brokerError) || brokerStatus === 404 || brokerStatus === 410) {
            res.status(200).json({
              success: true,
              data: {
                instanceId,
                disconnected: true,
                pending: false,
                existed: false,
                connected: null,
              },
            });
            return;
          }

          if (brokerStatus !== null && brokerStatus >= 500) {
            const requestedAt = new Date().toISOString();
            await scheduleWhatsAppDisconnectRetry(tenantId, {
              instanceId,
              status: brokerStatus,
              requestId: brokerError.requestId ?? null,
              wipe: Boolean(disconnectOptions.wipe),
              requestedAt,
            });

            res.status(202).json({
              success: true,
              data: {
                instanceId,
                disconnected: false,
                pending: true,
                existed: true,
                connected: null,
                retry: {
                  status: brokerStatus,
                  requestId: brokerError.requestId ?? null,
                },
              },
            });
            return;
          }

          logger.error('whatsapp.instances.disconnect.brokerFailed', {
            tenantId,
            actorId,
            instanceId,
            status: brokerStatus,
            code: brokerError.code,
            requestId: brokerError.requestId,
            error: describeErrorForLog(brokerError),
          });

          res.status(502).json({
            success: false,
            error: {
              code: 'WHATSAPP_BROKER_DISCONNECT_FAILED',
              message: 'Falha ao desconectar instância via broker WhatsApp.',
            },
          });
          return;
        }

        if (handleWhatsAppIntegrationError(res, error)) {
          return;
        }

        logger.error('whatsapp.instances.disconnect.unexpected', {
          tenantId,
          actorId,
          instanceId,
          error: describeErrorForLog(error),
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'INSTANCE_DISCONNECT_FAILED',
            message: 'Falha ao desconectar instância WhatsApp.',
          },
        });
        return;
      }
    }

    try {
      const stored = await prisma.whatsAppInstance.findUnique({
        where: {
          tenantId_id: {
            tenantId,
            id: instanceId,
          },
        },
      });

      if (!stored) {
        res.status(404).json({
          success: false,
          error: {
            code: 'INSTANCE_NOT_FOUND',
            message: 'Instância não localizada para o tenant informado.',
          },
        });
        return;
      }

      const result = await disconnectStoredInstance(tenantId, stored, actorId, disconnectOptions);

      if (result.outcome === 'retry') {
        res.status(202).json({
          success: true,
          data: {
            instanceId: stored.id,
            disconnected: false,
            pending: true,
            existed: true,
            connected: null,
            retry: result.retry,
          },
        });
        return;
      }

      try {
        await clearWhatsAppDisconnectRetry(tenantId, stored.id);
      } catch (error) {
        if (!logWhatsAppStorageError('disconnect.clearRetry', error, { tenantId, instanceId: stored.id })) {
          throw error;
        }
      }

      await removeCachedSnapshot(tenantId, stored.id, stored.brokerId);

      const { context } = result;

      res.status(200).json({
        success: true,
        data: {
          instanceId: context.instance.id,
          disconnected: !context.status.connected,
          pending: false,
          existed: true,
          connected: context.status.connected,
          status: context.status,
          qr: context.qr,
          instance: context.instance,
          instances: context.instances,
        },
      });
    } catch (error) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }

      logger.error('whatsapp.instances.disconnect.failed', {
        tenantId,
        actorId,
        instanceId,
        error: describeErrorForLog(error),
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INSTANCE_DISCONNECT_FAILED',
          message: 'Falha ao desconectar instância WhatsApp.',
        },
      });
    }
  })
);

export const integrationsRouter = router;

export const __testing = {
  serializeStoredInstance,
  normalizeStatusCountsData,
  normalizeRateUsageData,
  collectNumericFromSources,
  syncInstancesFromBroker,
  collectInstancesForTenant,
  resolveInstanceOperationContext,
  disconnectStoredInstance,
  deleteStoredInstance,
  archiveInstanceSnapshot,
  clearInstanceArchive,
  clearWhatsAppDisconnectRetry,
  removeCachedSnapshot,
};

router.delete(
  '/whatsapp/instances/:id',
  requireTenant,
  instanceIdParamValidator(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = readInstanceIdParam(req);
    if (!instanceId) {
      const issues: ZodIssue[] = [
        {
          code: z.ZodIssueCode.custom,
          path: ['params', 'id'],
          message: INVALID_INSTANCE_ID_MESSAGE,
        },
      ];
      respondWithValidationError(res, issues);
      return;
    }

    if (looksLikeWhatsAppJid(instanceId)) {
      const issues: ZodIssue[] = [
        {
          code: z.ZodIssueCode.custom,
          path: ['params', 'id'],
          message: 'Para desconectar um JID use a rota de disconnect.',
        },
      ];
      respondWithValidationError(res, issues);
      return;
    }

    const tenantId = resolveRequestTenantId(req);
    const actorId = resolveRequestActorId(req);

    const stored = await prisma.whatsAppInstance.findUnique({
      where: {
        tenantId_id: {
          tenantId,
          id: instanceId,
        },
      },
    });

    if (!stored) {
      res.status(404).json({
        success: false,
        error: {
          code: 'INSTANCE_NOT_FOUND',
          message: 'Instância não localizada para o tenant informado.',
        },
      });
      return;
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const wipeValue =
      normalizeBooleanValue(req.query.wipe) ??
      normalizeBooleanValue(body.wipe);
    const wipe = wipeValue === true;

    let brokerStatus: 'deleted' | 'not_found' = 'deleted';

    try {
      try {
        whatsappHttpRequestsCounter?.inc?.();
      } catch {
        // metrics optional
      }

      const deleteOptions: DeleteInstanceOptions = wipeValue === null
        ? { instanceId: stored.id }
        : { instanceId: stored.id, wipe };

      await whatsappBrokerClient.deleteInstance(stored.brokerId, deleteOptions);
      logger.info('whatsapp.instances.delete.broker', {
        tenantId,
        instanceId: stored.id,
        brokerId: stored.brokerId,
        wipe,
      });
    } catch (error) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        if (handleWhatsAppIntegrationError(res, error)) {
          return;
        }
      }

      if (isBrokerMissingInstanceError(error)) {
        brokerStatus = 'not_found';
        logger.warn('whatsapp.instances.delete.brokerMissing', {
          tenantId,
          instanceId: stored.id,
          brokerId: stored.brokerId,
          error: describeErrorForLog(error),
        });
      } else {
        logger.error('whatsapp.instances.delete.brokerFailed', {
          tenantId,
          instanceId: stored.id,
          brokerId: stored.brokerId,
          error: describeErrorForLog(error),
        });

        res.status(502).json({
          success: false,
          error: {
            code: 'WHATSAPP_BROKER_DELETE_FAILED',
            message: 'Falha ao remover instância junto ao broker WhatsApp.',
            details: describeErrorForLog(error),
          },
        });
        return;
      }
    }

    try {
      const result = await deleteStoredInstance(tenantId, stored, actorId);
      emitToTenant(tenantId, 'whatsapp.instances.deleted', {
        id: stored.id,
        tenantId,
        deletedAt: result.deletedAt,
        brokerStatus,
      });

      res.status(200).json({
        success: true,
        data: {
          id: stored.id,
          brokerStatus,
          deletedAt: result.deletedAt,
          instances: result.instances,
        },
      });
    } catch (error) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }

      logger.error('whatsapp.instances.delete.failed', {
        tenantId,
        instanceId: stored.id,
        brokerId: stored.brokerId,
        error: describeErrorForLog(error),
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INSTANCE_DELETE_FAILED',
          message: 'Falha ao remover instância WhatsApp.',
        },
      });
    }
  })
);
