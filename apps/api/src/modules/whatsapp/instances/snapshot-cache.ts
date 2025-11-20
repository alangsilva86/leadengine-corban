import type { WhatsAppBrokerInstanceSnapshot } from '../../../services/whatsapp-broker-client';
import { prisma } from '../../../lib/prisma';
import {
  getCachedSnapshots as readCachedSnapshots,
  getLastSyncAt as readLastSyncAt,
  invalidateCachedSnapshots as invalidateSnapshots,
  setCachedSnapshots as writeCachedSnapshots,
  setLastSyncAt as writeLastSyncAt,
  type SnapshotCacheReadResult,
  type SnapshotCacheWriteResult,
} from './cache';

export type SnapshotCache = {
  getLastSyncAt: (tenantId: string) => Promise<Date | null>;
  setLastSyncAt: (tenantId: string, at: Date) => Promise<void>;
  getCachedSnapshots: (tenantId: string) => Promise<SnapshotCacheReadResult>;
  setCachedSnapshots: (
    tenantId: string,
    snapshots: WhatsAppBrokerInstanceSnapshot[],
    ttlSeconds?: number
  ) => Promise<SnapshotCacheWriteResult>;
  invalidateCachedSnapshots: (tenantId: string) => Promise<SnapshotCacheWriteResult>;
};

export const createSnapshotCache = (client: typeof prisma = prisma): SnapshotCache => ({
  getLastSyncAt: (tenantId: string) => readLastSyncAt(tenantId, client),
  setLastSyncAt: (tenantId: string, at: Date) => writeLastSyncAt(tenantId, at, client),
  getCachedSnapshots: (tenantId: string) => readCachedSnapshots(tenantId),
  setCachedSnapshots: (tenantId: string, snapshots: WhatsAppBrokerInstanceSnapshot[], ttlSeconds = 30) =>
    writeCachedSnapshots(tenantId, snapshots, ttlSeconds),
  invalidateCachedSnapshots: (tenantId: string) => invalidateSnapshots(tenantId),
});

export const defaultSnapshotCache = createSnapshotCache();
export const getLastSyncAt = defaultSnapshotCache.getLastSyncAt;
export const setLastSyncAt = defaultSnapshotCache.setLastSyncAt;
export const getCachedSnapshots = defaultSnapshotCache.getCachedSnapshots;
export const setCachedSnapshots = defaultSnapshotCache.setCachedSnapshots;
export const invalidateCachedSnapshots = defaultSnapshotCache.invalidateCachedSnapshots;
