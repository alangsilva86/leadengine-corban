import { logger } from '../../../../config/logger';
import { cacheManager, createCache, type SimpleCache } from '../../../../lib/simple-cache';
import { resetDedupeState } from '../dedupe';
import { queueCacheByTenant } from '../provisioning';

type CampaignRecord = {
  id: string;
  name: string;
  status: string;
  whatsappInstanceId: string | null;
  tenantId: string;
  agreementId: string | null;
};

const campaignCache: SimpleCache<string, CampaignRecord[]> = createCache({
  name: 'whatsapp-campaigns',
  ttlMs: 5 * 60 * 1000,
  maxSize: 500,
});

cacheManager.register(campaignCache);

export const resetInboundLeadState = (): void => {
  resetDedupeState();
  queueCacheByTenant.clear();
  campaignCache.clear();
};

export const invalidateCampaignCache = (tenantId: string, instanceId: string): void => {
  const cacheKey = `${tenantId}:${instanceId}`;
  campaignCache.delete(cacheKey);
  logger.debug('Campaign cache invalidated', { tenantId, instanceId });
};

export const getCampaignCache = (): SimpleCache<string, CampaignRecord[]> => campaignCache;
