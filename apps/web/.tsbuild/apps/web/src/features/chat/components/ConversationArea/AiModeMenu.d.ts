export default AiModeMenu;
export function AiModeControlMenu({ ticket, aiMode, aiConfidence, onAiModeChange, onTakeOver, onGiveBackToAi, aiModeChangeDisabled, className, }: {
    ticket: any;
    aiMode: any;
    aiConfidence: any;
    onAiModeChange: any;
    onTakeOver: any;
    onGiveBackToAi: any;
    aiModeChangeDisabled?: boolean | undefined;
    className: any;
}): import("react/jsx-runtime").JSX.Element;
declare function AiModeMenu({ mode, onSelect, disabled, onRequestClose }: {
    mode: any;
    onSelect: any;
    disabled?: boolean | undefined;
    onRequestClose: any;
}): import("react/jsx-runtime").JSX.Element;
