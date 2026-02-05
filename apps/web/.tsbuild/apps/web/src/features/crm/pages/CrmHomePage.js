import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button.jsx';
import CrmToolbar from '../components/CrmToolbar';
import CrmMetricsBelt from '../components/CrmMetricsBelt';
import CrmViewSwitcher from '../components/CrmViewSwitcher';
import CrmDataView from '../components/CrmDataView';
import LeadDrawer from '../components/LeadDrawer';
import useCrmSavedViews from '../hooks/useCrmSavedViews';
import useCrmMetrics from '../hooks/useCrmMetrics';
import { normalizeCrmFilters } from '../utils/filter-serialization';
import { CrmViewProvider, useCrmViewContext } from '../state/view-context';
import emitCrmTelemetry from '../utils/telemetry';
const EMPTY_FILTERS = {
    stages: [],
    owners: [],
    origins: [],
    channels: [],
    score: null,
    dateRange: null,
    inactivityDays: null,
};
const CrmHomePage = () => {
    const initialFilters = useMemo(() => normalizeCrmFilters(EMPTY_FILTERS), []);
    return (_jsx(CrmViewProvider, { filters: initialFilters, children: _jsx(CrmHomeContent, {}) }));
};
export default CrmHomePage;
const CrmHomeContent = () => {
    const { state, setFilters } = useCrmViewContext();
    const { filters } = state;
    const { views, activeViewId, isSaving, isDeleting, createSavedView, updateSavedView, deleteSavedView, selectSavedView, } = useCrmSavedViews();
    const { metrics: metricsResult, isLoading: metricsLoading, isFetching: metricsFetching, refetch: refetchMetrics } = useCrmMetrics({
        filters,
    });
    const filterOptions = useMemo(() => ({
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
    }), []);
    const resetFilters = useCallback(() => {
        setFilters(normalizeCrmFilters(EMPTY_FILTERS));
    }, [setFilters]);
    const handleFiltersChange = useCallback((nextFilters) => {
        setFilters(normalizeCrmFilters(nextFilters));
    }, [setFilters]);
    const handleSelectSavedView = useCallback(async (viewId) => {
        const target = viewId ? views.find((entry) => entry.id === viewId) ?? null : null;
        await selectSavedView(viewId);
        setFilters(normalizeCrmFilters(target?.filters ?? EMPTY_FILTERS));
    }, [selectSavedView, setFilters, views]);
    const handleDeleteSavedView = useCallback(async (view) => {
        const isActive = view.id === activeViewId;
        await deleteSavedView(view);
        if (isActive) {
            resetFilters();
        }
    }, [activeViewId, deleteSavedView, resetFilters]);
    const handleUpdateSavedView = useCallback(async (view, viewFilters) => {
        await updateSavedView(view, viewFilters);
        setFilters(normalizeCrmFilters(viewFilters));
    }, [setFilters, updateSavedView]);
    const savedViewsHandlers = {
        views,
        activeViewId,
        isSaving,
        isDeleting,
        createSavedView,
        updateSavedView: handleUpdateSavedView,
        deleteSavedView: handleDeleteSavedView,
        selectSavedView: handleSelectSavedView,
    };
    return (_jsx(CrmHomeLayout, { filters: filters, onFiltersChange: handleFiltersChange, onClearFilters: resetFilters, savedViews: savedViewsHandlers, filterOptions: filterOptions, metrics: metricsResult.summary, metricsSource: metricsResult.source, metricsLoading: metricsLoading || metricsFetching, onMetricsRefresh: () => void refetchMetrics() }));
};
const CrmHomeLayout = ({ filters, onFiltersChange, onClearFilters, savedViews, filterOptions, metrics, metricsSource, metricsLoading, onMetricsRefresh, }) => {
    const { state, closeLeadDrawer, openLeadDrawer, clearSelection } = useCrmViewContext();
    const { activeLeadId, isDrawerOpen } = state;
    return (_jsxs("div", { className: "flex h-full flex-col gap-6", children: [_jsxs("header", { className: "space-y-2", children: [_jsx("div", { className: "flex items-center justify-between gap-4", children: _jsx("h1", { className: "text-2xl font-semibold text-foreground", children: "CRM" }) }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Gerencie leads com filtros avan\u00E7ados, vis\u00F5es salvas e a\u00E7\u00F5es em massa. Mais recursos ser\u00E3o ativados conforme as pr\u00F3ximas etapas forem conclu\u00EDdas." })] }), _jsx(CrmMetricsBelt, { metrics: metrics, loading: metricsLoading, source: metricsSource, onRefresh: () => {
                    emitCrmTelemetry('crm.metrics.refresh', { source: 'home' });
                    onMetricsRefresh();
                } }), _jsx(CrmToolbar, { filters: filters, onFiltersChange: onFiltersChange, onClearFilters: onClearFilters, filterOptions: filterOptions, selectedCount: state.selection.selectedIds.size, ...(state.selection.selectedIds.size ? { onClearSelection: clearSelection } : {}), savedViews: savedViews }), _jsxs("div", { className: "space-y-4", children: [_jsx(CrmViewSwitcher, { onViewChange: (view) => {
                            emitCrmTelemetry('crm.view.change', { view });
                        } }), _jsx(CrmDataView, {}), _jsxs("div", { className: "rounded-lg border border-dashed border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground", children: [_jsx("p", { children: "Esta \u00E1rea exibir\u00E1 dados reais em breve. Enquanto isso, use o bot\u00E3o abaixo para visualizar o comportamento do drawer do lead." }), _jsx(Button, { type: "button", size: "sm", variant: "secondary", className: "mt-3", onClick: () => openLeadDrawer('lead-demo-1'), children: "Abrir drawer de exemplo" })] })] }), _jsx(LeadDrawer, { open: isDrawerOpen, leadId: activeLeadId, onOpenChange: (next) => (!next ? closeLeadDrawer() : undefined) })] }));
};
