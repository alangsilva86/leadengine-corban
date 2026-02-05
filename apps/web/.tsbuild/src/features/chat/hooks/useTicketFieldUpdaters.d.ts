import { type ContactField, type DealField } from '../utils/validation';
interface EntityLike {
    id?: string | null;
    [key: string]: unknown;
}
interface LeadLike extends EntityLike {
    customFields?: {
        deal?: Record<string, unknown> | null;
    } | null;
}
interface TicketMetadata {
    nextAction?: {
        description?: string | null;
    } | null;
    [key: string]: unknown;
}
interface TicketLike extends EntityLike {
    metadata?: TicketMetadata | null;
    nextStep?: {
        description?: string | null;
    } | null;
}
interface ChatControllerLike {
    selectedTicketId?: string | null;
}
interface UseTicketFieldUpdatersInput {
    controller: ChatControllerLike;
    selectedTicket?: TicketLike | null;
    selectedContact?: EntityLike | null;
    selectedLead?: LeadLike | null;
    currentUser?: {
        id?: string | null;
    } | null;
}
export declare const useTicketFieldUpdaters: ({ controller, selectedTicket, selectedContact, selectedLead, currentUser, }: UseTicketFieldUpdatersInput) => {
    readonly onContactFieldSave: (field: ContactField, rawValue: unknown) => Promise<void>;
    readonly onDealFieldSave: (field: DealField, rawValue: unknown) => Promise<void>;
    readonly onNextStepSave: (value: unknown) => Promise<import("../api/useUpdateNextStep.js").UpdateNextStepResponse>;
    readonly nextStepValue: string;
};
export type UseTicketFieldUpdatersReturn = ReturnType<typeof useTicketFieldUpdaters>;
export default useTicketFieldUpdaters;
