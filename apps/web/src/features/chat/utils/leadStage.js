import {
  LEAD_STAGE_DEFINITIONS,
  getLeadStagePresentation,
  normalizeLeadStage,
  parseLeadStage,
} from '@/features/crm/utils/lead-stage';

/**
 * Etapa do lead na conversa. O lead é o dono da etapa: a API envia `ticket.stage` já como
 * `LeadStage`; valores antigos (cache, `pipelineStep` legado) são normalizados aqui.
 */
export const getTicketLeadStage = (ticket) => {
  const candidates = [ticket?.stage, ticket?.pipelineStep, ticket?.metadata?.pipelineStep, ticket?.lead?.stage];
  for (const candidate of candidates) {
    const stage = parseLeadStage(candidate);
    if (stage) return stage;
  }
  return normalizeLeadStage(null);
};

export const getTicketLeadStagePresentation = (ticket) => getLeadStagePresentation(getTicketLeadStage(ticket));

/**
 * Etapas em que o próximo passo natural é registrar o resultado da conversa:
 * aguardando a liberação do crédito (Liquidação) ou lead já ganho/perdido com a conversa aberta.
 */
const RESULT_STAGES = new Set(['liquidacao', 'ganho', 'perdido']);

export const isResultStage = (stage) => RESULT_STAGES.has(normalizeLeadStage(stage));

/** Modo inicial do diálogo de resultado para a etapa (Perdido abre direto em "perda"). */
export const getOutcomeModeForStage = (stage) => (normalizeLeadStage(stage) === 'perdido' ? 'loss' : 'success');

/** Atualiza a etapa de um ticket dentro de uma lista em cache (`{ items: [...] }`). */
export const patchTicketStageInList = (data, ticketId, stage) => {
  if (!data || typeof data !== 'object' || !Array.isArray(data.items)) return data;
  let changed = false;
  const items = data.items.map((item) => {
    if (item?.id !== ticketId) return item;
    changed = true;
    // `pipelineStep` é derivado de `stage` no backend; mantém os dois coerentes até o próximo refetch.
    return { ...item, stage, pipelineStep: stage };
  });
  return changed ? { ...data, items } : data;
};

export { LEAD_STAGE_DEFINITIONS };
