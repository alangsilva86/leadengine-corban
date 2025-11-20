import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import type { NormalizedInstance, PrismaTransactionClient, StoredInstance } from './types';
import { logWhatsAppStorageError, observeStorageLatency } from './errors';

const WHATSAPP_INSTANCE_ARCHIVE_KEY_PREFIX = 'whatsapp:instance:archive:';

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
    return value.map((entry) => toJsonValue(entry));
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

const buildInstanceArchiveKey = (tenantId: string, instanceId: string): string => {
  return `${WHATSAPP_INSTANCE_ARCHIVE_KEY_PREFIX}${tenantId}:${instanceId}`;
};

type ArchiveSnapshotPayload = {
  tenantId: string;
  stored: StoredInstance;
  actorId: string;
  deletedAt: string;
  serialized: Record<string, unknown>;
  status: unknown;
  qr: unknown;
  brokerStatus: unknown;
  instances: NormalizedInstance[];
};

export const archiveInstanceSnapshot = async (
  client: PrismaTransactionClient | typeof prisma,
  input: ArchiveSnapshotPayload
): Promise<void> => {
  const { tenantId, stored, actorId, deletedAt, serialized, status, qr, brokerStatus, instances } = input;

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
    status: toJsonValue(status) ?? null,
    qr: toJsonValue(qr) ?? null,
    brokerStatus: toJsonValue(brokerStatus) ?? null,
    history: toJsonArray(history),
    instancesBeforeDeletion: toJsonArray(instances),
  };

  const normalizedBrokerId =
    typeof stored.brokerId === 'string' ? stored.brokerId.trim() : '';

  const targets: Array<{ key: string; value: Prisma.JsonObject }> = [
    { key: buildInstanceArchiveKey(tenantId, stored.id), value: archivePayload },
  ];

  if (normalizedBrokerId && normalizedBrokerId !== stored.id) {
    targets.push({
      key: buildInstanceArchiveKey(tenantId, normalizedBrokerId),
      value: {
        deletedAt,
        aliasOf: stored.id,
        instanceId: stored.id,
        brokerId: normalizedBrokerId,
      } satisfies Prisma.JsonObject,
    });
  }

  for (const target of targets) {
    const startedAt = Date.now();
    try {
      await client.integrationState.upsert({
        where: { key: target.key },
        update: { value: target.value },
        create: { key: target.key, value: target.value },
      });
      observeStorageLatency('archiveInstanceSnapshot', startedAt, 'success', {
        tenantId,
        instanceId: stored.id,
        operationType: 'snapshot.write',
      });
    } catch (error) {
      observeStorageLatency('archiveInstanceSnapshot', startedAt, 'failure', {
        tenantId,
        instanceId: stored.id,
        operationType: 'snapshot.write',
      });
      if (!logWhatsAppStorageError('archiveInstanceSnapshot', error, { tenantId, key: target.key, instanceId: stored.id })) {
        throw error;
      }
    }
  }
};

export const archiveDetachedInstance = async (
  tenantId: string,
  instanceId: string,
  actorId: string | null,
  brokerId?: string | null
): Promise<string> => {
  const normalizedInstanceId = typeof instanceId === 'string' ? instanceId.trim() : '';
  if (!normalizedInstanceId) {
    return new Date().toISOString();
  }

  const deletedAt = new Date().toISOString();
  const normalizedBrokerId = typeof brokerId === 'string' ? brokerId.trim() : '';

  const basePayload: Prisma.JsonObject = {
    tenantId,
    instanceId: normalizedInstanceId,
    brokerId: normalizedBrokerId || null,
    deletedAt,
    actorId: actorId ?? 'system',
    stored: null,
    status: null,
    qr: null,
    brokerStatus: null,
    history: [],
    instancesBeforeDeletion: [],
  };

  const targets: Array<{ key: string; value: Prisma.JsonObject }> = [
    { key: buildInstanceArchiveKey(tenantId, normalizedInstanceId), value: basePayload },
  ];

  if (normalizedBrokerId && normalizedBrokerId !== normalizedInstanceId) {
    targets.push({
      key: buildInstanceArchiveKey(tenantId, normalizedBrokerId),
      value: {
        ...basePayload,
        instanceId: normalizedBrokerId,
        brokerId: normalizedInstanceId,
      },
    });
  }

  for (const target of targets) {
    const startedAt = Date.now();
    try {
      await prisma.integrationState.upsert({
        where: { key: target.key },
        update: { value: target.value },
        create: { key: target.key, value: target.value },
      });
      observeStorageLatency('archiveDetachedInstance', startedAt, 'success', {
        tenantId,
        instanceId: normalizedInstanceId,
        operationType: 'snapshot.write',
      });
    } catch (error) {
      observeStorageLatency('archiveDetachedInstance', startedAt, 'failure', {
        tenantId,
        instanceId: normalizedInstanceId,
        operationType: 'snapshot.write',
      });
      if (!logWhatsAppStorageError('archiveDetachedInstance', error, { tenantId, key: target.key, instanceId: normalizedInstanceId })) {
        throw error;
      }
    }
  }

  return deletedAt;
};

export const readInstanceArchives = async (
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
  const keys = normalizedIds.map((value) => `${keyPrefix}${value}`);

  let rows;
  const startedAt = Date.now();
  try {
    rows = await prisma.integrationState.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });
    observeStorageLatency('readInstanceArchives', startedAt, 'success', {
      tenantId,
      operationType: 'snapshot.read',
    });
  } catch (error) {
    observeStorageLatency('readInstanceArchives', startedAt, 'failure', {
      tenantId,
      operationType: 'snapshot.read',
    });
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

export const clearInstanceArchive = async (
  tenantId: string,
  ...instanceIds: Array<string | null | undefined>
): Promise<void> => {
  const normalizedIds = Array.from(
    new Set(
      instanceIds
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0)
    )
  );

  if (normalizedIds.length === 0) {
    return;
  }

  for (const instanceId of normalizedIds) {
    const key = buildInstanceArchiveKey(tenantId, instanceId);

    const startedAt = Date.now();
    try {
      await prisma.integrationState.delete({ where: { key } });
      observeStorageLatency('clearInstanceArchive', startedAt, 'success', {
        tenantId,
        instanceId,
        operationType: 'snapshot.write',
      });
    } catch (error) {
      observeStorageLatency('clearInstanceArchive', startedAt, 'failure', {
        tenantId,
        instanceId,
        operationType: 'snapshot.write',
      });
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        continue;
      }

      if (!logWhatsAppStorageError('clearInstanceArchive', error, { tenantId, instanceId })) {
        throw error;
      }
    }
  }
};

export { buildInstanceArchiveKey };
