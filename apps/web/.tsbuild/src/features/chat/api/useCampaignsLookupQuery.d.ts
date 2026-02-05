export function useCampaignsLookupQuery({ search, enabled }?: {
    search?: string | undefined;
    enabled?: boolean | undefined;
}): import("@tanstack/react-query").UseQueryResult<any, Error>;
export default useCampaignsLookupQuery;
