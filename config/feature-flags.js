export const FEATURE_DEBUG_WHATSAPP = 'FEATURE_DEBUG_WHATSAPP';
const normalizeEnv = (env) => {
    if (!env || typeof env !== 'object') {
        return {};
    }
    return Object.fromEntries(Object.entries(env).map(([key, value]) => [key, typeof value === 'string' ? value : undefined]));
};
const parseBoolean = (value, defaultValue) => {
    if (typeof value !== 'string') {
        return defaultValue;
    }
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) {
        return false;
    }
    return defaultValue;
};
export const resolveSharedFeatureFlags = (env) => {
    const normalized = normalizeEnv(env);
    const whatsappDebug = parseBoolean(normalized[FEATURE_DEBUG_WHATSAPP], false);
    return { whatsappDebug };
};
const getProcessEnv = () => {
    if (typeof process === 'undefined' || !process?.env) {
        return {};
    }
    return normalizeEnv(process.env);
};
export const getBackendFeatureFlags = (env) => {
    if (env) {
        return resolveSharedFeatureFlags(env);
    }
    return resolveSharedFeatureFlags(getProcessEnv());
};
export const getFrontendFeatureFlags = (env) => {
    if (env) {
        return resolveSharedFeatureFlags(env);
    }
    return resolveSharedFeatureFlags();
};
export const isWhatsappDebugEnabled = (env) => resolveSharedFeatureFlags(env).whatsappDebug;
