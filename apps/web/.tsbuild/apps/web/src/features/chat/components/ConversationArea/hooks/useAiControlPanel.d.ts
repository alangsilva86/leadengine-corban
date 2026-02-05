export default useAiControlPanel;
import { AI_MODE_OPTIONS } from '../aiModes.js';
import { DEFAULT_AI_MODE } from '../aiModes.js';
export const AI_HANDOFF_CONFIDENCE_THRESHOLD: 0.5;
export namespace AI_CONFIDENCE_TONES {
    let high: string;
    let medium: string;
    let low: string;
    let unknown: string;
}
import { isValidAiMode } from '../aiModes.js';
declare function useAiControlPanel({ ticket, aiMode, aiConfidence, onAiModeChange, onTakeOver, onGiveBackToAi, aiModeChangeDisabled, }: {
    ticket: any;
    aiMode: any;
    aiConfidence: any;
    onAiModeChange: any;
    onTakeOver: any;
    onGiveBackToAi: any;
    aiModeChangeDisabled?: boolean | undefined;
}): {
    aiModeOptions: {
        value: string;
        label: string;
        shortLabel: string;
        description: string;
    }[];
    normalizedAiMode: any;
    aiModeSelectDisabled: boolean;
    handleAiModeSelect: (value: any) => void;
    aiConfidenceLabel: string;
    aiConfidenceToneClass: string;
    handleTakeOverClick: () => void;
    handleGiveBackClick: () => void;
    takeoverDisabled: boolean;
    giveBackDisabled: boolean;
    takeoverTooltipMessage: string;
    giveBackTooltipMessage: string;
};
export { AI_MODE_OPTIONS, DEFAULT_AI_MODE, isValidAiMode };
