export const NO_STAGE_VALUE: "__none__";
export function formatJson(value: any): string;
export function normalizeStageState(value: any): string;
export function resolveStageValue(value: any): string;
export function formatDateInput(date: any): string;
export function parseDateInput(value: any): Date | null;
export function ensureUniqueTerms(terms: any): any[];
export function parseMetadataText(metadataText: any): {
    parsed: null;
    error: string;
} | {
    parsed: any;
    error: null;
};
