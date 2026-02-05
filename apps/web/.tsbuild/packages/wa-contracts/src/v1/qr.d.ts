export type NormalizedQrReason = 'UNAVAILABLE' | 'EXPIRED' | null;
export type NormalizedQrPayload = {
    qr: string | null;
    qrCode: string | null;
    qrExpiresAt: string | null;
    expiresAt: string | null;
    available: boolean;
    reason: NormalizedQrReason;
};
export declare const normalizeQrPayload: (value: unknown) => NormalizedQrPayload;
