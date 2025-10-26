import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import {
  Prisma,
  WhatsAppInstanceStatus,
  type WhatsAppInstance as PrismaWhatsAppInstance,
} from '@prisma/client';
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
  type WhatsAppInstance as BrokerWhatsAppInstance,
} from '../services/whatsapp-broker-client';
import { emitToTenant } from '../lib/socket-registry';
import { prisma } from '../lib/prisma';
import { logger } from '../config/logger';
import { respondWithValidationError } from '../utils/http-validation';
import { normalizePhoneNumber, PhoneNormalizationError } from '../utils/phone';
import { whatsappHttpRequestsCounter } from '../lib/metrics';
import { getMvpBypassTenantId } from '../config/feature-flags';
import { getWhatsAppTransport } from '../features/whatsapp-transport';

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

  let metrics: Record<string, unknown> | null =
    mergeRecords(
      asRecord(brokerStatus?.metrics),
      asRecord(brokerStatus?.rateUsage),
      asRecord(rawStatus?.metrics),
      asRecord(rawStatus?.messages),
      asRecord(rawStatus?.stats)
    ) ?? null;

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
        brokerId: existingInstance.id,
        ...(phoneNumber ? { phoneNumber } : {}),
        ...(derivedLastSeenAt ? { lastSeenAt: derivedLastSeenAt } : {}),
        metadata: metadataWithoutError,
      };

      await prisma.whatsAppInstance.update({
        where: { id: existingInstance.id },
        data: updateData,
      });

      emitToTenant(tenantId, 'whatsapp.instance.updated', {
        id: existingInstance.id,
        status: derivedStatus,
        connected: derivedConnected,
        phoneNumber,
        syncedAt: new Date().toISOString(),
        history: historyEntry,
      });
    } else {
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
        logger.info('whatsapp.instances.sync.brokerNotConfigured', {
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

// GET /api/integrations/whatsapp/instances - List WhatsApp instances
router.get(
  '/whatsapp/instances',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = resolveRequestTenantId(req);
    const refreshQuery = req.query.refresh;
    const refreshToken = Array.isArray(refreshQuery) ? refreshQuery[0] : refreshQuery;
    const normalizedRefresh =
      typeof refreshToken === 'string' ? refreshToken.trim().toLowerCase() : null;
    const hasRefreshParam = normalizedRefresh !== null;
    const refreshRequested = hasRefreshParam
      ? normalizedRefresh === '1' || normalizedRefresh === 'true' || normalizedRefresh === 'yes'
      : undefined;

    logger.info('whatsapp.instances.list.request', {
      tenantId,
      refreshRequested,
    });

    let instances: NormalizedInstance[] = [];
    let usedStorageFallback = false;

    const collectionOptions =
      refreshRequested === undefined ? {} : { refresh: refreshRequested };

    try {
      const result = await collectInstancesForTenant(tenantId, collectionOptions);
      instances = result.instances;
    } catch (error: unknown) {
      const { isStorageError, prismaCode } = resolveWhatsAppStorageError(error);

      if (isStorageError) {
        usedStorageFallback = true;
        logger.warn('whatsapp.instances.list.storageFallbackTriggered', {
          tenantId,
          refreshRequested,
          prismaCode,
          error: describeErrorForLog(error),
        });

        let fallbackSnapshots: WhatsAppBrokerInstanceSnapshot[] = [];
        try {
          fallbackSnapshots = await whatsappBrokerClient.listInstances(tenantId);
        } catch (fallbackError) {
          if (
            fallbackError instanceof WhatsAppBrokerError ||
            hasErrorName(fallbackError, 'WhatsAppBrokerError')
          ) {
            respondWhatsAppBrokerFailure(res, fallbackError as WhatsAppBrokerError);
            return;
          }

          if (handleWhatsAppIntegrationError(res, fallbackError)) {
            return;
          }

          throw fallbackError;
        }

        const fallbackInstances = buildFallbackInstancesFromSnapshots(
          tenantId,
          fallbackSnapshots
        );

        instances = fallbackInstances;

        logger.info('whatsapp.instances.list.snapshotFallbackServed', {
          tenantId,
          refreshRequested,
          instances: instances.length,
          snapshots: fallbackSnapshots.length,
          prismaCode,
        });
      } else if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
        respondWhatsAppBrokerFailure(res, error as WhatsAppBrokerError);
        return;
      } else if (handleWhatsAppIntegrationError(res, error)) {
        return;
      } else {
        throw error;
      }
    }

    logger.info('whatsapp.instances.list.response', {
      tenantId,
      count: instances.length,
      refreshRequested,
      storageFallback: usedStorageFallback,
    });

    const responsePayload: {
      success: true;
      data: { instances: NormalizedInstance[] };
      meta?: {
        storageFallback?: boolean;
      };
    } = {
      success: true,
      data: {
        instances,
      },
    };

    if (usedStorageFallback) {
      responsePayload.meta = {
        storageFallback: true,
      };
    }

    res.json(responsePayload);
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
    const tenantId = resolveRequestTenantId(req);
    const { id, name, agreementId } = req.body as {
      id?: string;
      name: string;
      agreementId?: string;
    };

    const normalizedName = name.trim();

    if (!normalizedName) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INSTANCE_NAME',
          message: 'Informe um nome válido para a nova instância.',
        },
      });
      return;
    }

    if (normalizedName.length > 120) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INSTANCE_NAME',
          message: 'O nome da instância deve ter no máximo 120 caracteres.',
        },
      });
      return;
    }

    const providedId = typeof id === 'string' ? id : undefined;
    const requestedIdSource =
      typeof providedId === 'string' && providedId.length > 0 ? providedId : normalizedName;

    if (!requestedIdSource || requestedIdSource.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INSTANCE_ID',
          message: 'Informe um identificador válido para a instância WhatsApp.',
        },
      });
      return;
    }

    const validatedName = normalizedName;
    const normalizedAgreementId =
      typeof agreementId === 'string' && agreementId.trim().length > 0
        ? agreementId.trim()
        : null;
    try {
      try {
        const existingInstance = await prisma.whatsAppInstance.findUnique({
          where: { tenantId_id: { tenantId, id: requestedIdSource } },
          select: { id: true },
        });

        if (existingInstance) {
          res.status(409).json({
            success: false,
            error: {
              code: 'INSTANCE_ALREADY_EXISTS',
              message: 'Já existe uma instância WhatsApp com este identificador.',
            },
          });
          return;
        }
      } catch (lookupError) {
        if (respondWhatsAppStorageUnavailable(res, lookupError)) {
          return;
        }

        throw lookupError;
      }

      const normalizedId = requestedIdSource;
      let brokerInstance: BrokerWhatsAppInstance | null = null;

      try {
        brokerInstance = await whatsappBrokerClient.createInstance({
          tenantId,
          name: validatedName,
          instanceId: normalizedId,
        });
      } catch (brokerError) {
        if (brokerError instanceof WhatsAppBrokerError || hasErrorName(brokerError, 'WhatsAppBrokerError')) {
          const normalizedError = brokerError as WhatsAppBrokerError;
          const brokerStatus = readBrokerErrorStatus(normalizedError);
          logger.warn('whatsapp.instance.create.brokerRejected', {
            tenantId,
            name: validatedName,
            error: normalizedError.message,
            code: normalizedError.code,
            status: brokerStatus,
            requestId: normalizedError.requestId,
          });

          res.status(502).json({
            success: false,
            error: {
              code: normalizedError.code || 'BROKER_ERROR',
              message: normalizedError.message || 'WhatsApp broker request failed',
              details: compactRecord({
                status: brokerStatus,
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

      const brokerId =
        typeof brokerInstance?.id === 'string' && brokerInstance.id.trim().length > 0
          ? brokerInstance.id.trim()
          : null;
      if (brokerId && brokerId !== normalizedId) {
        logger.warn('whatsapp.instance.create.brokerIdMismatch', {
          tenantId,
          requestedId: normalizedId,
          brokerId,
        });
      }
      const resolvedBrokerId = normalizedId;
      const actorId = req.user?.id ?? 'system';
      const historyEntry = buildHistoryEntry(
        'created',
        actorId,
        compactRecord({
          name: validatedName,
          brokerId: resolvedBrokerId,
          agreementId: normalizedAgreementId ?? undefined,
        })
      );
      const metadata = appendInstanceHistory(
        compactRecord({
          displayId: normalizedId,
          slug: normalizedId,
          brokerId: resolvedBrokerId,
          displayName: validatedName,
          label: validatedName,
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
          name: validatedName,
          brokerId: resolvedBrokerId,
          status: derivedStatus,
          connected: isConnected,
          phoneNumber: brokerInstance?.phoneNumber ?? null,
          metadata: metadataWithoutError,
        },
      });

      const { brokerId: _brokerId, ...payload } = serializeStoredInstance(instance as StoredInstance, null);

      logger.info('whatsapp.instance.create.success', {
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
        logger.error('whatsapp.instance.create.invalidPayload', {
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
        logger.error('whatsapp.instance.create.storageError', {
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
  const instanceId = readInstanceIdParam(req);
  if (!instanceId) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_INSTANCE_ID',
        message: INVALID_INSTANCE_ID_MESSAGE,
      },
    });
    return;
  }
  const tenantId = resolveRequestTenantId(req);
  const actorId = req.user?.id ?? 'system';
  const rawPhoneNumber = typeof req.body?.phoneNumber === 'string' ? req.body.phoneNumber : null;
  const rawPairingCode = typeof req.body?.code === 'string' ? req.body.code : null;
  let pairingPhoneNumber: string | null = null;
  let pairingCode: string | null = null;

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

    if (rawPhoneNumber) {
      const trimmedPhone = rawPhoneNumber.trim();
      if (trimmedPhone.length > 0) {
        try {
          pairingPhoneNumber = normalizePhoneNumber(trimmedPhone).e164;
        } catch (error) {
          const message =
            error instanceof PhoneNormalizationError ? error.message : 'Informe um telefone válido.';
          res.locals.errorCode = 'VALIDATION_ERROR';
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Corpo da requisição inválido.',
              details: {
                errors: [
                  {
                    field: 'phoneNumber',
                    message,
                  },
                ],
              },
            },
          });
          return;
        }
      }
    }

    if (rawPairingCode && rawPairingCode.trim().length > 0) {
      pairingCode = rawPairingCode.trim();
    }

    const finalizeWithContext = async (
      context: InstanceOperationContext,
      options: { recordHistory?: boolean; clearLastError?: boolean; warnIfDisconnected?: boolean; pairingPhoneNumber?: string | null } = {}
    ) => {
      const recordHistory = options.recordHistory !== false;
      const clearLastError = options.clearLastError !== false;
      const warnIfDisconnected = options.warnIfDisconnected ?? recordHistory;
      const historyPhoneNumber = options.pairingPhoneNumber ?? null;

      if (warnIfDisconnected && !context.status.connected) {
        logger.warn('whatsapp.instance.connect.stillDisconnected', {
          tenantId,
          instanceId: instance.id,
          status: context.status.status,
        });
      }

      let metadataToPersist: Prisma.JsonObject | InstanceMetadata =
        context.stored.metadata as InstanceMetadata;

      if (recordHistory) {
        const historyEntry = buildHistoryEntry('connect-instance', actorId, {
          status: context.status.status,
          connected: context.status.connected,
          ...(historyPhoneNumber ? { phoneNumber: historyPhoneNumber } : {}),
        });
        metadataToPersist = appendInstanceHistory(metadataToPersist as InstanceMetadata, historyEntry);
      }

      if (clearLastError) {
        metadataToPersist = withInstanceLastError(metadataToPersist as InstanceMetadata, null);
      }

      const derivedStatus = context.brokerStatus
        ? mapBrokerStatusToDbStatus(context.brokerStatus)
        : mapBrokerInstanceStatusToDbStatus(context.status.status);

      const updateData: Prisma.WhatsAppInstanceUpdateInput = {
        status: derivedStatus,
        connected: context.status.connected,
        lastSeenAt: context.status.connected ? new Date() : context.stored.lastSeenAt,
      };

      if (recordHistory || clearLastError) {
        updateData.metadata = metadataToPersist as Prisma.JsonObject;
      }

      await prisma.whatsAppInstance.update({
        where: { id: context.stored.id },
        data: updateData,
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
    };

    const shouldRequestPairing = Boolean(pairingPhoneNumber || pairingCode);

    if (!shouldRequestPairing) {
      const context = await resolveInstanceOperationContext(tenantId, instance as StoredInstance, {
        refresh: true,
      });
      await finalizeWithContext(context, {
        recordHistory: false,
        clearLastError: false,
        warnIfDisconnected: false,
      });
      return;
    }

    try {
      await whatsappBrokerClient.connectInstance(instance.brokerId, {
        instanceId: instance.id,
        ...(pairingCode ? { code: pairingCode } : {}),
        ...(pairingPhoneNumber ? { phoneNumber: pairingPhoneNumber } : {}),
      });
      const context = await resolveInstanceOperationContext(tenantId, instance as StoredInstance, {
        refresh: true,
      });
      await finalizeWithContext(context, {
        pairingPhoneNumber,
      });
      return;
    } catch (error) {
      if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
        const brokerError = error as WhatsAppBrokerError;
        const brokerStatus = readBrokerErrorStatus(brokerError);

        if (isBrokerAlreadyConnectedError(brokerError) || brokerStatus === 409) {
          logger.info('whatsapp.instance.connect.alreadyConnected', {
            tenantId,
            instanceId: instance.id,
            status: brokerStatus,
            code: brokerError.code,
            requestId: brokerError.requestId,
          });

          const context = await resolveInstanceOperationContext(tenantId, instance as StoredInstance, {
            refresh: true,
          });
          await finalizeWithContext(context);
          return;
        }

        logger.warn('whatsapp.instance.connect.brokerRejected', {
          tenantId,
          instanceId: instance.id,
          status: brokerStatus,
          code: brokerError.code,
          requestId: brokerError.requestId,
        });

        const failureHistory = buildHistoryEntry('connect-instance-failed', actorId, {
          code: brokerError.code,
          message: brokerError.message,
          requestId: brokerError.requestId ?? null,
        });

        const metadataWithHistory = appendInstanceHistory(
          instance.metadata as InstanceMetadata,
          failureHistory
        );
        const metadataWithError = withInstanceLastError(metadataWithHistory, {
          code: brokerError.code,
          message: brokerError.message,
          requestId: brokerError.requestId ?? null,
        });

        await prisma.whatsAppInstance.update({
          where: { id: instance.id },
          data: {
            status: 'failed',
            connected: false,
            metadata: metadataWithError,
          },
        });

        if (isBrokerMissingInstanceError(brokerError)) {
          res.status(422).json({
            success: false,
            error: {
              code: 'BROKER_NOT_FOUND',
              message: 'Instance not found in broker',
              details: compactRecord({
                instanceId: instance.id,
                requestId: brokerError.requestId ?? undefined,
              }),
            },
          });
          return;
        }

        res.status(502).json({
          success: false,
          error: {
            code: brokerError.code || 'BROKER_ERROR',
            message: brokerError.message || 'WhatsApp broker request failed',
            details: compactRecord({
              status: brokerStatus,
              requestId: brokerError.requestId ?? undefined,
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
  } catch (error: unknown) {
    if (handleWhatsAppIntegrationError(res, error)) {
      return;
    }
    throw error;
  }
};

const pairInstanceMiddleware = [
  instanceIdParamValidator(),
  body('phoneNumber')
    .optional({ nullable: true })
    .custom((value, { req }) => {
      if (value === undefined || value === null) {
        return true;
      }

      if (typeof value !== 'string') {
        throw new Error('Informe um telefone válido para parear por código.');
      }

      const trimmed = value.trim();

      if (!trimmed) {
        throw new Error('Informe um telefone válido para parear por código.');
      }

      try {
        const normalized = normalizePhoneNumber(trimmed);
        const request = req as Request;
        (request.body as Record<string, unknown>).phoneNumber = normalized.e164;
        return true;
      } catch (error) {
        const message =
          error instanceof PhoneNormalizationError
            ? error.message
            : 'Informe um telefone válido para parear por código.';
        throw new Error(message);
      }
    }),
  body('code').optional({ nullable: true }).isString().bail().trim().isLength({ min: 1 }).withMessage('Informe um código de pareamento válido.'),
  validateRequest,
  requireTenant,
  asyncHandler(connectInstanceHandler),
];

// POST /api/integrations/whatsapp/instances/:id/pair - Pair a WhatsApp instance
router.post('/whatsapp/instances/:id/pair', ...pairInstanceMiddleware);

// POST /api/integrations/whatsapp/instances/pair - Pair the default WhatsApp instance
router.post(
  '/whatsapp/instances/pair',
  body('instanceId').optional().isString().trim().notEmpty(),
  validateRequest,
  requireTenant,
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(410).json({
      success: false,
      error: {
        code: 'PAIR_ROUTE_MISSING_ID',
        message:
          'Esta rota foi descontinuada. Utilize POST /api/integrations/whatsapp/instances/:id/pair com o ID da instância.',
      },
    });
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
    const instanceId = readInstanceIdParam(req);
    if (!instanceId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INSTANCE_ID',
          message: INVALID_INSTANCE_ID_MESSAGE,
        },
      });
      return;
    }
    const wipe = typeof req.body?.wipe === 'boolean' ? req.body.wipe : undefined;
    const disconnectOptions = wipe === undefined ? undefined : { wipe };
    const tenantId = resolveRequestTenantId(req);

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

      let cachedContext: InstanceOperationContext | null = null;

      try {
        await whatsappBrokerClient.disconnectInstance(instance.brokerId, {
          ...(disconnectOptions ?? {}),
          instanceId: instance.id,
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
            logger.info('whatsapp.instance.disconnect.alreadyBroker', {
              tenantId,
              instanceId: instance.id,
              status: brokerStatus,
              code: brokerError.code,
              requestId: brokerError.requestId,
            });
            cachedContext = await resolveInstanceOperationContext(
              tenantId,
              instance as StoredInstance,
              {
                refresh: true,
              }
            );
          } else {
            throw brokerError;
          }
        } else {
          throw error;
        }
      }

      const context =
        cachedContext ??
        (await resolveInstanceOperationContext(tenantId, instance as StoredInstance, { refresh: true }));

      if (context.status.connected) {
        logger.warn('whatsapp.instance.disconnect.stillConnected', {
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
      if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
        respondWhatsAppBrokerFailure(res, error as WhatsAppBrokerError);
        return;
      }

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
    const instanceId = readInstanceIdParam(req);
    if (!instanceId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INSTANCE_ID',
          message: INVALID_INSTANCE_ID_MESSAGE,
        },
      });
      return;
    }
    const tenantId = resolveRequestTenantId(req);
    const wipe = typeof req.query?.wipe === 'boolean' ? (req.query.wipe as boolean) : false;

    let instance: PrismaWhatsAppInstance | null = null;

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

      instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

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

      const ensuredInstance = instance;

      const campaignsToRemove: Array<{ id: string; name: string | null }> = await prisma.campaign.findMany({
        where: {
          tenantId,
          whatsappInstanceId: ensuredInstance.id,
        },
        select: {
          id: true,
          name: true,
        },
      });

      let brokerReportedMissing = false;
      try {
        await whatsappBrokerClient.deleteInstance(ensuredInstance.brokerId, {
          instanceId: ensuredInstance.id,
          wipe,
        });
      } catch (error) {
        if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
          const brokerError = error as WhatsAppBrokerError;
          const brokerStatus = readBrokerErrorStatus(brokerError);

          if (brokerStatus === 404 || isBrokerMissingInstanceError(brokerError)) {
            brokerReportedMissing = true;
            logger.info('whatsapp.instance.delete.brokerMissing', {
              tenantId,
              instanceId: ensuredInstance.id,
              brokerId: ensuredInstance.brokerId,
              status: brokerStatus,
              code: brokerError.code,
              requestId: brokerError.requestId,
            });
          } else {
            throw brokerError;
          }
        } else {
          throw error;
        }
      }

      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        if (campaignsToRemove.length > 0) {
          const campaignIds = campaignsToRemove.map((campaign) => campaign.id);
          await tx.campaign.deleteMany({ where: { id: { in: campaignIds } } });
        }

        await tx.whatsAppInstance.delete({ where: { id: ensuredInstance.id } });
      });

      logger.info('whatsapp.instance.delete.success', {
        tenantId,
        instanceId: ensuredInstance.id,
        actorId: req.user?.id ?? 'unknown',
        removedCampaigns: campaignsToRemove.length,
        campaignIds: campaignsToRemove.map((campaign) => campaign.id),
        wipe,
        brokerReportedMissing,
      });

      res.status(204).send();
    } catch (error: unknown) {
      if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
        const brokerError = error as WhatsAppBrokerError;
        const brokerStatus = readBrokerErrorStatus(brokerError);

        logger.warn('whatsapp.instance.delete.brokerFailed', {
          tenantId,
          instanceId: instance?.id ?? readInstanceIdParam(req),
          status: brokerStatus,
          code: brokerError.code,
          requestId: brokerError.requestId,
        });
        res.sendStatus(502);
        return;
      }

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
    const tenantId = resolveRequestTenantId(req);

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

      const result = await disconnectStoredInstance(
        tenantId,
        instance as StoredInstance,
        req.user?.id ?? 'system',
        wipe === undefined ? {} : { wipe }
      );

      if (result.outcome === 'retry') {
        res.status(202).json({
          success: true,
          data: {
            instanceId: instance.id,
            disconnected: false,
            existed: true,
            connected: null,
            pending: true,
            retry: {
              scheduledAt: result.retry.scheduledAt,
              status: result.retry.status,
              requestId: result.retry.requestId,
            },
          },
        });
        return;
      }

      const context = result.context;

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
      if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
        respondWhatsAppBrokerFailure(res, error as WhatsAppBrokerError);
        return;
      }

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
    const tenantId = resolveRequestTenantId(req);
    const actorId = req.user?.id ?? 'system';
    const instanceId = readInstanceIdParam(req);
    if (!instanceId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INSTANCE_ID',
          message: INVALID_INSTANCE_ID_MESSAGE,
        },
      });
      return;
    }
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
        const result = await disconnectStoredInstance(
          tenantId,
          storedInstance as StoredInstance,
          actorId,
          wipe === undefined ? {} : { wipe }
        );

        if (result.outcome === 'retry') {
          res.status(202).json({
            success: true,
            data: {
              instanceId: storedInstance.id,
              disconnected: false,
              existed: true,
              connected: null,
              pending: true,
              retry: {
                scheduledAt: result.retry.scheduledAt,
                status: result.retry.status,
                requestId: result.retry.requestId,
              },
            },
          });
          return;
        }

        const context = result.context;

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

        if (
          (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) &&
          (isBrokerAlreadyDisconnectedError(error) || readBrokerErrorStatus(error) === 409 || readBrokerErrorStatus(error) === 410)
        ) {
          const brokerError = error as WhatsAppBrokerError;
          const brokerStatus = readBrokerErrorStatus(brokerError);

          logger.info('whatsapp.instance.disconnect.directAlready', {
            tenantId,
            instanceId,
            status: brokerStatus,
            code: brokerError.code,
            requestId: brokerError.requestId,
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
          return;
        }

        if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
          const brokerError = error as WhatsAppBrokerError;
          const brokerStatus = readBrokerErrorStatus(brokerError);

          if (brokerStatus !== null && brokerStatus >= 500) {
            logger.warn('whatsapp.instance.disconnect.retryScheduled', {
              tenantId,
              instanceId,
              status: brokerStatus,
              code: brokerError.code,
              requestId: brokerError.requestId,
              wipe: Boolean(wipe),
            });

            const scheduledAt = new Date().toISOString();

            await scheduleWhatsAppDisconnectRetry(tenantId, {
              instanceId,
              status: brokerStatus,
              requestId: brokerError.requestId ?? null,
              wipe: Boolean(wipe),
              requestedAt: scheduledAt,
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
                  scheduledAt,
                  status: brokerStatus,
                  requestId: brokerError.requestId ?? null,
                },
              },
            });
            return;
          }
        }

        if (handleWhatsAppIntegrationError(res, error)) {
          return;
        }

        throw error;
      }
    } catch (error) {
      if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
        respondWhatsAppBrokerFailure(res, error as WhatsAppBrokerError);
        return;
      }

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
    const instanceId = readInstanceIdParam(req);
    if (!instanceId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INSTANCE_ID',
          message: INVALID_INSTANCE_ID_MESSAGE,
        },
      });
      return;
    }
    const tenantId = resolveRequestTenantId(req);

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
      if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
        const brokerError = error as WhatsAppBrokerError;
        const brokerStatus = readBrokerErrorStatus(brokerError);

        if (brokerStatus === 404 || isBrokerMissingInstanceError(brokerError)) {
          res.sendStatus(404);
          return;
        }

        logger.warn('whatsapp.instance.qr.brokerFailed', {
          tenantId,
          instanceId,
          status: brokerStatus,
          code: brokerError.code,
          requestId: brokerError.requestId,
        });
        res.sendStatus(502);
        return;
      }

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
    const instanceId = readInstanceIdParam(req);
    if (!instanceId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INSTANCE_ID',
          message: INVALID_INSTANCE_ID_MESSAGE,
        },
      });
      return;
    }
    const tenantId = resolveRequestTenantId(req);

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
      if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
        respondWhatsAppBrokerFailure(res, error as WhatsAppBrokerError);
        return;
      }

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
    const tenantId = resolveRequestTenantId(req);

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
      if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
        respondWhatsAppBrokerFailure(res, error as WhatsAppBrokerError);
        return;
      }

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
    const tenantId = resolveRequestTenantId(req);

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
    const instanceId = readInstanceIdParam(req);
    if (!instanceId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INSTANCE_ID',
          message: INVALID_INSTANCE_ID_MESSAGE,
        },
      });
      return;
    }
    const tenantId = resolveRequestTenantId(req);

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

