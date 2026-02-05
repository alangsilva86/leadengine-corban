import type { CrmFilterState } from '../state/types';
import type { LeadAgingSummary } from '../state/leads';
export declare const useCrmAging: (filters: CrmFilterState) => {
    summary: LeadAgingSummary;
    isLoading: boolean;
    isFetching: boolean;
    error: Error | null;
    refetch: (options?: import("@tanstack/react-query").RefetchOptions) => Promise<import("@tanstack/react-query").QueryObserverResult<LeadAgingSummary, Error>>;
};
export default useCrmAging;
