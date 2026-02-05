export function useChatController({ tenantId, currentUser }?: {}): {
    tenantId: any;
    currentUser: any;
    filters: {
        scope: string;
        state: string;
        window: string;
        search: string;
        outcome: null;
        instanceId: null;
        campaignId: null;
        productType: null;
        strategy: null;
    };
    setFilters: (updater: any) => void;
    setSearch: (value: any) => void;
    ticketsQuery: import("@tanstack/react-query").DefinedUseQueryResult<unknown, Error>;
    tickets: any;
    metrics: any;
    selectedTicketId: null;
    selectedTicket: any;
    selectedTicketIds: never[];
    selectTicket: (ticketId: any) => void;
    toggleTicketSelection: (ticketId: any) => void;
    clearTicketSelection: () => void;
    messagesQuery: import("@tanstack/react-query").UseInfiniteQueryResult<import("@tanstack/react-query").InfiniteData<any, unknown>, Error>;
    conversation: {
        messages: any[];
        timeline: any[];
        statistics: {
            totalMessages: number;
            lastInbound: Date | null;
            window: any;
        };
    };
    sendMessageMutation: import("@tanstack/react-query").UseMutationResult<import("../api/useSendMessage.js").SendMessageMutationResult, unknown, import("../api/useSendMessage.js").SendMessageMutationVariables, unknown>;
    notesMutation: import("@tanstack/react-query").UseMutationResult<any, unknown, import("../api/useNotesMutation.js").NotesMutationVariables, unknown>;
    statusMutation: import("@tanstack/react-query").UseMutationResult<any, unknown, import("../api/useTicketStatusMutation.js").TicketStatusMutationVariables, unknown>;
    assignMutation: import("@tanstack/react-query").UseMutationResult<any, unknown, import("../api/useTicketAssignMutation.js").TicketAssignMutationVariables, unknown>;
    realtime: {
        connected: boolean;
        connectionError: null;
        socket: null;
    };
    typingIndicator: {
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
    queueAlerts: never[];
};
export default useChatController;