router.post(
  '/whatsapp/instances/:id/exists',
  instanceIdParamValidator(),
  body('to').isString().trim().notEmpty(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = readInstanceIdParam(req);
    if (!instanceId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INSTANCE_ID',
          message: INVALID_INSTANCE_ID_MESSAGE,
        },
      });
      return;
    }
    const tenantId = resolveRequestTenantId(req);
    const to = typeof req.body?.to === 'string' ? req.body.to.trim() : '';

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

      const transport = getWhatsAppTransport();
      const exists = await transport.checkRecipient({
        sessionId: instance.brokerId,
        instanceId: instance.id,
        to,
      });

      res.json({
        success: true,
        data: exists,
      });
    } catch (error: unknown) {
      if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
        respondWhatsAppBrokerFailure(res, error as WhatsAppBrokerError);
        return;
      }

      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }

      throw error;
    }
  })
);

router.get(
  '/whatsapp/instances/:id/groups',
  instanceIdParamValidator(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = readInstanceIdParam(req);
    if (!instanceId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INSTANCE_ID',
          message: INVALID_INSTANCE_ID_MESSAGE,
        },
      });
      return;
    }
    const tenantId = resolveRequestTenantId(req);

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

      const transport = getWhatsAppTransport();
      const groups = await transport.getGroups({
        sessionId: instance.brokerId,
        instanceId: instance.id,
      });

      res.json({
        success: true,
        data: groups,
      });
    } catch (error: unknown) {
      if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
        respondWhatsAppBrokerFailure(res, error as WhatsAppBrokerError);
        return;
      }

      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }

      throw error;
    }
  })
);

