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
} as const;

const ViewFallback = () => (
  <div
    className="flex h-[420px] animate-pulse items-center justify-center rounded-lg bg-surface-sunken text-sm text-muted-foreground"
    role="status"
  >
    Carregando…
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
