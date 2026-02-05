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
export declare function executeCampaignAction<TPayload>({ actionType, actionId, service, setCampaignAction, setCampaignError, successToastMessage, errorToastTitle, defaultErrorMessage, logError, logLabel, resolveErrorMessage, onUnauthorized, onSuccess, onError, }: ExecuteCampaignActionParams<TPayload>): Promise<TPayload>;
export {};
