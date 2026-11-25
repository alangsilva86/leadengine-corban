import { useCallback, useMemo } from 'react';
import { KanbanSquare, Loader2, SearchX } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/page';
import { Button } from '@/components/ui/button.jsx';
import KanbanBoard from '../components/kanban/KanbanBoard';
import useKanbanStages from '../hooks/useKanbanStages';
import useCrmLeads from '../hooks/useCrmLeads';
import useMoveLeadStage from '../hooks/useMoveLeadStage';
import { useCrmViewContext, useCrmViewState } from '../state/view-context';
import type { LeadSummary } from '../state/leads';
import { countActiveFilters } from '../components/CrmToolbar';
import emitCrmTelemetry from '../utils/telemetry';
import { serializeCrmFilters } from '../utils/filter-serialization';
import { LEAD_STAGES, LEAD_STAGE_DEFINITIONS, normalizeLeadStage, type LeadStage } from '../utils/lead-stage';

const STALLED_THRESHOLD_MS = 1000 * 60 * 60 * 72; // 72 h

const LeadKanbanView = () => {
  const { filters } = useCrmViewState();
  const { openLeadDrawer, setFilters } = useCrmViewContext();
  const { pipeline, exits } = useKanbanStages();
  const { leads, isLoading, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useCrmLeads(filters);
  const { moveLead } = useMoveLeadStage();

  const leadsByStage = useMemo(() => {
    const map = Object.fromEntries(LEAD_STAGES.map((stage) => [stage, [] as LeadSummary[]])) as Record<LeadStage, LeadSummary[]>;
    leads.forEach((lead) => {
      map[normalizeLeadStage(lead.stage)].push(lead);
    });
    return map;
  }, [leads]);

  const metricsByStage = useMemo(() => {
    const now = Date.now();
    const map: Record<string, { totalPotential?: number; stalledCount?: number }> = {};
    Object.entries(leadsByStage).forEach(([stageId, stageLeads]) => {
      let totalPotential = 0;
      let stalled = 0;
      // Saídas (Ganho, Perdido, Reciclar) não contam como "parado".
      const isClosed = LEAD_STAGE_DEFINITIONS[stageId as LeadStage]?.exit ?? false;
      stageLeads.forEach((lead) => {
        totalPotential += lead.potentialValue ?? 0;
        const lastSeen = lead.lastActivityAt ? new Date(lead.lastActivityAt).getTime() : Number.NaN;
        if (!isClosed && Number.isFinite(lastSeen) && now - lastSeen > STALLED_THRESHOLD_MS) {
          stalled += 1;
        }
      });
      map[stageId] = { totalPotential, stalledCount: stalled };
    });
    return map;
  }, [leadsByStage]);

  const handleMoveLead = useCallback(
    (lead: LeadSummary, toStage: LeadStage, source: 'kanban' | 'menu') => moveLead(lead, toStage, { source }),
    [moveLead]
  );

  const handleOpenLead = (lead: LeadSummary) => {
    openLeadDrawer(lead.id);
    emitCrmTelemetry('crm.lead.open', { source: 'kanban', leadId: lead.id, stageId: lead.stage });
  };

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-surface">
        <ErrorState title="Não foi possível carregar os leads" error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!isLoading && leads.length === 0) {
    const filtered = countActiveFilters(filters) > 0 || Boolean(filters.search);
    return (
      <div className="rounded-lg border border-border bg-surface">
        {filtered ? (
          <EmptyState
            icon={SearchX}
            title="Nenhum lead com esses filtros"
            description="Ajuste a busca ou limpe os filtros para ver o funil completo."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFilters({ stages: [], owners: [], origins: [], channels: [], score: null, dateRange: null, inactivityDays: null })}
              >
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={KanbanSquare}
            title="Nenhum lead no funil ainda"
            description="Os leads entram aqui quando um contato chega pelo WhatsApp ou por uma regra de roteamento."
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <KanbanBoard
        stages={pipeline}
        exits={exits}
        leadsByStage={leadsByStage}
        metricsByStage={metricsByStage}
        isLoading={isLoading && leads.length === 0}
        onOpenLead={handleOpenLead}
        onMoveLead={handleMoveLead}
        autoScrollKey={serializeCrmFilters(filters)}
      />
      {hasNextPage ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" size="sm" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {isFetchingNextPage ? 'Carregando…' : 'Carregar mais leads'}
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default LeadKanbanView;
