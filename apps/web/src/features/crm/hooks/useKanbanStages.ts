import { useMemo } from 'react';

const DEFAULT_STAGES = [
  { id: 'qualification', title: 'Qualificação' },
  { id: 'proposal', title: 'Proposta' },
  { id: 'negotiation', title: 'Negociação' },
  { id: 'closed-won', title: 'Ganho' },
  { id: 'closed-lost', title: 'Perdido' },
];

export const useKanbanStages = () => {
  const stages = useMemo(() => DEFAULT_STAGES, []);
  return stages;
};

export default useKanbanStages;
