export const AI_MODE_OPTIONS: {
    value: string;
    label: string;
    shortLabel: string;
    description: string;
}[];
export const DEFAULT_AI_MODE: string;
export function getAiModeOption(value: any): {
    value: string;
    label: string;
    shortLabel: string;
    description: string;
} | undefined;
export function isValidAiMode(value: any): boolean;
