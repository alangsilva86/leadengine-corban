const POLL_PLACEHOLDER_MESSAGE_VALUES = [
    '[Mensagem recebida via WhatsApp]',
    '[Mensagem]',
];
export const POLL_PLACEHOLDER_MESSAGES = new Set(POLL_PLACEHOLDER_MESSAGE_VALUES);
export const normalizeTextValue = (value) => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        const normalized = value.toString().trim();
        return normalized.length > 0 ? normalized : null;
    }
    return null;
};
export const getFirstNonEmptyString = (...candidates) => {
    for (const candidate of candidates) {
        const normalized = normalizeTextValue(candidate);
        if (normalized) {
            return normalized;
        }
    }
    return null;
};
export const getFirstInteger = (...candidates) => {
    for (const candidate of candidates) {
        if (typeof candidate === 'number' && Number.isInteger(candidate)) {
            return candidate;
        }
    }
    return null;
};
export const dedupeNormalizedStrings = (values) => {
    const unique = new Set();
    for (const value of values) {
        const normalized = normalizeTextValue(value);
        if (normalized) {
            unique.add(normalized);
        }
    }
    return Array.from(unique.values());
};
export const isPollPlaceholderText = (value) => {
    const normalized = normalizeTextValue(value);
    if (!normalized) {
        return false;
    }
    return POLL_PLACEHOLDER_MESSAGES.has(normalized);
};
