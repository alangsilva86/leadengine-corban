import type { LeadDetail } from '../state/leads';
export declare const useLeadDetails: (leadId: string | null) => {
    lead: LeadDetail | undefined;
    isLoading: boolean;
    isFetching: boolean;
    error: Error | null;
    refetch: (options?: import("@tanstack/react-query").RefetchOptions) => Promise<import("@tanstack/react-query").QueryObserverResult<LeadDetail, Error>>;
};
export default useLeadDetails;
