import type { LeadTask } from '../state/leads';
export declare const useLeadTasks: (leadId: string | null) => {
    tasks: LeadTask[];
    isLoading: boolean;
    isFetching: boolean;
    error: Error | null;
    refetch: (options?: import("@tanstack/react-query").RefetchOptions) => Promise<import("@tanstack/react-query").QueryObserverResult<LeadTask[], Error>>;
};
export default useLeadTasks;