router.get(
  '/whatsapp/instances/:id/metrics',
  instanceIdParamValidator(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = readInstanceIdParam(req);
    if (!instanceId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INSTANCE_ID',
          message: INVALID_INSTANCE_ID_MESSAGE,
        },
      });
      return;
    }
    const tenantId = resolveRequestTenantId(req);

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

      const metrics = await whatsappBrokerClient.getMetrics({
        sessionId: instance.brokerId,
        instanceId: instance.id,
      });

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error: unknown) {
      if (error instanceof WhatsAppBrokerError || hasErrorName(error, 'WhatsAppBrokerError')) {
        respondWhatsAppBrokerFailure(res, error as WhatsAppBrokerError);
        return;
      }

      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }

      throw error;
    }
  })
);

router.post('/whatsapp/session/connect', requireTenant, (_req: Request, res: Response) => {
  respondLegacyEndpointGone(
    res,
    'Esta rota foi descontinuada. Utilize POST /api/integrations/whatsapp/instances/:id/pair e acompanhe o status via GET /api/integrations/whatsapp/instances/:id/status.'
  );
});

router.post('/whatsapp/session/logout', requireTenant, (_req: Request, res: Response) => {
  respondLegacyEndpointGone(
    res,
    'Esta rota foi descontinuada. Utilize POST /api/integrations/whatsapp/instances/:id/logout para encerrar a sessão.'
  );
});

