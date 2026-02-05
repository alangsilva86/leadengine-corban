import type { OutboundMessageResponse } from '@ticketz/contracts';
interface ChatControllerLike {
    selectedTicketId?: string | null;
    ticketsQuery?: {
        refetch?: (options?: {
            cancelRefetch?: boolean;
            throwOnError?: boolean;
        }) => Promise<unknown>;
    };
    selectTicket?: (ticketId: string) => void;
}
interface ManualConversationPayload {
    phone: string;
    message: string;
    instanceId: string;
}
interface ManualConversationResult {
    ticket?: {
        id?: string | null;
    } | null;
    ticketId?: string | null;
    message?: {
        ticketId?: string | null;
    } | null;
    contact?: {
        id?: string | null;
    } | null;
    outboundResponse?: OutboundMessageResponse | null;
}
interface UseManualConversationFlowInput {
    controller: ChatControllerLike;
}
export declare const useManualConversationFlow: ({ controller }: UseManualConversationFlowInput) => {
    readonly isDialogOpen: boolean;
    readonly setDialogOpen: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    readonly openDialog: () => void;
    readonly closeDialog: () => void;
    readonly onSubmit: (payload: ManualConversationPayload) => Promise<{
        contact: any;
        contactId: any;
        ticket: null;
        ticketId: any;
        message: null;
        messageId: any;
        outboundResponse: any;
        raw: any;
    }>;
    readonly onSuccess: (result: ManualConversationResult | null) => Promise<ManualConversationResult | null>;
    readonly isPending: boolean;
    readonly error: Error | null;
    readonly isAvailable: boolean;
    readonly unavailableReason: null;
};
export type UseManualConversationFlowReturn = ReturnType<typeof useManualConversationFlow>;
export default useManualConversationFlow;
