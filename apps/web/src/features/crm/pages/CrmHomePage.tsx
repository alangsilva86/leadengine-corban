import { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button.jsx';
import CrmToolbar from '../components/CrmToolbar.tsx';
import CrmMetricsBelt from '../components/CrmMetricsBelt.tsx';
import CrmViewSwitcher from '../components/CrmViewSwitcher.tsx';
import CrmDataView from '../components/CrmDataView.tsx';
import LeadDrawer from '../components/LeadDrawer.tsx';
import useCrmSavedViews from '../hooks/useCrmSavedViews.ts';
import useCrmMetrics from '../hooks/useCrmMetrics.ts';
import { normalizeCrmFilters } from '../utils/filter-serialization.ts';
import type { CrmFilterState, CrmSavedView } from '../state/types.ts';
import type { CrmMetricPrimitive } from '../state/metrics.ts';
import { CrmViewProvider, useCrmViewContext } from '../state/view-context.tsx';
import emitCrmTelemetry from '../utils/telemetry.ts';

const EMPTY_FILTERS: CrmFilterState = {
  stages: [],
  owners: [],
  origins: [],
  channels: [],
  score: null,
  dateRange: null,
  inactivityDays: null,
};

type SavedViewsHandlers = {
  views: ReturnType<typeof useCrmSavedViews>['views'];
  activeViewId: string | null;
  isSaving: boolean;
  isDeleting: boolean;
  createSavedView: (input: { name: string; scope: CrmSavedView['scope']; filters: CrmFilterState }) => Promise<unknown>;
  updateSavedView: (view: CrmSavedView, filters: CrmFilterState) => Promise<unknown>;
  deleteSavedView: (view: CrmSavedView) => Promise<unknown>;
  selectSavedView: (viewId: string | null) => Promise<unknown>;
};

const CrmHomePage = () => {
  const initialFilters = useMemo(() => normalizeCrmFilters(EMPTY_FILTERS), []);

  return (
    <CrmViewProvider filters={initialFilters}>
      <CrmHomeContent />
    </CrmViewProvider>
  );
};

export default CrmHomePage;

const CrmHomeContent = () => {
  const { state, setFilters } = useCrmViewContext();
  const { filters } = state;

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

  const { metrics: metricsResult, isLoading: metricsLoading, isFetching: metricsFetching, refetch: refetchMetrics } =
    useCrmMetrics({
      filters,
    });

  const filterOptions = useMemo(
    () => ({
      stages: [
        { id: 'qualification', label: 'Qualificação' },
        { id: 'proposal', label: 'Proposta' },
        { id: 'negotiation', label: 'Negociação' },
        { id: 'closed-won', label: 'Ganho' },
        { id: 'closed-lost', label: 'Perdido' },
      ],
      owners: [
        { id: 'owner:me', label: 'Meus leads' },
        { id: 'owner:team', label: 'Equipe' },
      ],
      origins: [
        { id: 'web', label: 'Formulário Web' },
        { id: 'ads', label: 'Campanhas Ads' },
        { id: 'partners', label: 'Parcerias' },
      ],
      channels: [
        { id: 'whatsapp', label: 'WhatsApp' },
        { id: 'phone', label: 'Telefone' },
        { id: 'email', label: 'E-mail' },
      ],
    }),
    []
  );

  const resetFilters = useCallback(() => {
    setFilters(normalizeCrmFilters(EMPTY_FILTERS));
  }, [setFilters]);

  const handleFiltersChange = useCallback(
    (nextFilters: CrmFilterState) => {
      setFilters(normalizeCrmFilters(nextFilters));
    },
    [setFilters]
  );

  const handleSelectSavedView = useCallback(
    async (viewId: string | null) => {
      const target = viewId ? views.find((view) => view.id === viewId) ?? null : null;
      await selectSavedView(viewId);
      setFilters(normalizeCrmFilters(target?.filters ?? EMPTY_FILTERS));
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

  const savedViewsHandlers: SavedViewsHandlers = {
    views,
    activeViewId,
    isSaving,
    isDeleting,
    createSavedView,
    updateSavedView: handleUpdateSavedView,
    deleteSavedView: handleDeleteSavedView,
    selectSavedView: handleSelectSavedView,
  };

  return (
    <CrmHomeLayout
      filters={filters}
      onFiltersChange={handleFiltersChange}
      onClearFilters={resetFilters}
      savedViews={savedViewsHandlers}
      filterOptions={filterOptions}
      metrics={metricsResult.summary}
      metricsSource={metricsResult.source}
      metricsLoading={metricsLoading || metricsFetching}
      onMetricsRefresh={() => void refetchMetrics()}
    />
  );
};

type CrmHomeLayoutProps = {
  filters: CrmFilterState;
  onFiltersChange: (next: CrmFilterState) => void;
  onClearFilters: () => void;
  savedViews: SavedViewsHandlers;
  filterOptions: {
    stages: Array<{ id: string; label: string }>;
    owners: Array<{ id: string; label: string }>;
    origins: Array<{ id: string; label: string }>;
    channels: Array<{ id: string; label: string }>;
  };
  metrics: CrmMetricPrimitive[];
  metricsSource: 'api' | 'fallback';
  metricsLoading: boolean;
  onMetricsRefresh: () => void;
};

const CrmHomeLayout = ({
  filters,
  onFiltersChange,
  onClearFilters,
  savedViews,
  filterOptions,
  metrics,
  metricsSource,
  metricsLoading,
  onMetricsRefresh,
}: CrmHomeLayoutProps) => {
  const { state, closeLeadDrawer, openLeadDrawer, clearSelection } = useCrmViewContext();
  const { activeLeadId, isDrawerOpen } = state;

  return (
    <div className="flex h-full flex-col gap-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-foreground">CRM</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Gerencie leads com filtros avançados, visões salvas e ações em massa. Mais recursos serão ativados conforme as próximas etapas forem concluídas.
        </p>
      </header>

      <CrmMetricsBelt
        metrics={metrics}
        loading={metricsLoading}
        source={metricsSource}
        onRefresh={() => {
          emitCrmTelemetry('crm.metrics.refresh', { source: 'home' });
          onMetricsRefresh();
        }}
      />

      <CrmToolbar
        filters={filters}
        onFiltersChange={onFiltersChange}
        onClearFilters={onClearFilters}
        filterOptions={filterOptions}
        totalCount={undefined}
        selectedCount={state.selection.selectedIds.size}
        onClearSelection={state.selection.selectedIds.size ? clearSelection : undefined}
        savedViews={savedViews}
      />

      <div className="space-y-4">
        <CrmViewSwitcher
          onViewChange={(view) => {
            emitCrmTelemetry('crm.view.change', { view });
          }}
        />
        <CrmDataView />
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
          <p>
            Esta área exibirá dados reais em breve. Enquanto isso, use o botão abaixo para visualizar o comportamento do drawer do lead.
          </p>
          <Button type="button" size="sm" className="mt-3" onClick={() => openLeadDrawer('lead-demo-1')}>
            Abrir drawer de exemplo
          </Button>
        </div>
      </div>

      <LeadDrawer open={isDrawerOpen} leadId={activeLeadId} onOpenChange={(next) => (!next ? closeLeadDrawer() : undefined)} />
    </div>
  );
};
