declare function PrimaryActionBanner({ name, title, shortId, statusInfo, stageKey, stageInfo, originInfo, typingAgents, primaryAction, onPrimaryAction, jro, commandContext, detailsOpen, onRequestDetails, nextStepValue, ticket, aiMode, aiConfidence, aiModeChangeDisabled, onAiModeChange, onTakeOver, onGiveBackToAi, contactPhone, instanceId, instancePresentation, }: {
    name: any;
    title: any;
    shortId: any;
    statusInfo: any;
    stageKey: any;
    stageInfo: any;
    originInfo: any;
    typingAgents: any;
    primaryAction: any;
    onPrimaryAction: any;
    jro: any;
    commandContext: any;
    detailsOpen?: boolean | undefined;
    onRequestDetails: any;
    nextStepValue: any;
    ticket: any;
    aiMode?: string | undefined;
    aiConfidence?: null | undefined;
    aiModeChangeDisabled?: boolean | undefined;
    onAiModeChange: any;
    onTakeOver: any;
    onGiveBackToAi: any;
    contactPhone: any;
    instanceId: any;
    instancePresentation: any;
}): import("react/jsx-runtime").JSX.Element;
export function PrimaryActionButton({ action, jroState, onExecute, disabled }: {
    action: any;
    jroState: any;
    onExecute: any;
    disabled: any;
}): import("react/jsx-runtime").JSX.Element | null;
export function TypingIndicator({ agents }: {
    agents?: never[] | undefined;
}): import("react/jsx-runtime").JSX.Element | null;
export function JroIndicator({ jro }: {
    jro: any;
}): import("react/jsx-runtime").JSX.Element;
export function Indicator({ icon: Icon, tone, label, description, className }: {
    icon: any;
    tone?: string | undefined;
    label: any;
    description: any;
    className: any;
}): import("react/jsx-runtime").JSX.Element | null;
export { PrimaryActionBanner as default };
