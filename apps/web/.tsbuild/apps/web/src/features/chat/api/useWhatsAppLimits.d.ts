export function useWhatsAppLimits({ enabled, staleTime }?: {
    enabled?: boolean | undefined;
    staleTime?: number | undefined;
}): import("@tanstack/react-query").UseQueryResult<{
    metrics: any;
    quality: any;
}, Error>;
export default useWhatsAppLimits;
