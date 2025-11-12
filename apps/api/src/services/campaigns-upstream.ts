import { logger } from '../config/logger';
import type { CampaignDTO } from '../routes/campaigns.types';

export interface LeadEngineCampaignFilters {
  tenantId: string;
  agreementId?: string;
  status?: string;
  productType?: string;
  marginType?: string;
  strategy?: string;
  tags?: string;
  requestId: string;
}

export const fetchLeadEngineCampaigns = async (
  _filters: LeadEngineCampaignFilters
): Promise<CampaignDTO[]> => {
  logger.debug('[LeadEngine] fetchLeadEngineCampaigns fallback invoked', _filters);
  return [];
};
