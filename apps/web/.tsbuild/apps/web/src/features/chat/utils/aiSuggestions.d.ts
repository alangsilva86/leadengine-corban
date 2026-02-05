export function normalizeConfidence(value: any): number | null;
export function extractAiSuggestion(rawPayload?: {}): {
    nextStep: string | null;
    tips: any;
    objections: (string | null)[];
    confidence: number | null;
    raw: {};
};
export function formatAiSuggestionNote(suggestion: any): string | null;
export default extractAiSuggestion;
