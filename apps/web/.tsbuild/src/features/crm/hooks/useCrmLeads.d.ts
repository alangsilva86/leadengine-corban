import type { CrmFilterState } from '../state/types';
export declare const useCrmLeads: (filters: CrmFilterState) => {
    leads: any[];
    total: any;
    isLoading: false;
    isFetching: boolean;
    isFetchingNextPage: boolean;
    error: Error | null;
    fetchNextPage: (options?: import("@tanstack/react-query").FetchNextPageOptions) => Promise<import("@tanstack/react-query").InfiniteQueryObserverResult<import("@tanstack/react-query").InfiniteData<TQueryFnData, unknown>, Error>>;
    hasNextPage: boolean;
    refetch: (options?: import("@tanstack/react-query").RefetchOptions) => Promise<import("@tanstack/react-query").QueryObserverResult<import("@tanstack/react-query").InfiniteData<TQueryFnData, unknown>, Error>>;
};
export default useCrmLeads;
