import type { CrmFilterState } from '../state/types';
import type { LeadTimelineEvent } from '../state/leads';
type TimelineFilters = {
    eventTypes?: string[];
    limit?: number;
};
export declare const useCrmTimeline: (filters: CrmFilterState, options: TimelineFilters) => {
    events: LeadTimelineEvent[];
    isLoading: boolean;
    isFetching: boolean;
    error: Error | null;
    refetch: (options?: import("@tanstack/react-query").RefetchOptions) => Promise<import("@tanstack/react-query").QueryObserverResult<LeadTimelineEvent[], Error>>;
};
export default useCrmTimeline;
