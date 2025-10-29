const FEATURE_DEBUG_WHATSAPP = 'FEATURE_DEBUG_WHATSAPP';

const normalizeEnv = (env) => {
  if (!env || typeof env !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [key, typeof value === 'string' ? value : undefined]),
  );
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

const resolveSharedFeatureFlags = (env) => {
  const normalized = normalizeEnv(env);
  const whatsappDebug = parseBoolean(normalized[FEATURE_DEBUG_WHATSAPP], false);
  return { whatsappDebug };
};

export const getFrontendFeatureFlags = (env) => {
  if (env) {
    return resolveSharedFeatureFlags(env);
  }
  return resolveSharedFeatureFlags(import.meta.env);
};

export { FEATURE_DEBUG_WHATSAPP };
