/**
 * Ponto único de importação do funil do lead na API.
 *
 * A definição canônica (ids, rótulos, regras de transição e mapeamentos legados) vive em
 * `@ticketz/contracts` (packages/contracts/src/lead-stages.ts) e é compartilhada com o frontend.
 */
import {
  CLOSED_LEAD_STAGES,
  DEFAULT_LEAD_STAGE,
  LEAD_STAGES,
  LEAD_STAGE_DEFINITIONS,
  LEAD_STAGE_TO_LEGACY_LEAD_STATUS,
  LEGACY_LEAD_STATUS_TO_LEAD_STAGE,
  canTransitionLeadStage,
  getLeadStageLabel,
  parseLeadStage,
  toLeadStage,
} from '@ticketz/contracts';

export type LeadStage = (typeof LEAD_STAGES)[number];

export {
  CLOSED_LEAD_STAGES,
  DEFAULT_LEAD_STAGE,
  LEAD_STAGES,
  LEAD_STAGE_DEFINITIONS,
  LEAD_STAGE_TO_LEGACY_LEAD_STATUS,
  LEGACY_LEAD_STATUS_TO_LEAD_STAGE,
  canTransitionLeadStage,
  getLeadStageLabel,
  parseLeadStage,
  toLeadStage,
};
