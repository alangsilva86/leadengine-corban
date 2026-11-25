import { useMemo } from 'react';
import { getLeadStagePresentation } from '@/features/crm/utils/lead-stage';
import { getTicketLeadStage } from '../../../utils/leadStage.js';

/** Etapa do lead da conversa (id do contrato) e a apresentação dela (rótulo, tom, ícone). */
const useTicketLeadStage = (ticket) => {
  const stage = useMemo(
    () => (ticket ? getTicketLeadStage(ticket) : null),
    // Só os campos que carregam a etapa (evita recalcular a cada mensagem nova).
    [ticket?.id, ticket?.stage, ticket?.pipelineStep, ticket?.metadata?.pipelineStep, ticket?.lead?.stage],
  );
  const presentation = useMemo(() => (stage ? getLeadStagePresentation(stage) : null), [stage]);
  return { stage, presentation };
};

export default useTicketLeadStage;
