export function useWhatsAppPresence({ typingIndicator, ticketId }: {
    typingIndicator: any;
    ticketId: any;
}): {
    typingAgents: any;
    broadcastTyping: () => void;
};
export default useWhatsAppPresence;
