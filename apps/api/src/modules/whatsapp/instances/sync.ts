import type { WhatsAppInstanceStatus } from '@prisma/client';
import type {
  WhatsAppBrokerInstanceSnapshot,
  WhatsAppStatus,
  WhatsAppInstance as BrokerWhatsAppInstance,
} from '../../../services/whatsapp-broker-client';
import type { emitToTenant as EmitToTenant } from '../../../lib/socket-registry';
import type { logger as Logger } from '../../../config/logger';
import type { whatsappBrokerClient as WhatsappBrokerClient } from '../../../services/whatsapp-broker-client';
import type { prisma as PrismaClient } from '../../../lib/prisma';
import type {
  InstanceArchiveRecord,
  InstanceMetadata,
  StoredInstance,
  MapBrokerStatusToDbStatus,
} from './types';
import type {
  appendInstanceHistory as AppendInstanceHistory,
  buildHistoryEntry as BuildHistoryEntry,
  findPhoneNumberInObject as FindPhoneNumberInObject,
  pickString as PickString,
  withInstanceLastError as WithInstanceLastError,
} from './helpers';

type PrismaClientInstance = PrismaClient;
type LoggerInstance = Logger;
type BrokerClientInstance = WhatsappBrokerClient;
type EmitFn = EmitToTenant;

type AppendInstanceHistoryFn = typeof AppendInstanceHistory;
type BuildHistoryEntryFn = typeof BuildHistoryEntry;
type WithInstanceLastErrorFn = typeof WithInstanceLastError;
type FindPhoneNumberFn = typeof FindPhoneNumberInObject;
type PickStringFn = typeof PickString;

type SnapshotDerivation = {
  instanceId: string;
  derivedStatus: WhatsAppInstanceStatus;
  derivedConnected: boolean;
  phoneNumber: string | null;
  historyEntry: ReturnType<BuildHistoryEntryFn>;
  brokerSnapshotMetadata: Record<string, unknown>;
  derivedLastSeenAt: Date | null;
  brokerInstance: BrokerWhatsAppInstance;
  brokerStatus: WhatsAppStatus | null;
};

type InstanceLookups = {
  byId: Map<string, StoredInstance>;
  byBrokerId: Map<string, StoredInstance>;
};

type SyncDependencies = {
  prisma: PrismaClientInstance;
  logger: LoggerInstance;
  whatsappBrokerClient: BrokerClientInstance;
  emitToTenant: EmitFn;
  readInstanceArchives: (tenantId: string, instanceIds: string[]) => Promise<Map<string, InstanceArchiveRecord>>;
  appendInstanceHistory: AppendInstanceHistoryFn;
  buildHistoryEntry: BuildHistoryEntryFn;
  withInstanceLastError: WithInstanceLastErrorFn;
  findPhoneNumberInObject: FindPhoneNumberFn;
  pickString: PickStringFn;
  mapBrokerStatusToDbStatus: MapBrokerStatusToDbStatus;
  mapBrokerInstanceStatusToDbStatus: (status: string | null | undefined) => WhatsAppInstanceStatus;
};

type CollectSnapshotsResult = {
  snapshots: WhatsAppBrokerInstanceSnapshot[];
  archivedInstances: Map<string, InstanceArchiveRecord>;
  lookups: InstanceLookups;
};

type ReconcileSummary = {
  created: Array<{ id: string; status: WhatsAppInstanceStatus; connected: boolean; phoneNumber: string | null }>;
  updated: Array<{ id: string; status: WhatsAppInstanceStatus; connected: boolean; phoneNumber: string | null }>;
  unchanged: string[];
};

type SnapshotAction = 'create' | 'update' | 'skip';

export type SyncInstancesResult = {
  instances: StoredInstance[];
  snapshots: WhatsAppBrokerInstanceSnapshot[];
};

const buildInstanceLookups = (existing: StoredInstance[]): InstanceLookups => {
  const lookups: InstanceLookups = {
    byId: new Map(existing.map((instance) => [instance.id, instance])),
    byBrokerId: new Map(),
  };

  for (const instance of existing) {
    if (typeof instance.brokerId !== 'string') {
      continue;
    }
    const trimmed = instance.brokerId.trim();
    if (!trimmed) {
      continue;
    }
    lookups.byBrokerId.set(trimmed, instance);
  }

  return lookups;
};

