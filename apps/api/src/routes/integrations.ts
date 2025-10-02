import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { Prisma, WhatsAppInstanceStatus } from '@prisma/client';
import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import {
  whatsappBrokerClient,
  WhatsAppBrokerNotConfiguredError,
  type WhatsAppStatus,
} from '../services/whatsapp-broker-client';
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
  status: 'connected' | 'connecting' | 'disconnected' | 'qr_required' | 'error';
  connected: boolean;
  createdAt: string | null;
  lastActivity: string | null;
  phoneNumber: string | null;
  user: string | null;
  stats?: unknown;
  metrics?: Record<string, unknown> | null;
  messages?: Record<string, unknown> | null;
  rate?: Record<string, unknown> | null;
  rawStatus?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
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
    stats:
      (typeof source.stats === 'object' && source.stats !== null
        ? source.stats
        : typeof metadata.stats === 'object' && metadata.stats !== null
          ? metadata.stats
          : undefined),
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

const buildHistoryEntry = (action: string, actorId: string, details?: Record<string, unknown>) => ({
  action,
  by: actorId,
  at: new Date().toISOString(),
  ...(details ?? {}),
});

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
    default:
      return 'error';
  }
};

const resolvePhoneNumber = (
  instance: StoredInstance,
  metadata: Record<string, unknown>,
  brokerStatus?: WhatsAppStatus | null
): string | null => {
  const phone = pickString(
    instance.phoneNumber,
    metadata.phoneNumber,
    metadata.phone_number,
    metadata.msisdn,
    metadata.phone,
    metadata.number,
    brokerStatus ? ((brokerStatus as unknown) as Record<string, unknown>).phoneNumber : null
  );

  return phone ?? null;
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
  const stats =
    brokerStatus?.stats ??
    brokerStatus?.messages ??
    ((instance.metadata as Record<string, unknown> | null)?.stats as unknown) ??
    undefined;
  const metrics =
    brokerStatus?.metrics ??
    (typeof stats === 'object' && stats !== null ? (stats as Record<string, unknown>) : null);
  const messages = brokerStatus?.messages ?? null;
  const rate = brokerStatus?.rate ?? brokerStatus?.rateUsage ?? null;
  const rawStatus =
    brokerStatus?.raw && typeof brokerStatus.raw === 'object' && brokerStatus.raw !== null
      ? (brokerStatus.raw as Record<string, unknown>)
      : brokerStatus
        ? (brokerStatus as unknown as Record<string, unknown>)
        : null;

  const baseMetadata = (instance.metadata as Record<string, unknown> | null) ?? {};
  const metadata: Record<string, unknown> = { ...baseMetadata };

  if (brokerStatus?.metrics && typeof brokerStatus.metrics === 'object') {
    metadata.brokerMetrics = brokerStatus.metrics;
  }
  if (brokerStatus?.rateUsage && typeof brokerStatus.rateUsage === 'object') {
    metadata.brokerRateUsage = brokerStatus.rateUsage;
  }

  const phoneNumber = resolvePhoneNumber(instance, metadata, brokerStatus);

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
    stats,
    metrics,
    messages,
    rate,
    rawStatus,
    metadata,
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

const syncInstancesFromBroker = async (tenantId: string, existing: StoredInstance[]): Promise<StoredInstance[]> => {
  const brokerInstances = await whatsappBrokerClient.listInstances(tenantId);

  if (!brokerInstances.length) {
    logger.info('🛰️ [WhatsApp] Broker returned zero instances', { tenantId });
    return existing;
  }

  const existingMap = new Map(existing.map((item) => [item.id, item]));

  logger.info('🛰️ [WhatsApp] Broker instances snapshot', {
    tenantId,
    brokerCount: brokerInstances.length,
    ids: brokerInstances.map((instance) => instance.id),
  });

  for (const brokerInstance of brokerInstances) {
    const instanceId = typeof brokerInstance.id === 'string' ? brokerInstance.id.trim() : '';
    if (!instanceId) {
      continue;
    }

    let brokerStatus: WhatsAppStatus | null = null;
    try {
      brokerStatus = await whatsappBrokerClient.getStatus(instanceId, { instanceId });
    } catch (error) {
      if (error instanceof WhatsAppBrokerNotConfiguredError) {
        throw error;
      }
    }

    const existingInstance = existingMap.get(instanceId) ?? null;
    const derivedStatus = brokerStatus
      ? mapBrokerStatusToDbStatus(brokerStatus)
      : mapBrokerInstanceStatusToDbStatus(brokerInstance.status ?? null);
    const derivedConnected = brokerStatus?.connected ?? Boolean(brokerInstance.connected);
    const phoneNumber = ((): string | null => {
      const metadata = (existingInstance?.metadata as Record<string, unknown> | null) ?? {};
      const brokerMetadata = brokerStatus?.raw && typeof brokerStatus.raw === 'object' ? (brokerStatus.raw as Record<string, unknown>) : {};
      return (
        pickString(
          brokerInstance.phoneNumber,
          metadata.phoneNumber,
          metadata.phone_number,
          brokerMetadata.phoneNumber,
          brokerMetadata.phone_number
        ) ?? null
      );
    })();

    const historyEntry = buildHistoryEntry('broker-sync', 'system', {
      status: derivedStatus,
      connected: derivedConnected,
      phoneNumber,
    });

    if (existingInstance) {
      logger.info('🛰️ [WhatsApp] Sync updating stored instance from broker', {
        tenantId,
        instanceId,
        status: derivedStatus,
        connected: derivedConnected,
        phoneNumber,
      });
      await prisma.whatsAppInstance.update({
        where: { id: existingInstance.id },
        data: {
          tenantId,
          name: brokerInstance.name ?? existingInstance.name ?? instanceId,
          status: derivedStatus,
          connected: derivedConnected,
          ...(phoneNumber ? { phoneNumber } : {}),
          metadata: appendInstanceHistory(existingInstance.metadata as InstanceMetadata, historyEntry),
        },
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

      await prisma.whatsAppInstance.create({
        data: {
          id: instanceId,
          tenantId,
          name: brokerInstance.name ?? instanceId,
          brokerId: instanceId,
          status: derivedStatus,
          connected: derivedConnected,
          phoneNumber,
          metadata: appendInstanceHistory(baseMetadata, historyEntry),
        },
      });
    }
  }

  return prisma.whatsAppInstance.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
  });
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
    const refreshRequested =
      req.query.refresh === '1' || req.query.refresh === 'true' || req.query.refresh === 'yes';

    logger.info('🛰️ [WhatsApp] List instances requested', {
      tenantId,
      refreshRequested,
    });

    try {
      let storedInstances = await prisma.whatsAppInstance.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
      });

      if (refreshRequested || storedInstances.length === 0) {
        storedInstances = await syncInstancesFromBroker(tenantId, storedInstances);
        logger.info('🛰️ [WhatsApp] Broker sync completed', {
          tenantId,
          storedAfterSync: storedInstances.length,
        });
      }

      const normalized = await Promise.all(
        storedInstances.map(async (instance) => {
          let brokerStatus: WhatsAppStatus | null = null;

          try {
            brokerStatus = await whatsappBrokerClient.getStatus(instance.brokerId, {
              instanceId: instance.id,
            });
            if (brokerStatus?.status === 'disconnected') {
              logger.warn('WhatsApp instance reported as disconnected', {
                tenantId: instance.tenantId,
                instanceId: instance.id,
              });
            }
          } catch (error) {
            if (error instanceof WhatsAppBrokerNotConfiguredError) {
              throw error;
            }
            brokerStatus = null;
          }

          const derivedStatus = brokerStatus ? mapBrokerStatusToDbStatus(brokerStatus) : instance.status;
          const derivedConnected = brokerStatus?.connected ?? instance.connected;
          const derivedLastSeenAt = brokerStatus?.connected ? new Date() : instance.lastSeenAt;

          if (brokerStatus) {
            const metadataWithHistory = appendInstanceHistory(
              instance.metadata as InstanceMetadata,
              buildHistoryEntry('status-sync', 'system', {
                status: derivedStatus,
                connected: derivedConnected,
              })
            );
            await prisma.whatsAppInstance.update({
              where: { id: instance.id },
              data: {
                status: derivedStatus,
                connected: derivedConnected,
                lastSeenAt: derivedLastSeenAt,
                metadata: metadataWithHistory,
              },
            });
          }

          const serialized = serializeStoredInstance(
            {
              ...instance,
              status: derivedStatus,
              connected: derivedConnected,
              lastSeenAt: derivedLastSeenAt,
            } as StoredInstance,
            brokerStatus
          );

          if (serialized.phoneNumber && serialized.phoneNumber !== instance.phoneNumber) {
            await prisma.whatsAppInstance.update({
              where: { id: instance.id },
              data: { phoneNumber: serialized.phoneNumber },
            });
          }

          const { brokerId: _brokerId, ...responseInstance } = serialized;
          return responseInstance;
        })
      );

      logger.info('🛰️ [WhatsApp] Returning instances to client', {
        tenantId,
        count: normalized.length,
      });

      res.json({
        success: true,
        data: normalized,
      });
    } catch (error) {
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
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { id, name } = req.body as { id?: string; name: string };

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
    try {
      const existing = await prisma.whatsAppInstance.findFirst({
        where: {
          tenantId,
          OR: [
            { name: normalizedName },
            {
              metadata: {
                path: ['slug'],
                equals: slugCandidate,
              },
            },
          ],
        },
        select: { id: true },
      });

      if (existing) {
        res.status(409).json({
          success: false,
          error: {
            code: 'INSTANCE_NAME_IN_USE',
            message: 'Já existe uma instância com este nome para o tenant.',
          },
        });
        return;
      }

      const normalizedId = await ensureUniqueInstanceId(tenantId, requestedIdSource);
      const actorId = req.user?.id ?? 'system';
      const metadata = appendInstanceHistory(
        { displayId: normalizedId, slug: slugCandidate },
        buildHistoryEntry('created', actorId, { name: normalizedName })
      );
      const instance = await prisma.whatsAppInstance.create({
        data: {
          id: normalizedId,
          tenantId,
          name: normalizedName,
          brokerId: normalizedId,
          status: 'disconnected',
          connected: false,
          metadata,
        },
      });

      const { brokerId: _brokerId, ...payload } = serializeStoredInstance(instance as StoredInstance, null);

      logger.info('WhatsApp instance created', {
        tenantId,
        instanceId: normalizedId,
        actorId,
      });

      res.status(201).json({
        success: true,
        data: payload,
      });
    } catch (error) {
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

      throw error;
    }
  })
);

