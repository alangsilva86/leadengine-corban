import { Link, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useMemo } from 'react';
import { Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { PageHeader } from '@/components/page';
import CrmToolbar from '../components/CrmToolbar';
import CrmMetricsBelt from '../components/CrmMetricsBelt';
import CrmViewSwitcher from '../components/CrmViewSwitcher';
import CrmDataView from '../components/CrmDataView';
import LeadDrawer from '../components/LeadDrawer';
import useCrmSavedViews from '../hooks/useCrmSavedViews';
import useCrmMetrics from '../hooks/useCrmMetrics';
import useCrmLeads from '../hooks/useCrmLeads';
import { normalizeCrmFilters } from '../utils/filter-serialization';
import type { CrmFilterState, CrmSavedView } from '../state/types';
import { CrmViewProvider, isCrmViewType, useCrmViewContext } from '../state/view-context';
import type { CrmViewType } from '../state/view-context';
import { LEAD_SOURCES } from '../utils/labels';
import { LEAD_STAGE_DEFINITIONS, LEAD_STAGE_FILTER_OPTIONS } from '../utils/lead-stage';
import emitCrmTelemetry from '../utils/telemetry';
import { formatBRL } from '@/lib/currency';

const EMPTY_FILTERS: CrmFilterState = {
  stages: [],
  owners: [],
  origins: [],
  channels: [],
  score: null,
  dateRange: null,
  inactivityDays: null,
};

const FILTER_OPTIONS = {
  // Etapas do funil único (contrato), na ordem do funil.
  stages: LEAD_STAGE_FILTER_OPTIONS,
  owners: [{ id: 'owner:me', label: 'Meus leads' }],
  // Valores do enum LeadSource aceitos pelo filtro da API (/api/crm/leads).
  origins: LEAD_SOURCES.map(({ id, label }) => ({ id, label })),
};

const CrmHomePage = () => {
  const [searchParams] = useSearchParams();
  const initialFilters = useMemo(
    () => normalizeCrmFilters({ ...EMPTY_FILTERS, search: searchParams.get('q') ?? undefined }),
    []
  );
  const viewParam = searchParams.get('view');
  const initialView = isCrmViewType(viewParam) ? viewParam : undefined;

  return (
    <CrmViewProvider filters={initialFilters} initialView={initialView}>
      <CrmHomeContent />
    </CrmViewProvider>
  );
};

export default CrmHomePage;

/** Mantém visão e busca na URL (links compartilháveis e "voltar" do navegador). */
const useSyncViewToUrl = () => {
  const { state } = useCrmViewContext();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (state.view === 'kanban') next.delete('view');
    else next.set('view', state.view);
    if (state.filters.search) next.set('q', state.filters.search);
    else next.delete('q');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [state.view, state.filters.search]);
};

const CrmHomeContent = () => {
  const { state, setFilters, closeLeadDrawer } = useCrmViewContext();
  const { filters, activeLeadId, isDrawerOpen } = state;
  useSyncViewToUrl();

  const {
    views,
    activeViewId,
    isSaving,
    isDeleting,
    createSavedView,
    updateSavedView,
    deleteSavedView,
    selectSavedView,
  } = useCrmSavedViews();

  const { metrics, isLoading: metricsLoading, isFetching: metricsFetching, refetch: refetchMetrics } = useCrmMetrics({ filters });
  // Mesma chave de cache do funil/lista: não gera requisição extra.
  const { leads, hasNextPage, isLoading: leadsLoading } = useCrmLeads(filters);

  const openValueLabel = useMemo(() => {
    if (leadsLoading || hasNextPage) return null;
    const total = leads
      // "Em aberto" = leads ainda no funil (sem Ganho, Perdido e Reciclar).
      .filter((lead) => !LEAD_STAGE_DEFINITIONS[lead.stage]?.exit)
      .reduce((sum, lead) => sum + (lead.potentialValue ?? 0), 0);
    return formatBRL(total);
  }, [leads, hasNextPage, leadsLoading]);

  const resetFilters = useCallback(() => {
    setFilters(normalizeCrmFilters({ ...EMPTY_FILTERS, search: filters.search }));
  }, [setFilters, filters.search]);

  const handleFiltersChange = useCallback(
    (nextFilters: CrmFilterState) => {
      setFilters(normalizeCrmFilters(nextFilters));
    },
    [setFilters]
  );

  const handleSelectSavedView = useCallback(
    async (viewId: string | null) => {
      const target = viewId ? views.find((entry: CrmSavedView) => entry.id === viewId) ?? null : null;
      await selectSavedView(viewId);
      setFilters(normalizeCrmFilters(target?.filters ?? EMPTY_FILTERS));
      if (target) emitCrmTelemetry('crm.filter.use', { viewId });
    },
    [selectSavedView, setFilters, views]
  );

  const handleDeleteSavedView = useCallback(
    async (view: CrmSavedView) => {
      const isActive = view.id === activeViewId;
      await deleteSavedView(view);
      if (isActive) {
        resetFilters();
      }
    },
    [activeViewId, deleteSavedView, resetFilters]
  );

  const handleUpdateSavedView = useCallback(
    async (view: CrmSavedView, viewFilters: CrmFilterState) => {
      await updateSavedView(view, viewFilters);
      setFilters(normalizeCrmFilters(viewFilters));
    },
    [setFilters, updateSavedView]
  );

  const handleCreateSavedView = useCallback(
    async (input: { name: string; scope: CrmSavedView['scope']; filters: CrmFilterState }) => {
      await createSavedView(input);
      emitCrmTelemetry('crm.filter.save', { scope: input.scope });
    },
    [createSavedView]
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="CRM"
        meta={
          <CrmMetricsBelt
            metrics={metrics.summary}
            loading={metricsLoading || metricsFetching}
            source={metrics.source}
            openValueLabel={openValueLabel}
            onRefresh={() => {
              emitCrmTelemetry('crm.metrics.refresh', { source: 'home' });
              void refetchMetrics();
            }}
          />
        }
        actions={
          <Button asChild variant="outline">
            <Link to="/crm/opportunities">
              <Briefcase aria-hidden="true" />
              Oportunidades
            </Link>
          </Button>
        }
        className="gap-3"
      />

      <CrmToolbar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClearFilters={resetFilters}
        filterOptions={FILTER_OPTIONS}
        savedViews={{
          views,
          activeViewId,
          isSaving,
          isDeleting,
          createSavedView: handleCreateSavedView,
          updateSavedView: handleUpdateSavedView,
          deleteSavedView: handleDeleteSavedView,
          selectSavedView: handleSelectSavedView,
        }}
        trailing={
          <CrmViewSwitcher
            onViewChange={(view: CrmViewType) => {
              emitCrmTelemetry('crm.view.change', { view });
            }}
          />
        }
      />

      <CrmDataView />

      <LeadDrawer open={isDrawerOpen} leadId={activeLeadId} onOpenChange={(next) => (!next ? closeLeadDrawer() : undefined)} />
    </div>
  );
};
