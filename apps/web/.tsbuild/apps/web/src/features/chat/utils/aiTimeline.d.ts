export const DEFAULT_AI_MODE: "IA_AUTO";
export function normalizeAiMode(value: any, fallback?: string): string;
export function getTimelineEntryContent(payload: any): any;
export function parseMessageRole(value: any): "user" | "assistant" | "system";
export function buildAiContextTimeline(timeline: any): ({
    content: any;
    role: any;
} | null)[];
export function buildAiMessagesPayload(timeline: any): ({
    role: string;
    content: string;
} | null)[];
export function sanitizeAiTimeline(timeline: any): any[];
export const MAX_AI_TIMELINE_ITEMS: 50;
