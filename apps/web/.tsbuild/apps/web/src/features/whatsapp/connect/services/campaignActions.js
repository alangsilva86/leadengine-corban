import { toast } from 'sonner';
const resolveDefaultErrorMessage = (error, fallback) => {
    if (error?.payload?.error?.message) {
        return error.payload.error.message;
    }
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
};
export async function executeCampaignAction({ actionType, actionId = null, service, setCampaignAction, setCampaignError, successToastMessage, errorToastTitle, defaultErrorMessage, logError, logLabel, resolveErrorMessage = resolveDefaultErrorMessage, onUnauthorized, onSuccess, onError, }) {
    setCampaignError(null);
    setCampaignAction({ id: actionId, type: actionType });
    try {
        const payload = await service();
        if (onSuccess) {
            await onSuccess(payload);
        }
        const successMessage = typeof successToastMessage === 'function'
            ? successToastMessage(payload)
            : successToastMessage;
        if (successMessage) {
            toast.success(successMessage);
        }
        return payload;
    }
    catch (error) {
        if (error?.payload?.status === 401 || error?.status === 401) {
            onUnauthorized?.(error);
            throw error;
        }
        const message = resolveErrorMessage(error, defaultErrorMessage);
        setCampaignError(message);
        toast.error(errorToastTitle, { description: message });
        if (logError) {
            logError(logLabel ?? errorToastTitle, error);
        }
        if (onError) {
            await onError(error, message);
        }
        throw error instanceof Error ? error : new Error(message);
    }
    finally {
        setCampaignAction(null);
    }
}
