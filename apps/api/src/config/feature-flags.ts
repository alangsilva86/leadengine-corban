import { logger } from './logger';

const FEATURE_DEBUG_WHATSAPP = 'FEATURE_DEBUG_WHATSAPP' as const;

type EnvSource = Record<string, string | undefined> | undefined | null;

const normalizeEnv = (env: EnvSource): Record<string, string | undefined> => {
  if (!env || typeof env !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [key, typeof value === 'string' ? value : undefined])
  );
};

const parseSharedBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
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

type SharedFeatureFlags = {
  whatsappDebug: boolean;
};

const resolveSharedFeatureFlags = (env?: EnvSource): SharedFeatureFlags => {
  const normalized = normalizeEnv(env);
  const whatsappDebug = parseSharedBoolean(normalized[FEATURE_DEBUG_WHATSAPP], false);
  return { whatsappDebug };
};

type FeatureFlags = {
  useRealData: boolean;
  mvpAuthBypass: boolean;
  whatsappRawFallbackEnabled: boolean;
  whatsappInboundSimpleMode: boolean;
  whatsappPassthroughMode: boolean;
  whatsappBrokerStrictConfig: boolean;
  whatsappDebugToolsEnabled: boolean;
} & SharedFeatureFlags;

const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return defaultValue;
};

const computeFlags = (): FeatureFlags => {
  const rawBypass = process.env.MVP_AUTH_BYPASS ?? process.env.AUTH_DISABLE_FOR_MVP;
  const mvpAuthBypass = parseBoolean(rawBypass, false);
  if (mvpAuthBypass) {
    logger.warn('[config] MVP auth bypass habilitado via variável de ambiente');
  }

  const rawUseRealData = process.env.USE_REAL_DATA;
  const useRealData = parseBoolean(rawUseRealData, false);

  const whatsappRawFallbackEnabled = parseBoolean(process.env.WHATSAPP_RAW_FALLBACK_ENABLED, false);
  if (whatsappRawFallbackEnabled) {
    logger.info('[config] WhatsApp raw fallback normalizer habilitado');
  }

  const whatsappInboundSimpleMode = parseBoolean(process.env.WHATSAPP_INBOUND_SIMPLE_MODE, false);
  if (whatsappInboundSimpleMode) {
    logger.warn('[config] WhatsApp inbound mensagens em modo simplificado (sem dedupe/lead sync)');
  }

  const whatsappPassthroughMode = parseBoolean(process.env.WHATSAPP_PASSTHROUGH_MODE, false);
  if (whatsappPassthroughMode) {
    logger.warn(
      '[config] WhatsApp passthrough habilitado (WHATSAPP_PASSTHROUGH_MODE=true) — ingestão sem filtros'
    );
  }

  const whatsappBrokerStrictConfig = parseBoolean(process.env.WHATSAPP_BROKER_STRICT_CONFIG, false);
  if (whatsappBrokerStrictConfig) {
    logger.warn('[config] WhatsApp broker strict config habilitado — bloqueando se faltar URL/API key');
  }

  const whatsappDebugToolsEnabled = parseBoolean(process.env.WHATSAPP_DEBUG_TOOLS_ENABLED, false);
  if (whatsappDebugToolsEnabled) {
    logger.warn('[config] WhatsApp debug tools habilitado — endpoints sensíveis ativos');
  }

  const sharedFlags = resolveSharedFeatureFlags(process.env);
  if (sharedFlags.whatsappDebug) {
    logger.info('[config] WhatsApp debug routes habilitadas (FEATURE_DEBUG_WHATSAPP)');
  }

  return {
    useRealData,
    mvpAuthBypass,
    whatsappRawFallbackEnabled,
    whatsappInboundSimpleMode,
    whatsappPassthroughMode,
    whatsappBrokerStrictConfig,
    whatsappDebugToolsEnabled,
    ...sharedFlags,
  } satisfies FeatureFlags;
};

let cachedFlags: FeatureFlags = computeFlags();

export const getFeatureFlags = (): FeatureFlags => cachedFlags;

export const getUseRealDataFlag = (): boolean => cachedFlags.useRealData;

export const isMvpAuthBypassEnabled = (): boolean => cachedFlags.mvpAuthBypass;

export const isWhatsappRawFallbackEnabled = (): boolean => cachedFlags.whatsappRawFallbackEnabled;

