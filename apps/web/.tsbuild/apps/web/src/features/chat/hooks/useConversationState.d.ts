export function useConversationState({ ticket, messagesPages, notes }: {
    ticket: any;
    messagesPages: any;
    notes: any;
}): {
    messages: any[];
    timeline: any[];
    statistics: {
        totalMessages: number;
        lastInbound: Date | null;
        window: any;
    };
};
export default useConversationState;
