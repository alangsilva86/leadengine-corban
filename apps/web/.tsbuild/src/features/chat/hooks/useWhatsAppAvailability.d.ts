interface WhatsAppErrorLike {
    payload?: {
        code?: string | null;
    } | null;
    code?: string | null;
    message?: string | null;
}
interface UseWhatsAppAvailabilityInput {
    selectedTicketId?: string | null;
}
export declare const useWhatsAppAvailability: ({ selectedTicketId }: UseWhatsAppAvailabilityInput) => {
    readonly unavailableReason: {
        code: any;
        title: any;
        description: any;
    } | null;
    readonly composerDisabled: boolean;
    readonly notice: ({
        code: any;
        title: any;
        description: any;
    } & {
        requestId?: string | null;
        action?: string | null;
        actionLabel?: string | null;
        queuedMessageId?: string | null;
        timestamp?: string;
    }) | null;
    readonly notifyOutboundError: (error: WhatsAppErrorLike | null | undefined, fallbackMessage: string) => {
        description: any;
        requestId: any;
        action: "refresh_instances";
        actionLabel: string;
        queuedMessageId: any;
        timestamp: string;
        code: any;
        title: any;
    };
    readonly resetAvailability: () => void;
};
export type UseWhatsAppAvailabilityReturn = ReturnType<typeof useWhatsAppAvailability>;
export default useWhatsAppAvailability;
