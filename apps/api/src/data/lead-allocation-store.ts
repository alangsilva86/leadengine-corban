import type { BrokerLeadRecord } from '../config/lead-engine';
import {
  allocateBrokerLeads,
  listAllocations as listPersistedAllocations,
  updateAllocation as updatePersistedAllocation,
  type AllocationSummary,
  type LeadAllocationDto,
  type LeadAllocationStatus,
} from '@ticketz/storage';
import { logger } from '../config/logger';

export type { LeadAllocationStatus };

export type LeadAllocation = LeadAllocationDto;

export interface AllocationResult {
  newlyAllocated: LeadAllocation[];
  summary: AllocationSummary;
}

type ErrorWithOptionalCode = {
  code?: unknown;
  message?: unknown;
};

const getErrorCode = (error: unknown): string | undefined => {
  if (error && typeof error === 'object') {
    const candidate = error as ErrorWithOptionalCode;
    if (typeof candidate.code === 'string') {
      return candidate.code;
    }
  }

  return error instanceof Error && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
    ? String((error as { code?: unknown }).code)
    : undefined;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const candidate = error as ErrorWithOptionalCode;
    if (typeof candidate.message === 'string') {
      return candidate.message;
    }
  }

  return String(error);
};

const STORAGE_INIT_ERROR_CODES = new Set([
  'STORAGE_NOT_INITIALIZED',
  'ERR_STORAGE_NOT_INITIALIZED',
  'STORAGE_DATABASE_DISABLED',
]);

const STORAGE_INIT_ERROR_MESSAGES = [
  'storage not initialized',
  'armazenamento não inicializado',
];

export const isStorageInitializationError = (error: unknown): boolean => {
  const code = getErrorCode(error)?.toUpperCase();
  if (code && STORAGE_INIT_ERROR_CODES.has(code)) {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();
  return STORAGE_INIT_ERROR_MESSAGES.some((knownMessage) =>
    message.includes(knownMessage)
  );
};

const STORAGE_UNAVAILABLE_CODES = new Set([
  'STORAGE_UNAVAILABLE',
  'ERR_STORAGE_UNAVAILABLE',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
]);

const STORAGE_UNAVAILABLE_MESSAGES = [
  'storage unavailable',
  'falha ao acessar o armazenamento',
  'conexão recusada',
  'connection refused',
];

export const isStorageUnavailableError = (error: unknown): boolean => {
  const code = getErrorCode(error)?.toUpperCase();
  if (code && STORAGE_UNAVAILABLE_CODES.has(code)) {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();
  return STORAGE_UNAVAILABLE_MESSAGES.some((knownMessage) =>
    message.includes(knownMessage)
  );
};

export const listAllocations = async (
  tenantId: string,
  options: {
    agreementId?: string;
    campaignId?: string;
    instanceId?: string;
    statuses?: LeadAllocationStatus[];
  } = {}
): Promise<LeadAllocation[]> => {
  try {
    return await listPersistedAllocations({
      tenantId,
      agreementId: options.agreementId,
      campaignId: options.campaignId,
      instanceId: options.instanceId,
      statuses: options.statuses,
    });
  } catch (error) {
    if (isStorageInitializationError(error)) {
      logger.warn('[LeadAllocationStore] Storage not initialized when listing allocations', {
        tenantId,
        agreementId: options.agreementId,
        campaignId: options.campaignId,
        statuses: options.statuses,
        error,
      });
      return [];
    }

    throw error;
  }
};

export const addAllocations = async (
  tenantId: string,
  target: { campaignId?: string; instanceId?: string },
  leads: BrokerLeadRecord[]
): Promise<AllocationResult> => {
  if (!target.campaignId && !target.instanceId) {
    throw new Error('campaignId or instanceId must be provided to add allocations');
  }

  return allocateBrokerLeads({
    tenantId,
    campaignId: target.campaignId,
    instanceId: target.instanceId,
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
