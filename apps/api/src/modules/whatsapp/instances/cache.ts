import { Prisma } from '@prisma/client';
import Redis from 'ioredis';
import type { WhatsAppBrokerInstanceSnapshot } from '../../../services/whatsapp-broker-client';
import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';
import { logWhatsAppStorageError, hasErrorName, observeStorageLatency } from './errors';
import type { PrismaTransactionClient } from './types';

const LAST_SYNC_KEY_PREFIX = 'whatsapp:instances:lastSync:tenant:';
const SNAPSHOT_CACHE_KEY_PREFIX = 'whatsapp:instances:snapshotCache:tenant:';
const WHATSAPP_DISCONNECT_RETRY_KEY_PREFIX = 'whatsapp:disconnect:retry:tenant:';
const MAX_DISCONNECT_RETRY_JOBS = 20;

export const SYNC_TTL_MS = 30_000; // 30s cooldown for broker sync per tenant unless forced

export type SnapshotCacheBackendType = 'memory' | 'redis';

export type SnapshotCacheReadResult = {
  snapshots: WhatsAppBrokerInstanceSnapshot[] | null;
  hit: boolean;
  backend: SnapshotCacheBackendType;
  error?: string;
};

export type SnapshotCacheWriteResult = {
  backend: SnapshotCacheBackendType;
  error?: string;
};

type SnapshotCacheBackend = {
  type: SnapshotCacheBackendType;
  get: (tenantId: string) => Promise<WhatsAppBrokerInstanceSnapshot[] | null>;
  set: (
    tenantId: string,
    snapshots: WhatsAppBrokerInstanceSnapshot[],
    ttlSeconds: number
  ) => Promise<void>;
  invalidate?: (tenantId: string) => Promise<void>;
};

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

const invalidateMemorySnapshots = (tenantId: string): void => {
  memorySnapshotCache.delete(tenantId);
};

const memoryBackend: SnapshotCacheBackend = {
  type: 'memory',
  get: async (tenantId) => getMemoryCachedSnapshots(tenantId),
  set: async (tenantId, snapshots, ttlSeconds) =>
    setMemoryCachedSnapshots(tenantId, snapshots, ttlSeconds),
  invalidate: async (tenantId) => invalidateMemorySnapshots(tenantId),
};

const redisUrl = process.env.WHATSAPP_INSTANCES_CACHE_REDIS_URL ?? process.env.REDIS_URL ?? null;
const redisClient = redisUrl
  ? new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    })
  : null;

const ensureRedisConnected = async (): Promise<void> => {
  if (!redisClient || redisClient.status === 'ready' || redisClient.status === 'connecting') {
    return;
  }
  await redisClient.connect();
};

const redisBackend: SnapshotCacheBackend | null = redisClient
  ? {
      type: 'redis',
      get: async (tenantId) => {
        await ensureRedisConnected();
        const raw = await redisClient.get(`${SNAPSHOT_CACHE_KEY_PREFIX}${tenantId}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as {
          snapshots?: WhatsAppBrokerInstanceSnapshot[];
        } | null;
        return parsed?.snapshots ?? null;
      },
      set: async (tenantId, snapshots, ttlSeconds) => {
        await ensureRedisConnected();
        await redisClient.set(
          `${SNAPSHOT_CACHE_KEY_PREFIX}${tenantId}`,
          JSON.stringify({ snapshots }),
          'EX',
          ttlSeconds,
        );
      },
      invalidate: async (tenantId) => {
        await ensureRedisConnected();
        await redisClient.del(`${SNAPSHOT_CACHE_KEY_PREFIX}${tenantId}`);
      },
    }
  : null;

let selectedSnapshotBackend: SnapshotCacheBackend = redisBackend ?? memoryBackend;

export const configureSnapshotCacheBackend = (backend: SnapshotCacheBackend | null): void => {
  selectedSnapshotBackend = backend ?? memoryBackend;
};

const getSnapshotBackend = (): SnapshotCacheBackend => selectedSnapshotBackend ?? memoryBackend;

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

export const getCachedSnapshots = async (tenantId: string): Promise<SnapshotCacheReadResult> => {
  const backend = getSnapshotBackend();

  try {
    const snapshots = await backend.get(tenantId);
    return { snapshots, hit: !!snapshots, backend: backend.type } satisfies SnapshotCacheReadResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown-error';
    logger.warn('whatsapp.instances.snapshotCache.readFailure', { tenantId, backend: backend.type, error: message });
    if (backend.type !== 'memory') {
      invalidateMemorySnapshots(tenantId);
    }
    return { snapshots: null, hit: false, backend: backend.type, error: message } satisfies SnapshotCacheReadResult;
  }
};

export const setCachedSnapshots = async (
  tenantId: string,
  snapshots: WhatsAppBrokerInstanceSnapshot[],
  ttlSeconds = 30
): Promise<SnapshotCacheWriteResult> => {
  const backend = getSnapshotBackend();
  setMemoryCachedSnapshots(tenantId, snapshots, ttlSeconds);

  try {
    await backend.set(tenantId, snapshots, ttlSeconds);
    return { backend: backend.type } satisfies SnapshotCacheWriteResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown-error';
    logger.warn('whatsapp.instances.snapshotCache.writeFailure', { tenantId, backend: backend.type, error: message });
    return { backend: backend.type, error: message } satisfies SnapshotCacheWriteResult;
  }
};

export const invalidateCachedSnapshots = async (
  tenantId: string
): Promise<SnapshotCacheWriteResult> => {
  const backend = getSnapshotBackend();
  invalidateMemorySnapshots(tenantId);
  try {
    if (backend.invalidate) {
      await backend.invalidate(tenantId);
    }
    return { backend: backend.type } satisfies SnapshotCacheWriteResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown-error';
    logger.warn('whatsapp.instances.snapshotCache.invalidateFailure', {
      tenantId,
      backend: backend.type,
      error: message,
    });
    return { backend: backend.type, error: message } satisfies SnapshotCacheWriteResult;
  }
};

export const removeCachedSnapshot = async (
  tenantId: string,
  _instanceId: string,
  _brokerId?: string | null
): Promise<void> => {
  await invalidateCachedSnapshots(tenantId);
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
