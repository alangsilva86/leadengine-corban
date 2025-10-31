import { toast } from 'sonner';

type CampaignActionState = {
  id: string | null;
  type: string | null;
};

type SetCampaignAction = (value: CampaignActionState | null) => void;
type SetCampaignError = (value: string | null) => void;
type LogError = (message: string, error: unknown) => void;
type OnUnauthorized = (error: any) => void;

type SuccessMessage<TPayload> = string | null | ((payload: TPayload) => string | null | undefined);

type ExecuteCampaignActionParams<TPayload> = {
  actionType: string;
  actionId?: string | null;
  service: () => Promise<TPayload>;
  setCampaignAction: SetCampaignAction;
  setCampaignError: SetCampaignError;
  successToastMessage?: SuccessMessage<TPayload>;
  errorToastTitle: string;
  defaultErrorMessage: string;
  logError?: LogError;
  logLabel?: string;
  resolveErrorMessage?: (error: any, fallbackMessage: string) => string;
  onUnauthorized?: OnUnauthorized;
  onSuccess?: (payload: TPayload) => void | Promise<void>;
  onError?: (error: any, message: string) => void | Promise<void>;
};

const resolveDefaultErrorMessage = (error: any, fallback: string): string => {
  if (error?.payload?.error?.message) {
    return error.payload.error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

export async function executeCampaignAction<TPayload>({
  actionType,
  actionId = null,
  service,
  setCampaignAction,
  setCampaignError,
  successToastMessage,
  errorToastTitle,
  defaultErrorMessage,
  logError,
  logLabel,
  resolveErrorMessage = resolveDefaultErrorMessage,
  onUnauthorized,
  onSuccess,
  onError,
}: ExecuteCampaignActionParams<TPayload>): Promise<TPayload> {
  setCampaignError(null);
  setCampaignAction({ id: actionId, type: actionType });

  try {
    const payload = await service();

    if (onSuccess) {
      await onSuccess(payload);
    }

    const successMessage =
      typeof successToastMessage === 'function'
        ? successToastMessage(payload)
        : successToastMessage;

    if (successMessage) {
      toast.success(successMessage);
    }

    return payload;
  } catch (error: any) {
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
  } finally {
    setCampaignAction(null);
  }
}