// POST /api/integrations/whatsapp/instances/:id/start - Connect a WhatsApp instance
router.post(
  '/whatsapp/instances/:id/start',
  param('id').isString().isLength({ min: 1 }),
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

      await whatsappBrokerClient.connectInstance(instance.brokerId, { instanceId: instance.id });
      const status = await whatsappBrokerClient.getStatus(instance.brokerId, { instanceId: instance.id });

      const historyEntry = buildHistoryEntry('connect-instance', req.user?.id ?? 'system', {
        status: status.status,
        connected: status.connected,
      });

      if (!status.connected) {
        logger.warn('WhatsApp instance did not report connected status after connect', {
          tenantId,
          instanceId: instance.id,
          status: status.status,
        });
      }

      const updates: Prisma.WhatsAppInstanceUpdateInput = {
        status: mapBrokerStatusToDbStatus(status),
        connected: status.connected,
        metadata: appendInstanceHistory(instance.metadata as InstanceMetadata, historyEntry),
      };

      if (status.connected) {
        updates.lastSeenAt = new Date();
      }

      await prisma.whatsAppInstance.update({
        where: { id: instance.id },
        data: updates,
      });

      res.json({
        success: true,
        data: normalizeInstanceStatusResponse(status),
      });
    } catch (error) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }
      throw error;
    }
  })
);

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

      await whatsappBrokerClient.connectInstance(instance.brokerId, { instanceId: instance.id });
      const status = await whatsappBrokerClient.getStatus(instance.brokerId, { instanceId: instance.id });

      const metadataEntry = buildHistoryEntry('connect-instance', req.user?.id ?? 'system', {
        status: status.status,
        connected: status.connected,
      });

      await prisma.whatsAppInstance.update({
        where: { id: instance.id },
        data: {
          status: mapBrokerStatusToDbStatus(status),
          connected: status.connected,
          metadata: appendInstanceHistory(instance.metadata as InstanceMetadata, metadataEntry),
          lastSeenAt: status.connected ? new Date() : instance.lastSeenAt,
        },
      });

      res.json({
        success: true,
        data: {
          instanceId: instance.id,
          ...normalizeInstanceStatusResponse(status),
        },
      });
    } catch (error) {
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
  param('id').isString().isLength({ min: 1 }),
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
      const status = await whatsappBrokerClient.getStatus(instance.brokerId, { instanceId: instance.id });

      const historyEntry = buildHistoryEntry('disconnect-instance', req.user?.id ?? 'system', {
        status: status.status,
        connected: status.connected,
        wipe: Boolean(wipe),
      });

      if (status.connected) {
        logger.warn('WhatsApp instance still connected after disconnect request', {
          tenantId,
          instanceId: instance.id,
          status: status.status,
        });
      }

      const updates: Prisma.WhatsAppInstanceUpdateInput = {
        status: mapBrokerStatusToDbStatus(status),
        connected: status.connected,
        metadata: appendInstanceHistory(instance.metadata as InstanceMetadata, historyEntry),
      };

      if (!status.connected) {
        updates.lastSeenAt = new Date();
      }

      await prisma.whatsAppInstance.update({
        where: { id: instance.id },
        data: updates,
      });

      res.json({
        success: true,
        data: normalizeInstanceStatusResponse(status),
      });
    } catch (error) {
      if (handleWhatsAppIntegrationError(res, error)) {
        return;
      }
      throw error;
    }
  })
);

