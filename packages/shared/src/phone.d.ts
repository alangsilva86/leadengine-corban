export declare const PHONE_MIN_DIGITS = 10;
export declare const PHONE_MAX_DIGITS = 15;
export declare const extractPhoneDigits: (value?: string | number | bigint | null) => string | null;
export declare const normalizePhoneE164: (value?: string | number | bigint | null, { minDigits, maxDigits }?: {
    minDigits?: number;
    maxDigits?: number;
}) => string | null;
export declare const sanitizePhone: (value?: string | number | bigint | null) => string | undefined;
