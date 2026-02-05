import type { CrmFilterState } from '../state/types';
import type { LeadTask } from '../state/leads';
type DateRange = {
    from: Date;
    to: Date;
};
export declare const useCrmTasks: (filters: CrmFilterState, range: DateRange) => {
    tasks: LeadTask[];
    isLoading: boolean;
    isFetching: boolean;
    error: Error | null;
    refetch: (options?: import("@tanstack/react-query").RefetchOptions) => Promise<import("@tanstack/react-query").QueryObserverResult<LeadTask[], Error>>;
};
export default useCrmTasks;
