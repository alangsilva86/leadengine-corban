import { logger } from '../../config/logger';
import { emitToTenant } from '../../lib/socket-registry';
import { AiMode, AiModeSchema } from './types';
import { getAiModeRecord, setAiModeRecord } from '../../data/ai-store';

export type UpdateAiModeInput = {
  tenantId: string;
  mode: AiMode;
  updatedBy?: string | null;
};

export const parseAiMode = (value: unknown): AiMode => AiModeSchema.parse(value);

export const getCurrentAiMode = async (tenantId: string) => {
  const record = getAiModeRecord(tenantId);
  return {
    tenantId: record.tenantId,
    mode: record.mode,
    updatedAt: record.updatedAt.toISOString(),
    updatedBy: record.updatedBy,
  };
};

export const updateAiMode = async ({ tenantId, mode, updatedBy }: UpdateAiModeInput) => {
  const record = setAiModeRecord(tenantId, mode, updatedBy);
  const payload = {
    tenantId: record.tenantId,
    mode: record.mode,
    updatedAt: record.updatedAt.toISOString(),
    updatedBy: record.updatedBy,
  };

  logger.info('AI mode updated', payload);
  emitToTenant(tenantId, 'ai:mode-changed', payload);
  return payload;
};
