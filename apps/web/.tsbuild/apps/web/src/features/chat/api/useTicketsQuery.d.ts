export function useTicketsQuery({ filters, limit, includeMetrics, enabled, staleTime, sortBy, sortOrder, }?: {
    filters?: {} | undefined;
    limit?: number | undefined;
    includeMetrics?: boolean | undefined;
    enabled?: boolean | undefined;
    staleTime?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: string | undefined;
}): import("@tanstack/react-query").DefinedUseQueryResult<unknown, Error>;
export default useTicketsQuery;