const collectSnapshots = async (
  deps: SyncDependencies,
  tenantId: string,
  existing: StoredInstance[],
  prefetchedSnapshots?: WhatsAppBrokerInstanceSnapshot[]
): Promise<CollectSnapshotsResult> => {
  const snapshots =
    prefetchedSnapshots ?? (await deps.whatsappBrokerClient.listInstances(tenantId));

  if (!snapshots.length) {
    deps.logger.info('whatsapp.instances.sync.brokerEmpty', { tenantId });
    return {
      snapshots,
      archivedInstances: new Map(),
      lookups: buildInstanceLookups(existing),
    };
  }

  const snapshotInstanceIds = snapshots
    .map((snapshot) => (typeof snapshot.instance?.id === 'string' ? snapshot.instance.id : ''))
    .filter((value) => value.length > 0);

  const archivedInstances = await deps.readInstanceArchives(tenantId, snapshotInstanceIds);
  const lookups = buildInstanceLookups(existing);

  deps.logger.info('whatsapp.instances.sync.snapshot', {
    tenantId,
    brokerCount: snapshots.length,
    ids: snapshots.map((snapshot) => snapshot.instance.id),
  });

  return { snapshots, archivedInstances, lookups };
};

const resolveSnapshotState = (
  existing: StoredInstance | null,
  archivedInstances: Map<string, InstanceArchiveRecord>,
  instanceId: string
): SnapshotAction => {
  if (existing) {
    return 'update';
  }
  const archiveRecord = archivedInstances.get(instanceId);
  if (archiveRecord?.deletedAt) {
    return 'skip';
  }
  return 'create';
};

