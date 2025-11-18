// Auto-generated WhatsApp instance services module
import { Prisma, WhatsAppInstanceStatus } from '@prisma/client';
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
import { whatsappHttpRequestsCounter } from '../../../lib/metrics';
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
import { createSyncInstancesFromBroker } from './sync';
import {
  getLastSyncAt,
  setLastSyncAt,
  getCachedSnapshots,
  setCachedSnapshots,
  removeCachedSnapshot,
  scheduleWhatsAppDisconnectRetry,
  clearWhatsAppDisconnectRetry,
  SYNC_TTL_MS,
} from './cache';
import {
  normalizeInstanceStatusResponse,
  normalizeQr,
  extractQrImageBuffer,
} from './qr';

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

export const collectInstancesForTenant = async (
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
      safeIncrementHttpCounter();
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
        safeIncrementHttpCounter();
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

  const context = await resolveInstanceOperationContext(tenantId, stored, contextOptions);

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
