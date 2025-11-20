import type { WhatsAppBrokerInstanceSnapshot } from '../../../services/whatsapp-broker-client';
import { prisma } from '../../../lib/prisma';
import {
  getCachedSnapshots as readCachedSnapshots,
  getLastSyncAt as readLastSyncAt,
  setCachedSnapshots as writeCachedSnapshots,
  setLastSyncAt as writeLastSyncAt,
} from './cache';

export type SnapshotCache = {
  getLastSyncAt: (tenantId: string) => Promise<Date | null>;
  setLastSyncAt: (tenantId: string, at: Date) => Promise<void>;
  getCachedSnapshots: (tenantId: string) => Promise<WhatsAppBrokerInstanceSnapshot[] | null>;
  setCachedSnapshots: (
    tenantId: string,
    snapshots: WhatsAppBrokerInstanceSnapshot[],
    ttlSeconds?: number
  ) => Promise<void>;
};

export const createSnapshotCache = (client: typeof prisma = prisma): SnapshotCache => ({
  getLastSyncAt: (tenantId: string) => readLastSyncAt(tenantId, client),
  setLastSyncAt: (tenantId: string, at: Date) => writeLastSyncAt(tenantId, at, client),
  getCachedSnapshots: (tenantId: string) => readCachedSnapshots(tenantId, client),
  setCachedSnapshots: (tenantId: string, snapshots: WhatsAppBrokerInstanceSnapshot[], ttlSeconds = 30) =>
    writeCachedSnapshots(tenantId, snapshots, ttlSeconds, client),
});

export const defaultSnapshotCache = createSnapshotCache();
export const getLastSyncAt = defaultSnapshotCache.getLastSyncAt;
export const setLastSyncAt = defaultSnapshotCache.setLastSyncAt;
export const getCachedSnapshots = defaultSnapshotCache.getCachedSnapshots;
export const setCachedSnapshots = defaultSnapshotCache.setCachedSnapshots;
