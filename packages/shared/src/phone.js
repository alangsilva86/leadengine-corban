export const PHONE_MIN_DIGITS = 10;
export const PHONE_MAX_DIGITS = 15;
const normalizeRawPhone = (value) => {
    if (value === null || value === undefined) {
        return null;
    }
    const asString = typeof value === 'string' ? value : value.toString();
    const trimmed = asString.trim();
    if (!trimmed) {
        return null;
    }
    const withoutDomain = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
    return withoutDomain || null;
};
export const extractPhoneDigits = (value) => {
    const normalized = normalizeRawPhone(value);
    if (!normalized) {
        return null;
    }
    const digits = normalized.replace(/\D/g, '');
    return digits.length > 0 ? digits : null;
};
export const normalizePhoneE164 = (value, { minDigits = PHONE_MIN_DIGITS, maxDigits = PHONE_MAX_DIGITS } = {}) => {
    const digits = extractPhoneDigits(value);
    if (!digits) {
        return null;
    }
    if (digits.length < minDigits || digits.length > maxDigits) {
        return null;
    }
    return `+${digits}`;
};
export const sanitizePhone = (value) => normalizePhoneE164(value) ?? undefined;
