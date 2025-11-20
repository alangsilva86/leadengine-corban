import { Prisma } from '@prisma/client';
import type { WhatsAppBrokerInstanceSnapshot } from '../../../services/whatsapp-broker-client';
import { prisma } from '../../../lib/prisma';
import { logWhatsAppStorageError, hasErrorName, observeStorageLatency } from './errors';
import type { PrismaTransactionClient } from './types';

const LAST_SYNC_KEY_PREFIX = 'whatsapp:instances:lastSync:tenant:';
const SNAPSHOT_CACHE_KEY_PREFIX = 'whatsapp:instances:snapshotCache:tenant:';
const WHATSAPP_DISCONNECT_RETRY_KEY_PREFIX = 'whatsapp:disconnect:retry:tenant:';
const MAX_DISCONNECT_RETRY_JOBS = 20;

export const SYNC_TTL_MS = 30_000; // 30s cooldown for broker sync per tenant unless forced

export type CachedSnapshots = { expiresAt: string; snapshots: WhatsAppBrokerInstanceSnapshot[] };

type MemoryCacheEntry = { expiresAt: number; snapshots: WhatsAppBrokerInstanceSnapshot[] };

const memorySnapshotCache = new Map<string, MemoryCacheEntry>();

const getMemoryCachedSnapshots = (tenantId: string): WhatsAppBrokerInstanceSnapshot[] | null => {
  const cached = memorySnapshotCache.get(tenantId);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    memorySnapshotCache.delete(tenantId);
    return null;
  }

  return cached.snapshots;
};

const setMemoryCachedSnapshots = (
  tenantId: string,
  snapshots: WhatsAppBrokerInstanceSnapshot[],
  ttlSeconds: number
) => {
  memorySnapshotCache.set(tenantId, {
    snapshots,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
};

export const getLastSyncAt = async (
  tenantId: string,
  client: typeof prisma = prisma
): Promise<Date | null> => {
  const key = `${LAST_SYNC_KEY_PREFIX}${tenantId}`;
  const startedAt = Date.now();
  try {
    const rec = await client.integrationState.findUnique({ where: { key }, select: { value: true } });
    if (!rec?.value || typeof rec.value !== 'object' || rec.value === null) return null;
    const v = (rec.value as Record<string, unknown>).lastSyncAt;
    if (typeof v !== 'string') return null;
    const ts = Date.parse(v);
    const parsed = Number.isFinite(ts) ? new Date(ts) : null;
    observeStorageLatency('getLastSyncAt', startedAt, 'success', { tenantId, operationType: 'snapshot.read' });
    return parsed;
  } catch (error) {
    observeStorageLatency('getLastSyncAt', startedAt, 'failure', { tenantId, operationType: 'snapshot.read' });
    if (logWhatsAppStorageError('getLastSyncAt', error, { tenantId, key })) {
      return null;
    }
    throw error;
  }
};

export const setLastSyncAt = async (
  tenantId: string,
  at: Date,
  client: typeof prisma = prisma
): Promise<void> => {
  const key = `${LAST_SYNC_KEY_PREFIX}${tenantId}`;
  const value: Prisma.JsonObject = { lastSyncAt: at.toISOString() };
  const startedAt = Date.now();
  try {
    await client.integrationState.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    observeStorageLatency('setLastSyncAt', startedAt, 'success', { tenantId, operationType: 'snapshot.write' });
  } catch (error) {
    observeStorageLatency('setLastSyncAt', startedAt, 'failure', { tenantId, operationType: 'snapshot.write' });
    if (logWhatsAppStorageError('setLastSyncAt', error, { tenantId, key })) {
      return;
    }
    throw error;
  }
};

export const getCachedSnapshots = async (
  tenantId: string,
  client: typeof prisma = prisma
): Promise<WhatsAppBrokerInstanceSnapshot[] | null> => {
  const memoryCached = getMemoryCachedSnapshots(tenantId);
  if (memoryCached) {
    return memoryCached;
  }

  const key = `${SNAPSHOT_CACHE_KEY_PREFIX}${tenantId}`;
  const startedAt = Date.now();
  try {
    const rec = await client.integrationState.findUnique({ where: { key }, select: { value: true } });
    if (!rec?.value || typeof rec.value !== 'object' || rec.value === null) return null;
    const v = rec.value as Record<string, unknown>;
    const expiresAt = typeof v.expiresAt === 'string' ? Date.parse(v.expiresAt) : NaN;
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
    const raw = (v.snapshots ?? null) as unknown;
    const snapshots = Array.isArray(raw) ? (raw as WhatsAppBrokerInstanceSnapshot[]) : null;
    observeStorageLatency('getCachedSnapshots', startedAt, 'success', {
      tenantId,
      operationType: 'snapshot.read',
    });
    return snapshots;
  } catch (error) {
    observeStorageLatency('getCachedSnapshots', startedAt, 'failure', {
      tenantId,
      operationType: 'snapshot.read',
    });
    if (logWhatsAppStorageError('getCachedSnapshots', error, { tenantId, key })) {
      return null;
    }
    throw error;
  }
};

export const setCachedSnapshots = async (
  tenantId: string,
  snapshots: WhatsAppBrokerInstanceSnapshot[],
  ttlSeconds = 30,
  client: typeof prisma = prisma
): Promise<void> => {
  const key = `${SNAPSHOT_CACHE_KEY_PREFIX}${tenantId}`;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const value: Prisma.JsonObject = { expiresAt, snapshots: snapshots as unknown as Prisma.JsonArray };
  setMemoryCachedSnapshots(tenantId, snapshots, ttlSeconds);
  const startedAt = Date.now();
  try {
    await client.integrationState.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    observeStorageLatency('setCachedSnapshots', startedAt, 'success', {
      tenantId,
      operationType: 'snapshot.write',
    });
  } catch (error) {
    observeStorageLatency('setCachedSnapshots', startedAt, 'failure', {
      tenantId,
      operationType: 'snapshot.write',
    });
    if (logWhatsAppStorageError('setCachedSnapshots', error, { tenantId, key })) {
      return;
    }
    throw error;
  }
};

export const removeCachedSnapshot = async (
  tenantId: string,
  instanceId: string,
  brokerId?: string | null,
  client: typeof prisma = prisma
): Promise<void> => {
  const snapshots = await getCachedSnapshots(tenantId, client);
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

  const startedAt = Date.now();
  try {
    await setCachedSnapshots(tenantId, filtered, 30, client);
    observeStorageLatency('removeCachedSnapshot', startedAt, 'success', {
      tenantId,
      instanceId,
      operationType: 'snapshot.write',
    });
  } catch (error) {
    observeStorageLatency('removeCachedSnapshot', startedAt, 'failure', {
      tenantId,
      instanceId,
      operationType: 'snapshot.write',
    });
    if (!logWhatsAppStorageError('removeCachedSnapshot', error, { tenantId, instanceId, brokerId })) {
      throw error;
    }
  }
};

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

export const scheduleWhatsAppDisconnectRetry = async (
  tenantId: string,
  job: Omit<WhatsAppDisconnectRetryJob, 'tenantId'>,
  client: typeof prisma = prisma
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
    await client.$transaction(async (tx) => {
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

export const clearWhatsAppDisconnectRetry = async (
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