router.get('/whatsapp/session/status', requireTenant, (_req: Request, res: Response) => {
  respondLegacyEndpointGone(
    res,
    'Esta rota foi descontinuada. Consulte GET /api/integrations/whatsapp/instances/:id/status para obter o andamento da conexão.'
  );
});

// POST /api/integrations/whatsapp/instances/:instanceId/polls - Criar enquete
router.post(
  '/whatsapp/instances/:id/polls',
  instanceIdParamValidator(),
  body('to').isString().isLength({ min: 1 }),
  body('question').isString().isLength({ min: 1 }),
  body('options').isArray({ min: 2 }),
  body('options.*').isString().isLength({ min: 1 }),
  body('allowMultipleAnswers').optional().isBoolean().toBoolean(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const { id: instanceId } = req.params as { id: string };

    const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

    if (!instance) {
      res.locals.errorCode = 'INSTANCE_NOT_FOUND';
      res.status(404).json({
        success: false,
        error: {
          code: 'INSTANCE_NOT_FOUND',
          message: 'Instância WhatsApp não encontrada.',
        },
      });
      return;
    }

    const isConnected =
      instance.connected ?? (typeof instance.status === 'string' && instance.status === 'connected');

    if (!isConnected) {
      res.locals.errorCode = 'INSTANCE_DISCONNECTED';
      res.status(409).json({
        success: false,
        error: {
          code: 'INSTANCE_DISCONNECTED',
          message: 'A instância de WhatsApp está desconectada.',
          details: {
            status: instance.status ?? null,
            connected: instance.connected ?? null,
          },
        },
      });
      return;
    }

    const { to, question, options, allowMultipleAnswers } = req.body as {
      to: string;
      question: string;
      options: string[];
      allowMultipleAnswers?: boolean;
    };

    try {
      const transport = getWhatsAppTransport();
      const pollPayload = {
        sessionId: instance.id,
        instanceId: instance.id,
        to,
        question,
        options,
        ...(typeof allowMultipleAnswers === 'boolean' ? { allowMultipleAnswers } : {}),
      } satisfies Parameters<typeof transport.createPoll>[0];

      const poll = await transport.createPoll(pollPayload);

      const ack = normalizeBaileysAck(poll?.ack);
      const statusValue = poll?.status;
      const status =
        typeof statusValue === 'string' && statusValue.trim().length > 0
          ? statusValue
          : 'queued';

      if (isBaileysAckFailure(ack, statusValue)) {
        res.status(502).json({
          success: false,
          error: {
            code: 'WHATSAPP_POLL_FAILED',
            message: 'WhatsApp retornou falha ao criar a enquete.',
            details: {
              ack,
              status: typeof statusValue === 'string' ? statusValue : null,
              id: poll?.id ?? null,
            },
          },
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: {
          poll: {
            id: poll?.id ?? null,
            status,
            ack,
            raw: poll?.raw ?? null,
          },
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

export const __testing = {
  collectNumericFromSources,
  locateStatusCountsCandidate,
  normalizeStatusCountsData,
  locateRateSourceCandidate,
  normalizeRateUsageData,
  serializeStoredInstance,
  syncInstancesFromBroker,
};

export { router as integrationsRouter };
