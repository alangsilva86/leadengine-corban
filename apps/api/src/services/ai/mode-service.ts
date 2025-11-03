import { logger } from '../../config/logger';
import { emitToTenant } from '../../lib/socket-registry';
import { AiMode, AiModeSchema } from './types';
import { getAiModeRecord, setAiModeRecord } from '../../data/ai-store';

export type UpdateAiModeInput = {
  tenantId: string;
  mode: AiMode | string; // aceitar aliases de entrada
  updatedBy?: string | null;
};

/**
 * Normaliza valores diversos (ex.: 'IA_AUTO', 'ia-assist', 'Manual') para o enum interno.
 * Qualquer valor inválido cai em 'auto' (padrão IA_AUTO).
 */
const normalizeAiMode = (value: unknown): AiMode => {
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase().replace(/[^a-z]/g, '_');

    // mapeamentos de aliases
    if (v === 'ia_auto' || v === 'auto' || v === 'default' || v === 'ia__auto') {
      return 'auto';
    }
    if (v === 'ia_assist' || v === 'assist' || v === 'assistant' || v === 'ia__assist') {
      return 'assist';
    }
    if (v === 'ia_manual' || v === 'manual' || v === 'human' || v === 'ia__manual') {
      return 'manual';
    }
  }

  // Se já for um AiMode válido, mantém; caso contrário, fallback
  const parsed = AiModeSchema.safeParse(value);
  return parsed.success ? parsed.data : 'auto';
};

export const parseAiMode = (value: unknown): AiMode => normalizeAiMode(value);

/**
 * Retorna o modo atual normalizado.
 * Se não houver registro ou o payload estiver inválido/corrompido, retorna 'auto' (IA_AUTO).
 */
export const getCurrentAiMode = async (tenantId: string) => {
  try {
    const record = getAiModeRecord(tenantId);

    const resolvedMode = normalizeAiMode(record?.mode ?? 'auto');

    return {
      tenantId: record?.tenantId ?? tenantId,
      mode: resolvedMode,
      updatedAt: (record?.updatedAt ?? new Date()).toISOString(),
      updatedBy: record?.updatedBy ?? null,
    };
  } catch (err) {
    logger.warn('AI mode fetch failed — falling back to IA_AUTO', {
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });

    return {
      tenantId,
      mode: 'auto' as AiMode,
      updatedAt: new Date().toISOString(),
      updatedBy: null,
    };
  }
};

/**
 * Atualiza o modo no store sempre salvando o valor normalizado.
 * Em caso de valor inválido, normaliza para 'auto'.
 */
export const updateAiMode = async ({ tenantId, mode, updatedBy }: UpdateAiModeInput) => {
  const resolvedMode = normalizeAiMode(mode);

  const record = setAiModeRecord(tenantId, resolvedMode, updatedBy);
  const payload = {
    tenantId: record.tenantId,
    mode: resolvedMode,
    updatedAt: record.updatedAt.toISOString(),
    updatedBy: record.updatedBy,
  };

  logger.info('AI mode updated', payload);
  emitToTenant(tenantId, 'ai:mode-changed', payload);
  return payload;
};
