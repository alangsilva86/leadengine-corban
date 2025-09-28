import type { BrokerLeadRecord } from '../config/lead-engine';
import {
  allocateBrokerLeads,
  listAllocations as listPersistedAllocations,
  updateAllocation as updatePersistedAllocation,
  type AllocationSummary,
  type LeadAllocationDto,
  type LeadAllocationStatus,
} from '@ticketz/storage';

export type { LeadAllocationStatus };

export type LeadAllocation = LeadAllocationDto;

export interface AllocationResult {
  newlyAllocated: LeadAllocation[];
  summary: AllocationSummary;
}

export const listAllocations = async (
  tenantId: string,
  agreementId?: string,
  campaignId?: string
): Promise<LeadAllocation[]> => {
  return listPersistedAllocations({
    tenantId,
    agreementId,
    campaignId,
  });
};

export const addAllocations = async (
  tenantId: string,
  campaignId: string,
  leads: BrokerLeadRecord[]
): Promise<AllocationResult> => {
  return allocateBrokerLeads({
    tenantId,
    campaignId,
    leads: leads.map((lead) => ({
      ...lead,
    })),
  });
};

export const updateAllocation = async (
  tenantId: string,
  allocationId: string,
  updates: Partial<Pick<LeadAllocation, 'status' | 'notes'>>
): Promise<LeadAllocation | null> => {
  return updatePersistedAllocation({
    tenantId,
    allocationId,
    updates: {
      status: updates.status,
      notes: updates.notes ?? null,
    },
  });
};
