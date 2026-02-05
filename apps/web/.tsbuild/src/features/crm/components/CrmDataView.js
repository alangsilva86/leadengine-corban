import { jsx as _jsx } from "react/jsx-runtime";
import { Suspense, lazy } from 'react';
import { useCrmViewState } from '../state/view-context';
const LeadKanbanView = lazy(() => import('../views/LeadKanbanView'));
const LeadTableView = lazy(() => import('../views/LeadTableView'));
const LeadCalendarView = lazy(() => import('../views/LeadCalendarView'));
const LeadTimelineView = lazy(() => import('../views/LeadTimelineView'));
const LeadAgingView = lazy(() => import('../views/LeadAgingView'));
const LeadInsightsView = lazy(() => import('../views/LeadInsightsView'));
const viewComponents = {
    kanban: LeadKanbanView,
    list: LeadTableView,
    calendar: LeadCalendarView,
    timeline: LeadTimelineView,
    aging: LeadAgingView,
    insights: LeadInsightsView,
};
const ViewFallback = () => (_jsx("div", { className: "flex h-[420px] items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10 text-sm text-muted-foreground", children: "Carregando vis\u00E3o..." }));
const CrmDataView = () => {
    const { view } = useCrmViewState();
    const ActiveView = viewComponents[view];
    return (_jsx(Suspense, { fallback: _jsx(ViewFallback, {}), children: _jsx(ActiveView, {}) }));
};
export default CrmDataView;
