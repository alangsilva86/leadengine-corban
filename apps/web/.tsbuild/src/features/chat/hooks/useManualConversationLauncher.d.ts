export namespace MANUAL_PAYLOAD_LIMITS {
    export { PHONE_MIN_DIGITS as minPhoneDigits };
    export { PHONE_MAX_DIGITS as maxPhoneDigits };
}
export namespace MANUAL_PAYLOAD_ERRORS {
    let phone: string;
    let message: string;
    let instance: string;
}
export function validateManualPayload({ phone, message, instanceId }: {
    phone: any;
    message: any;
    instanceId: any;
}): {
    errors: {
        phone: string;
        message: string;
        instanceId: string;
    } | null;
    payload: {
        phone: string | null;
        digits: string | null;
        message: string;
        instanceId: string;
    } | null;
};
export function useManualConversationLauncher(): {
    launch: (payload: any) => Promise<{
        contact: any;
        contactId: any;
        ticket: null;
        ticketId: any;
        message: null;
        messageId: any;
        outboundResponse: any;
        raw: any;
    }>;
    isPending: boolean;
    error: Error | null;
    data: {
        contact: any;
        contactId: any;
        ticket: null;
        ticketId: any;
        message: null;
        messageId: any;
        outboundResponse: any;
        raw: any;
    } | undefined;
    reset: () => void;
    isAvailable: boolean;
    unavailableReason: null;
};
export default useManualConversationLauncher;
import { PHONE_MIN_DIGITS } from '@ticketz/shared';
import { PHONE_MAX_DIGITS } from '@ticketz/shared';