router.delete(
  '/whatsapp/instances/:id',
  param('id').isString().isLength({ min: 1 }),
  query('wipe').optional().isBoolean().toBoolean(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const instanceId = req.params.id;
    const tenantId = req.user!.tenantId;
    const wipe = typeof req.query?.wipe === 'boolean' ? (req.query.wipe as boolean) : false;

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

      if (instance.connected) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INSTANCE_CONNECTED',
            message: 'Desconecte a instância antes de removê-la.',
          },
        });
        return;
      }

      const activeCampaigns = await prisma.campaign.count({
        where: {
          tenantId,
          whatsappInstanceId: instance.id,
          status: 'active',
        },
      });

      if (activeCampaigns > 0) {
        res.status(409).json({
          success: false,
          error: {
            code: 'INSTANCE_IN_USE',
            message: 'Existem campanhas ativas associadas a esta instância.',
          },
        });
        return;
      }

      await whatsappBrokerClient.deleteInstance(instance.brokerId, {
        instanceId: instance.id,
        wipe,
      });

      await prisma.whatsAppInstance.delete({ where: { id: instance.id } });

      logger.info('WhatsApp instance deleted', {
        tenantId,
        instanceId: instance.id,
        actorId: req.user?.id ?? 'unknown',
        wipe,
      });

      res.status(204).send();
    } catch (error) {
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
      const status = await whatsappBrokerClient.getStatus(instance.brokerId, { instanceId: instance.id });

      const historyEntry = buildHistoryEntry('disconnect-instance', req.user?.id ?? 'system', {
        status: status.status,
        connected: status.connected,
        wipe: Boolean(wipe),
      });

      const updates: Prisma.WhatsAppInstanceUpdateInput = {
        status: mapBrokerStatusToDbStatus(status),
        connected: status.connected,
        metadata: appendInstanceHistory(instance.metadata as InstanceMetadata, historyEntry),
      };

      if (!status.connected) {
        updates.lastSeenAt = new Date();
      }

      await prisma.whatsAppInstance.update({
        where: { id: instance.id },
        data: updates,
      });

      res.json({
        success: true,
        data: {
          instanceId: instance.id,
          ...normalizeInstanceStatusResponse(status),
        },
      });
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
  param('id').isString().isLength({ min: 1 }),
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

      res.json({
        success: true,
        data: normalizeQr(qrCode),
      });
    } catch (error) {
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
  param('id').isString().isLength({ min: 1 }),
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
    } catch (error) {
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

      res.json({
        success: true,
        data: {
          instanceId: instance.id,
          ...normalizeQr(qrCode),
        },
      });
    } catch (error) {
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
    } catch (error) {
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
  param('id').isString().isLength({ min: 1 }),
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

      const status = await whatsappBrokerClient.getStatus(instance.brokerId, { instanceId: instance.id });

      await prisma.whatsAppInstance.update({
        where: { id: instance.id },
        data: {
          status: mapBrokerStatusToDbStatus(status),
          connected: status.connected,
          lastSeenAt: status.connected ? new Date() : instance.lastSeenAt,
        },
      });

      res.json({
        success: true,
        data: normalizeInstanceStatusResponse(status),
      });
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
// URA/Telephony Routes
// ============================================================================

// GET /api/integrations/ura/flows - Listar fluxos URA
router.get(
  '/ura/flows',
  requireTenant,
  asyncHandler(async (_req: Request, res: Response) => {
    // TODO: Implementar URAProvider.getFlows()
    const flows = [
      {
        id: 'flow-1',
        name: 'Atendimento Principal',
        isActive: true,
        steps: []
      }
    ];

    res.json({
      success: true,
      data: flows
    });
  })
);

// POST /api/integrations/ura/flows - Criar fluxo URA
router.post(
  '/ura/flows',
  body('name').isString().isLength({ min: 1, max: 100 }),
  body('steps').isArray(),
  body('isActive').optional().isBoolean(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, steps, isActive = true } = req.body as {
      name: string;
      steps: unknown[];
      isActive?: boolean;
    };

    // TODO: Implementar URAProvider.createFlow()
    const flow = {
      id: `flow-${Date.now()}`,
      name,
      steps,
      isActive
    };

    res.status(201).json({
      success: true,
      data: flow
    });
  })
);