export const isWhatsappInboundSimpleModeEnabled = (): boolean => cachedFlags.whatsappInboundSimpleMode;

export const isWhatsappPassthroughModeEnabled = (): boolean => cachedFlags.whatsappPassthroughMode;

export const isWhatsappBrokerStrictConfigEnabled = (): boolean => cachedFlags.whatsappBrokerStrictConfig;

export const isWhatsappDebugToolsEnabled = (): boolean => cachedFlags.whatsappDebugToolsEnabled;
export const isWhatsappDebugFeatureEnabled = (): boolean => cachedFlags.whatsappDebug;

export const refreshFeatureFlags = (overrides?: Partial<FeatureFlags>): FeatureFlags => {
  const next = { ...computeFlags(), ...overrides } satisfies FeatureFlags;
  const useRealDataChanged = next.useRealData !== cachedFlags.useRealData;
  const mvpAuthBypassChanged = next.mvpAuthBypass !== cachedFlags.mvpAuthBypass;
  const whatsappFallbackChanged = next.whatsappRawFallbackEnabled !== cachedFlags.whatsappRawFallbackEnabled;
  const whatsappSimpleChanged = next.whatsappInboundSimpleMode !== cachedFlags.whatsappInboundSimpleMode;
  const whatsappPassthroughChanged = next.whatsappPassthroughMode !== cachedFlags.whatsappPassthroughMode;
  const whatsappStrictChanged = next.whatsappBrokerStrictConfig !== cachedFlags.whatsappBrokerStrictConfig;
  const whatsappDebugToolsChanged =
    next.whatsappDebugToolsEnabled !== cachedFlags.whatsappDebugToolsEnabled;
  const whatsappDebugFeatureChanged = next.whatsappDebug !== cachedFlags.whatsappDebug;

  if (
    useRealDataChanged ||
    mvpAuthBypassChanged ||
    whatsappFallbackChanged ||
    whatsappSimpleChanged ||
    whatsappPassthroughChanged ||
    whatsappStrictChanged ||
    whatsappDebugToolsChanged ||
    whatsappDebugFeatureChanged
  ) {
    logger.info('[config] Feature flags atualizados', {
      useRealData: next.useRealData,
      mvpAuthBypass: next.mvpAuthBypass,
      whatsappRawFallbackEnabled: next.whatsappRawFallbackEnabled,
      whatsappInboundSimpleMode: next.whatsappInboundSimpleMode,
      whatsappPassthroughMode: next.whatsappPassthroughMode,
      whatsappBrokerStrictConfig: next.whatsappBrokerStrictConfig,
      whatsappDebugToolsEnabled: next.whatsappDebugToolsEnabled,
      whatsappDebug: next.whatsappDebug,
    });
    if (next.mvpAuthBypass) {
      logger.warn('[config] MVP auth bypass habilitado (refresh)');
    }
    if (next.whatsappRawFallbackEnabled && !cachedFlags.whatsappRawFallbackEnabled) {
      logger.info('[config] WhatsApp raw fallback normalizer habilitado (refresh)');
    }
    if (next.whatsappInboundSimpleMode && !cachedFlags.whatsappInboundSimpleMode) {
      logger.warn('[config] WhatsApp inbound simples habilitado (refresh)');
    }
    if (next.whatsappPassthroughMode && !cachedFlags.whatsappPassthroughMode) {
      logger.warn(
        '[config] WhatsApp passthrough habilitado (refresh, WHATSAPP_PASSTHROUGH_MODE=true)'
      );
    }
    if (next.whatsappBrokerStrictConfig && !cachedFlags.whatsappBrokerStrictConfig) {
      logger.warn('[config] WhatsApp broker strict config habilitado (refresh)');
    }
    if (next.whatsappDebugToolsEnabled && !cachedFlags.whatsappDebugToolsEnabled) {
      logger.warn('[config] WhatsApp debug tools habilitado (refresh) — endpoints sensíveis ativos');
    }
    if (next.whatsappDebug && !cachedFlags.whatsappDebug) {
      logger.info('[config] WhatsApp debug routes habilitadas (refresh)');
    }
  }
  cachedFlags = next;
  return cachedFlags;
};

export const getMvpBypassTenantId = (): string | undefined => {
  const tenant = process.env.AUTH_MVP_TENANT_ID?.trim();
  return tenant && tenant.length > 0 ? tenant : undefined;
};
