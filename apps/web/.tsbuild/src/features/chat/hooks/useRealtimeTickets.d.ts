export function useRealtimeTickets({ tenantId, userId, ticketId, enabled, onTicketEvent, onTicketUpdated, onMessageCreated, onMessageUpdated, onMessageStatusChanged, onTyping, onQueueMissing, }?: {
    enabled?: boolean | undefined;
}): {
    connected: boolean;
    connectionError: null;
    socket: null;
};
export default useRealtimeTickets;
