export function useTypingIndicator({ timeoutMs, socket }?: {
    timeoutMs?: number | undefined;
}): {
    agentsTyping: {
        userId: never;
        userName: never;
    }[];
    registerTypingEvent: ({ ticketId, userId, userName }: {
        ticketId: any;
        userId: any;
        userName: any;
    }) => void;
    broadcastTyping: ({ ticketId }: {
        ticketId: any;
    }) => void;
};
export default useTypingIndicator;
