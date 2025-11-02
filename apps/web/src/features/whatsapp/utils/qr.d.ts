export interface NormalizedQrPayload {
  qr: string | null;
  qrCode: string | null;
  qrExpiresAt: string | null;
  expiresAt: string | null;
  available?: boolean;
  reason?: string | null;
}

export interface QrImageMeta {
  code: string | null;
  immediate: string | null;
  needsGeneration: boolean;
  isBaileys: boolean;
  available: boolean | undefined;
  reason: string | null;
}

export declare function extractQrPayload(payload: unknown): NormalizedQrPayload | null;

export declare function getQrImageSrc(payload: unknown): QrImageMeta;

export declare function isLikelyBaileysPayload(value: unknown): boolean;

export declare function isDataUrl(value: unknown): boolean;

export declare function isHttpUrl(value: unknown): boolean;