// POST /api/integrations/ura/calls - Fazer chamada
router.post(
  '/ura/calls',
  body('to').isString(),
  body('flowId').optional().isString(),
  body('variables').optional().isObject(),
  body('scheduledAt').optional().isISO8601(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const { to, flowId, variables, scheduledAt } = req.body as {
      to: string;
      flowId?: string;
      variables?: Record<string, unknown>;
      scheduledAt?: string;
    };

    // TODO: Implementar URAProvider.makeCall()
    const call = {
      id: `call-${Date.now()}`,
      from: '+5511999999999',
      to,
      status: 'ringing',
      startTime: new Date(),
      flowId: flowId ?? null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      metadata: variables ?? null,
    };

    res.status(201).json({
      success: true,
      data: call
    });
  })
);

// GET /api/integrations/ura/calls/:id - Obter informações da chamada
router.get(
  '/ura/calls/:id',
  param('id').isString(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const callId = req.params.id;

    // TODO: Implementar URAProvider.getCall()
    const call = {
      id: callId,
      from: '+5511999999999',
      to: '+5511888888888',
      status: 'completed',
      startTime: new Date(Date.now() - 300000),
      endTime: new Date(),
      duration: 300,
      recording: 'https://example.com/recording.mp3'
    };

    res.json({
      success: true,
      data: call
    });
  })
);

