export function extractQrPayload(payload: any): import("@ticketz/wa-contracts").NormalizedQrPayload | null;
export function getQrImageSrc(payload: any): {
    code: null;
    immediate: null;
    needsGeneration: boolean;
    isBaileys: boolean;
    available: false;
    reason: "UNAVAILABLE" | "EXPIRED" | null;
} | {
    code: null;
    immediate: null;
    needsGeneration: boolean;
    isBaileys: boolean;
    available: boolean;
    reason: "UNAVAILABLE" | "EXPIRED";
} | {
    code: string;
    immediate: string;
    needsGeneration: boolean;
    isBaileys: boolean;
    available: boolean;
    reason: null;
} | {
    code: string;
    immediate: null;
    needsGeneration: boolean;
    isBaileys: boolean;
    available: boolean;
    reason: null;
};
export function isLikelyBaileysPayload(value: any): boolean;
export function isDataUrl(value: any): boolean;
export function isHttpUrl(value: any): boolean;
import { normalizeQrPayload as normalizeQrPayloadContract } from '@ticketz/wa-contracts';
export { normalizeQrPayloadContract as normalizeQrPayload };
