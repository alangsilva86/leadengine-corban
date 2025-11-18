import type { NormalizedQrPayload } from '@ticketz/wa-contracts';

export type { NormalizedQrPayload } from '@ticketz/wa-contracts';

export interface QrImageMeta {
  code: string | null;
  immediate: string | null;
  needsGeneration: boolean;
  isBaileys: boolean;
  available: boolean;
  reason: NormalizedQrPayload['reason'];
}

export declare function normalizeQrPayload(payload: unknown): NormalizedQrPayload;

export declare function extractQrPayload(payload: unknown): NormalizedQrPayload | null;

export declare function getQrImageSrc(payload: unknown): QrImageMeta;

export declare function isLikelyBaileysPayload(value: unknown): boolean;

export declare function isDataUrl(value: unknown): boolean;

export declare function isHttpUrl(value: unknown): boolean;
