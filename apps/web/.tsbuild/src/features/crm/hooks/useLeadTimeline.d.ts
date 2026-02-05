import type { LeadTimelineEvent } from '../state/leads';
export declare const useLeadTimeline: (leadId: string | null) => {
    timeline: LeadTimelineEvent[];
    isLoading: boolean;
    isFetching: boolean;
    error: Error | null;
    refetch: (options?: import("@tanstack/react-query").RefetchOptions) => Promise<import("@tanstack/react-query").QueryObserverResult<LeadTimelineEvent[], Error>>;
};
export default useLeadTimeline;
