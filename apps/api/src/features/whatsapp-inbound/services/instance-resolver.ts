import { prisma } from '../../../lib/prisma';
import { logger } from '../../../config/logger';

type ResolvedInstance = {
  instanceId: string;
  tenantId: string;
  brokerId: string;
};

type CacheEntry = ResolvedInstance & {
  expiresAt: number;
};

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutos
const instanceCache = new Map<string, CacheEntry>();

const sanitizeIdentifier = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const pruneExpiredEntries = (now: number): void => {
  for (const [key, entry] of instanceCache.entries()) {
    if (entry.expiresAt <= now) {
      instanceCache.delete(key);
    }
  }
};

const rememberEntry = (key: string | null, entry: CacheEntry): void => {
  if (!key) {
    return;
  }
  instanceCache.set(key, entry);
};

const toResolvedInstance = (record: { id: string; tenantId: string; brokerId: string }): ResolvedInstance => ({
  instanceId: record.id,
  tenantId: record.tenantId,
  brokerId: record.brokerId,
});

const cacheResolvedInstance = (entry: ResolvedInstance, keys: string[], now: number): void => {
  const expiresAt = now + CACHE_TTL_MS;
  const cacheEntry: CacheEntry = { ...entry, expiresAt };

  const identifiers = new Set<string>();
  identifiers.add(entry.instanceId);
  identifiers.add(entry.brokerId);
  keys.forEach((key) => {
    if (key) {
      identifiers.add(key);
    }
  });

  identifiers.forEach((identifier) => rememberEntry(identifier, cacheEntry));
};

export const resolveWhatsappInstanceByIdentifiers = async (
  identifiers: unknown[],
  expectedTenantId?: unknown
): Promise<ResolvedInstance | null> => {
  const now = Date.now();
  pruneExpiredEntries(now);

  const tenantId = sanitizeIdentifier(expectedTenantId);

  const candidates = identifiers
    .map((identifier) => sanitizeIdentifier(identifier))
    .filter((identifier): identifier is string => Boolean(identifier));

  if (candidates.length === 0) {
    return null;
  }

  for (const candidate of candidates) {
    const cached = instanceCache.get(candidate);
    if (cached && cached.expiresAt > now && (!tenantId || cached.tenantId === tenantId)) {
      return { instanceId: cached.instanceId, tenantId: cached.tenantId, brokerId: cached.brokerId };
    }
    if (cached && cached.expiresAt <= now) {
      instanceCache.delete(candidate);
    }
  }

  for (const candidate of candidates) {
    try {
      const record = await prisma.whatsAppInstance.findFirst({
        where: {
          tenantId: tenantId ?? undefined,
          OR: [
            { id: candidate },
            { brokerId: candidate },
          ],
        },
        select: {
          id: true,
          tenantId: true,
          brokerId: true,
        },
      });

      if (record) {
        const resolved = toResolvedInstance(record);
        cacheResolvedInstance(resolved, candidates, now);
        return resolved;
      }
    } catch (error) {
      logger.error('Failed to resolve WhatsApp instance by identifier', { candidate, error });
    }
  }

  return null;
};

export const __testing = {
  resetCache(): void {
    instanceCache.clear();
  },
  getCacheSize(): number {
    return instanceCache.size;
  },
};