const deriveSnapshot = (
  deps: SyncDependencies,
  snapshot: WhatsAppBrokerInstanceSnapshot,
  existingInstance: StoredInstance | null
): SnapshotDerivation | null => {
  const brokerInstance = snapshot.instance;
  const brokerStatus = snapshot.status ?? null;
  const instanceId = typeof brokerInstance.id === 'string' ? brokerInstance.id.trim() : '';
  if (!instanceId) {
    return null;
  }

  const derivedStatus = brokerStatus
    ? deps.mapBrokerStatusToDbStatus(brokerStatus)
    : deps.mapBrokerInstanceStatusToDbStatus(brokerInstance.status ?? null);
  const derivedConnected = brokerStatus?.connected ?? Boolean(brokerInstance.connected);

  const metadata = (existingInstance?.metadata as Record<string, unknown> | null) ?? {};
  const brokerMetadata = brokerStatus?.raw && typeof brokerStatus.raw === 'object' ? brokerStatus.raw : {};
  const phoneNumber =
    deps.pickString(
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
    ) ??
    deps.findPhoneNumberInObject(metadata) ??
    deps.findPhoneNumberInObject(brokerMetadata) ??
    deps.findPhoneNumberInObject(brokerStatus) ??
    null;

  const historyEntry = deps.buildHistoryEntry('broker-sync', 'system', {
    status: derivedStatus,
    connected: derivedConnected,
    ...(phoneNumber ? { phoneNumber } : {}),
    ...(brokerStatus?.metrics ? { metrics: brokerStatus.metrics } : {}),
    ...(brokerStatus?.stats ? { stats: brokerStatus.stats } : {}),
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

  const brokerRaw = brokerStatus?.raw && typeof brokerStatus.raw === 'object' ? brokerStatus.raw : null;
  const derivedLastSeenAt =
    derivedConnected
      ? new Date()
      : parseDateValue(brokerInstance.lastActivity) ??
        parseDateValue((brokerRaw as Record<string, unknown> | null)?.['lastActivity']) ??
        parseDateValue((brokerRaw as Record<string, unknown> | null)?.['lastSeen']) ??
        parseDateValue((brokerRaw as Record<string, unknown> | null)?.['last_active_at']) ??
        parseDateValue((brokerRaw as Record<string, unknown> | null)?.['lastSeenAt']) ??
        existingInstance?.lastSeenAt ??
        null;

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

  if (brokerStatus?.raw && typeof brokerStatus.raw === 'object') {
    brokerSnapshotMetadata.raw = brokerStatus.raw;
  }

  return {
    instanceId,
    derivedStatus,
    derivedConnected,
    phoneNumber,
    historyEntry,
    brokerSnapshotMetadata,
    derivedLastSeenAt,
    brokerInstance,
    brokerStatus,
  };
};

const reconcileExistingInstance = async (
  deps: SyncDependencies,
  tenantId: string,
  derived: SnapshotDerivation,
  existingInstance: StoredInstance
): Promise<boolean> => {
  const metadataWithHistory = deps.appendInstanceHistory(
    existingInstance.metadata as InstanceMetadata,
    derived.historyEntry
  ) as Record<string, unknown>;

  const hasBrokerName =
    typeof derived.brokerInstance.name === 'string' && derived.brokerInstance.name.trim().length > 0;
  const brokerNameCandidate = hasBrokerName ? derived.brokerInstance.name.trim() : null;
  const existingDisplayName =
    typeof metadataWithHistory.displayName === 'string' && metadataWithHistory.displayName.trim().length > 0
      ? metadataWithHistory.displayName.trim()
      : null;

  if (existingDisplayName && hasBrokerName && existingDisplayName !== brokerNameCandidate) {
    deps.logger.debug('whatsapp.instances.sync.preserveStoredName', {
      tenantId,
      instanceId: derived.instanceId,
      existingDisplayName,
      brokerNameCandidate,
      reason: 'preserve-user-defined-name',
    });
  } else if (hasBrokerName && !existingDisplayName) {
    deps.logger.debug('whatsapp.instances.sync.useBrokerDisplayNameFallback', {
      tenantId,
      instanceId: derived.instanceId,
      brokerNameCandidate,
      reason: 'no-stored-name',
    });
  }

  const metadataNickname =
    typeof metadataWithHistory.displayName === 'string' && metadataWithHistory.displayName.trim().length > 0
      ? metadataWithHistory.displayName.trim()
      : null;
  const preservedDisplayName =
    metadataNickname ?? existingDisplayName ?? (hasBrokerName ? brokerNameCandidate : derived.instanceId);
  metadataWithHistory.displayName = preservedDisplayName;
  metadataWithHistory.label = preservedDisplayName;
  metadataWithHistory.lastBrokerSnapshot = derived.brokerSnapshotMetadata;
  const metadataWithoutError = deps.withInstanceLastError(metadataWithHistory, null);

  const statusChanged = existingInstance.status !== derived.derivedStatus;
  const connectedChanged = existingInstance.connected !== derived.derivedConnected;
  const phoneChanged = (existingInstance.phoneNumber ?? null) !== (derived.phoneNumber ?? null);
  const hasChange = statusChanged || connectedChanged || phoneChanged;

  const updateData: Prisma.WhatsAppInstanceUpdateArgs['data'] = {
    tenantId,
    status: derived.derivedStatus,
    connected: derived.derivedConnected,
    brokerId: derived.instanceId,
    ...(derived.phoneNumber ? { phoneNumber: derived.phoneNumber } : {}),
    ...(derived.derivedLastSeenAt ? { lastSeenAt: derived.derivedLastSeenAt } : {}),
    metadata: metadataWithoutError,
  };

  await deps.prisma.whatsAppInstance.update({
    where: { id: existingInstance.id },
    data: updateData,
  });

  return hasChange;
};

const createStoredInstanceFromSnapshot = async (
  deps: SyncDependencies,
  tenantId: string,
  derived: SnapshotDerivation
): Promise<void> => {
  const baseMetadata: InstanceMetadata = {
    origin: 'broker-sync',
  };

  const metadataWithHistory = deps.appendInstanceHistory(baseMetadata, derived.historyEntry) as Record<
    string,
    unknown
  >;
  metadataWithHistory.lastBrokerSnapshot = derived.brokerSnapshotMetadata;
  const snapshotDisplayName =
    typeof derived.brokerInstance.name === 'string' && derived.brokerInstance.name.trim().length > 0
      ? derived.brokerInstance.name.trim()
      : derived.instanceId;
  metadataWithHistory.displayName = snapshotDisplayName;
  metadataWithHistory.label = snapshotDisplayName;
  metadataWithHistory.slug = derived.instanceId;
  const metadataWithoutError = deps.withInstanceLastError(metadataWithHistory, null);

  await deps.prisma.whatsAppInstance.create({
    data: {
      id: derived.instanceId,
      tenantId,
      name: snapshotDisplayName,
      brokerId: derived.instanceId,
      status: derived.derivedStatus,
      connected: derived.derivedConnected,
      phoneNumber: derived.phoneNumber,
      ...(derived.derivedLastSeenAt ? { lastSeenAt: derived.derivedLastSeenAt } : {}),
      metadata: metadataWithoutError,
    },
  });
};

const processSnapshot = async (
  deps: SyncDependencies,
  tenantId: string,
  snapshot: WhatsAppBrokerInstanceSnapshot,
  archivedInstances: Map<string, InstanceArchiveRecord>,
  lookups: InstanceLookups
): Promise<{ created?: ReconcileSummary['created'][number]; updated?: ReconcileSummary['updated'][number]; unchangedId?: string }> => {
  const lookupId =
    typeof snapshot.instance?.id === 'string' ? snapshot.instance.id.trim() : '';
  if (!lookupId) {
    return {};
  }

  const existingInstance =
    lookups.byId.get(lookupId) ?? lookups.byBrokerId.get(lookupId) ?? null;
  const derived = deriveSnapshot(deps, snapshot, existingInstance);
  if (!derived) {
    return {};
  }

  const action = resolveSnapshotState(existingInstance, archivedInstances, derived.instanceId);

  if (action === 'skip') {
    deps.logger.info('whatsapp.instances.sync.skipDeleted', {
      tenantId,
      instanceId: derived.instanceId,
      deletedAt: archivedInstances.get(derived.instanceId)?.deletedAt ?? null,
    });
    return {};
  }

  if (action === 'update' && existingInstance) {
    deps.logger.info('whatsapp.instances.sync.updateStored', {
      tenantId,
      instanceId: derived.instanceId,
      status: derived.derivedStatus,
      connected: derived.derivedConnected,
      phoneNumber: derived.phoneNumber,
    });

    const hasChange = await reconcileExistingInstance(deps, tenantId, derived, existingInstance);
    return hasChange
      ? {
          updated: {
            id: existingInstance.id,
            status: derived.derivedStatus,
            connected: derived.derivedConnected,
            phoneNumber: derived.phoneNumber,
          },
        }
      : { unchangedId: existingInstance.id };
  }

  deps.logger.info('whatsapp.instances.sync.createMissing', {
    tenantId,
    instanceId: derived.instanceId,
    status: derived.derivedStatus,
    connected: derived.derivedConnected,
    phoneNumber: derived.phoneNumber,
  });

  await createStoredInstanceFromSnapshot(deps, tenantId, derived);
  return {
    created: {
      id: derived.instanceId,
      status: derived.derivedStatus,
      connected: derived.derivedConnected,
      phoneNumber: derived.phoneNumber,
    },
  };
};

const reconcileSnapshots = async (
  deps: SyncDependencies,
  tenantId: string,
  snapshots: WhatsAppBrokerInstanceSnapshot[],
  archivedInstances: Map<string, InstanceArchiveRecord>,
  lookups: InstanceLookups
): Promise<ReconcileSummary> => {
  const summary: ReconcileSummary = {
    created: [],
    updated: [],
    unchanged: [],
  };

  for (const snapshot of snapshots) {
    const result = await processSnapshot(deps, tenantId, snapshot, archivedInstances, lookups);
    if (result.created) {
      summary.created.push(result.created);
    }
    if (result.updated) {
      summary.updated.push(result.updated);
    }
    if (result.unchangedId) {
      summary.unchanged.push(result.unchangedId);
    }
  }

  return summary;
};

const persistChanges = async (
  deps: SyncDependencies,
  tenantId: string,
  summary: ReconcileSummary
): Promise<StoredInstance[]> => {
  const refreshed = (await deps.prisma.whatsAppInstance.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
  })) as StoredInstance[];

  deps.emitToTenant(tenantId, 'whatsapp.instances.synced', {
    syncedAt: new Date().toISOString(),
    created: summary.created,
    updated: summary.updated,
    unchanged: summary.unchanged,
    count: {
      created: summary.created.length,
      updated: summary.updated.length,
      unchanged: summary.unchanged.length,
    },
  });

  return refreshed;
};

export const createSyncInstancesFromBroker = (deps: SyncDependencies) => {
  return async (
    tenantId: string,
    existing: StoredInstance[],
    prefetchedSnapshots?: WhatsAppBrokerInstanceSnapshot[]
  ): Promise<SyncInstancesResult> => {
    const { snapshots, archivedInstances, lookups } = await collectSnapshots(
      deps,
      tenantId,
      existing,
      prefetchedSnapshots
    );

    if (!snapshots.length) {
      return { instances: existing, snapshots };
    }

    const summary = await reconcileSnapshots(
      deps,
      tenantId,
      snapshots,
      archivedInstances,
      lookups
    );

    const instances = await persistChanges(deps, tenantId, summary);
    return { instances, snapshots };
  };
};
