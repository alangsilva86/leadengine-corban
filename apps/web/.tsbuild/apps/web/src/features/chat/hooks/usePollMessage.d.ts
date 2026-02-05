export function usePollMessage({ message, messageType, rawTextContent }: {
    message: any;
    messageType: any;
    rawTextContent: any;
}): {
    textContent: string;
    shouldForceText: boolean;
    pollFallbackText: string | null;
    pollMetadata: {
        id: string | null;
        question: string | null;
        updatedAtIso: string | null;
        totalVotes: number | null;
        totalVoters: number | null;
        hasMetadata: boolean;
    };
    voteBubble: {
        shouldRender: boolean;
        question: string | null;
        pollId: string | null;
        totalVotes: number | null;
        totalVoters: number | null;
        updatedAtIso: string | null;
        selectedOptions: any[];
        textContent: string | null;
    };
    pollBubble: {
        shouldRender: boolean;
        title: string;
        options: {
            id: string;
            label: any;
            votes: any;
            isSelected: any;
            index: any;
        }[];
        totalVotes: number | null;
        totalVoters: number | null;
        isMetadataMissing: boolean;
    };
};
export default usePollMessage;
