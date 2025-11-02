import { Suspense, lazy } from 'react';
import { useCrmViewState } from '../state/view-context.tsx';

const LeadKanbanView = lazy(() => import('../views/LeadKanbanView.tsx'));
const LeadTableView = lazy(() => import('../views/LeadTableView.tsx'));
const LeadCalendarView = lazy(() => import('../views/LeadCalendarView.tsx'));
const LeadTimelineView = lazy(() => import('../views/LeadTimelineView.tsx'));
const LeadAgingView = lazy(() => import('../views/LeadAgingView.tsx'));
const LeadInsightsView = lazy(() => import('../views/LeadInsightsView.tsx'));

const viewComponents = {
  kanban: LeadKanbanView,
  list: LeadTableView,
  calendar: LeadCalendarView,
  timeline: LeadTimelineView,
  aging: LeadAgingView,
  insights: LeadInsightsView,
} as const;

const ViewFallback = () => (
  <div className="flex h-[420px] items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10 text-sm text-muted-foreground">
    Carregando visão...
  </div>
);

const CrmDataView = () => {
  const { view } = useCrmViewState();
  const ActiveView = viewComponents[view];

  return (
    <Suspense fallback={<ViewFallback />}>
      <ActiveView />
    </Suspense>
  );
};

export default CrmDataView;
