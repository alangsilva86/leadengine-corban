export const FEATURE_DEBUG_WHATSAPP = 'FEATURE_DEBUG_WHATSAPP' as const;

export type SharedFeatureFlags = {
  whatsappDebug: boolean;
};

type EnvSource = Record<string, string | undefined> | undefined | null;

const normalizeEnv = (env: EnvSource): Record<string, string | undefined> => {
  if (!env || typeof env !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [key, typeof value === 'string' ? value : undefined])
  );
};

const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
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

export const resolveSharedFeatureFlags = (env?: EnvSource): SharedFeatureFlags => {
  const normalized = normalizeEnv(env);

  const whatsappDebug = parseBoolean(normalized[FEATURE_DEBUG_WHATSAPP], false);

  return { whatsappDebug } satisfies SharedFeatureFlags;
};

const getProcessEnv = (): Record<string, string | undefined> => {
  if (typeof process === 'undefined' || !process?.env) {
    return {};
  }

  return normalizeEnv(process.env);
};

export const getBackendFeatureFlags = (env?: EnvSource): SharedFeatureFlags => {
  if (env) {
    return resolveSharedFeatureFlags(env);
  }

  return resolveSharedFeatureFlags(getProcessEnv());
};

export const getFrontendFeatureFlags = (env?: EnvSource): SharedFeatureFlags => {
  if (env) {
    return resolveSharedFeatureFlags(env);
  }

  return resolveSharedFeatureFlags();
};

export const isWhatsappDebugEnabled = (env?: EnvSource): boolean =>
  resolveSharedFeatureFlags(env).whatsappDebug;
