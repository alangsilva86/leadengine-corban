export function useMessagesQuery({ ticketId, enabled, pageSize, }?: {
    enabled?: boolean | undefined;
    pageSize?: number | undefined;
}): import("@tanstack/react-query").UseInfiniteQueryResult<import("@tanstack/react-query").InfiniteData<any, unknown>, Error>;
export default useMessagesQuery;