// POST /api/integrations/ura/calls/:id/hangup - Desligar chamada
router.post(
  '/ura/calls/:id/hangup',
  param('id').isString(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const callId = req.params.id;

    // TODO: Implementar URAProvider.hangupCall()
    res.json({
      success: true,
      message: 'Call ended successfully',
      callId,
    });
  })
);

// POST /api/integrations/ura/calls/:id/transfer - Transferir chamada
router.post(
  '/ura/calls/:id/transfer',
  param('id').isString(),
  body('to').isString(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const callId = req.params.id;
    const { to } = req.body as { to: string };

    // TODO: Implementar URAProvider.transferCall()
    res.json({
      success: true,
      message: 'Call transferred successfully',
      callId,
      to,
    });
  })
);

// GET /api/integrations/ura/statistics - Estatísticas de chamadas
router.get(
  '/ura/statistics',
  query('startDate').isISO8601(),
  query('endDate').isISO8601(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const startDate = new Date(req.query.startDate as string);
    const endDate = new Date(req.query.endDate as string);

    // TODO: Implementar URAProvider.getCallStatistics()
    const statistics = {
      totalCalls: 150,
      answeredCalls: 120,
      failedCalls: 30,
      averageDuration: 180,
      answerRate: 0.8
    };

    res.json({
      success: true,
      data: {
        ...statistics,
        range: {
          startDate,
          endDate,
        },
      },
    });
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
      ura: {
        status: 'healthy',
        activeCalls: 0
      },
      timestamp: new Date()
    };

    res.json({
      success: true,
      data: health
    });
  })
);

export { router as integrationsRouter };
