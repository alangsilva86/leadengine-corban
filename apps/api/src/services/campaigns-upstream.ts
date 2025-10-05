import { logger } from '../config/logger';
import type { CampaignDTO } from '../routes/campaigns.types';

export interface LeadEngineCampaignFilters {
  tenantId: string;
  agreementId?: string;
  status?: string;
  requestId: string;
}

export class LeadEngineUpstreamError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'LeadEngineUpstreamError';
  }
}

export const fetchLeadEngineCampaigns = async (
  _filters: LeadEngineCampaignFilters
): Promise<CampaignDTO[]> => {
  logger.debug('[LeadEngine] fetchLeadEngineCampaigns fallback invoked', _filters);
  return [];
};
