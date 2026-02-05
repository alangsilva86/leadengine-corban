export function useAiSuggestions({ ticketId, tenantId, queueId }?: {
    ticketId?: null | undefined;
    tenantId?: null | undefined;
    queueId?: null | undefined;
}): {
    requestSuggestions: (payload: any) => Promise<{
        nextStep: string | null;
        tips: any;
        objections: (string | null)[];
        confidence: number | null;
        raw: {};
    }>;
    isLoading: boolean;
    data: {
        nextStep: string | null;
        tips: any;
        objections: (string | null)[];
        confidence: number | null;
        raw: {};
    } | null;
    reset: () => void;
    error: Error | null;
};
export default useAiSuggestions;
