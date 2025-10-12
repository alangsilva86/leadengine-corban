import { logger } from './logger';

type FeatureFlags = {
  useRealData: boolean;
  mvpAuthBypass: boolean;
  whatsappRawFallbackEnabled: boolean;
  whatsappInboundSimpleMode: boolean;
};

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

  return { useRealData, mvpAuthBypass, whatsappRawFallbackEnabled, whatsappInboundSimpleMode } satisfies FeatureFlags;
};

let cachedFlags: FeatureFlags = computeFlags();

export const getFeatureFlags = (): FeatureFlags => cachedFlags;

export const getUseRealDataFlag = (): boolean => cachedFlags.useRealData;

export const isMvpAuthBypassEnabled = (): boolean => cachedFlags.mvpAuthBypass;

export const isWhatsappRawFallbackEnabled = (): boolean => cachedFlags.whatsappRawFallbackEnabled;

export const isWhatsappInboundSimpleModeEnabled = (): boolean => cachedFlags.whatsappInboundSimpleMode;

export const refreshFeatureFlags = (overrides?: Partial<FeatureFlags>): FeatureFlags => {
  const next = { ...computeFlags(), ...overrides } satisfies FeatureFlags;
  const useRealDataChanged = next.useRealData !== cachedFlags.useRealData;
  const mvpAuthBypassChanged = next.mvpAuthBypass !== cachedFlags.mvpAuthBypass;
  const whatsappFallbackChanged = next.whatsappRawFallbackEnabled !== cachedFlags.whatsappRawFallbackEnabled;
  const whatsappSimpleChanged = next.whatsappInboundSimpleMode !== cachedFlags.whatsappInboundSimpleMode;

  if (useRealDataChanged || mvpAuthBypassChanged || whatsappFallbackChanged || whatsappSimpleChanged) {
    logger.info('[config] Feature flags atualizados', {
      useRealData: next.useRealData,
      mvpAuthBypass: next.mvpAuthBypass,
      whatsappRawFallbackEnabled: next.whatsappRawFallbackEnabled,
      whatsappInboundSimpleMode: next.whatsappInboundSimpleMode,
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
  }
  cachedFlags = next;
  return cachedFlags;
};

export const getMvpBypassTenantId = (): string | undefined => {
  const tenant = process.env.AUTH_MVP_TENANT_ID?.trim();
  return tenant && tenant.length > 0 ? tenant : undefined;
};
