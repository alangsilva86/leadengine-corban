import { useMemo } from 'react';
import KanbanBoard from '../components/kanban/KanbanBoard';
import useKanbanStages from '../hooks/useKanbanStages';
import useCrmLeads from '../hooks/useCrmLeads';
import { useCrmViewState } from '../state/view-context';

const LeadKanbanView = () => {
  const { filters } = useCrmViewState();
  const stages = useKanbanStages();
  const { leads, isLoading, error, refetch, hasNextPage, fetchNextPage } = useCrmLeads(filters);

  const leadsByStage = useMemo(() => {
    const map: Record<string, typeof leads> = {};
    stages.forEach((stage) => {
      map[stage.id] = [];
    });
    leads.forEach((lead) => {
      const key = lead.stage ?? stages[0]?.id ?? 'qualification';
      const bucket = map[key] ?? (map[key] = []);
      bucket.push(lead);
    });
    return map;
  }, [leads, stages]);

  const metricsByStage = useMemo(() => {
    const map: Record<string, { totalPotential?: number; stalledCount?: number }> = {};
    const threshold = 1000 * 60 * 60 * 72; // 72h

    Object.entries(leadsByStage).forEach(([stageId, stageLeads]) => {
      let totalPotential = 0;
      let stalled = 0;

      stageLeads.forEach((lead) => {
        totalPotential += lead.potentialValue ?? 0;
        if (lead.lastActivityAt) {
          try {
            const lastSeen = new Date(lead.lastActivityAt).getTime();
            if (Number.isFinite(lastSeen) && Date.now() - lastSeen > threshold) {
              stalled += 1;
            }
          } catch (error) {
            console.warn('[CRM] Falha ao avaliar inatividade do lead', error);
          }
        }
      });

      map[stageId] = {
        totalPotential,
        stalledCount: stalled,
      };
    });

    return map;
  }, [leadsByStage]);

  if (error) return <p role="alert">Não foi possível carregar os leads. <button onClick={() => refetch()}>Tentar novamente</button></p>;

  return (
    <>
    <KanbanBoard
      stages={stages}
      leadsByStage={leadsByStage}
      metricsByStage={metricsByStage}
      isLoading={isLoading && !leads.length}
    />
    {hasNextPage && <button onClick={() => fetchNextPage()}>Carregar mais leads</button>}
    </>
  );
};

export default LeadKanbanView;
