import {
  LEAD_EXIT_STAGES,
  LEAD_PIPELINE_STAGES,
  LEAD_STAGE_DEFINITIONS,
  type LeadStage,
  type LeadStageTone,
} from '../utils/lead-stage';

export type KanbanStage = {
  id: LeadStage;
  title: string;
  description: string;
  tone: LeadStageTone;
  exit: boolean;
};

const toKanbanStage = (id: LeadStage): KanbanStage => {
  const definition = LEAD_STAGE_DEFINITIONS[id];
  return { id, title: definition.label, description: definition.description, tone: definition.tone, exit: definition.exit };
};

/** Colunas do funil (7 etapas, em ordem) e saídas (Ganho, Perdido, Reciclar) — direto do contrato. */
const KANBAN_STAGES = {
  pipeline: LEAD_PIPELINE_STAGES.map(toKanbanStage),
  exits: LEAD_EXIT_STAGES.map(toKanbanStage),
};

export const useKanbanStages = () => KANBAN_STAGES;

export default useKanbanStages;
