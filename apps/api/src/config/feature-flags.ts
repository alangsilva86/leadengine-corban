import { logger } from './logger';

type FeatureFlags = {
  useRealData: boolean;
  mvpAuthBypass: boolean;
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
  const mvpAuthBypass = parseBoolean(rawBypass, true);

  const rawUseRealData = process.env.USE_REAL_DATA;
  const useRealData = parseBoolean(rawUseRealData, false);

  return { useRealData, mvpAuthBypass } satisfies FeatureFlags;
};

let cachedFlags: FeatureFlags = computeFlags();

export const getFeatureFlags = (): FeatureFlags => cachedFlags;

export const getUseRealDataFlag = (): boolean => cachedFlags.useRealData;

export const isMvpAuthBypassEnabled = (): boolean => cachedFlags.mvpAuthBypass;

export const refreshFeatureFlags = (overrides?: Partial<FeatureFlags>): FeatureFlags => {
  const next = { ...computeFlags(), ...overrides } satisfies FeatureFlags;
  if (next.useRealData !== cachedFlags.useRealData || next.mvpAuthBypass !== cachedFlags.mvpAuthBypass) {
    logger.info('[config] Feature flags atualizados', {
      useRealData: next.useRealData,
      mvpAuthBypass: next.mvpAuthBypass,
    });
  }
  cachedFlags = next;
  return cachedFlags;
};

export const getMvpBypassTenantId = (): string | undefined => {
  const tenant = process.env.AUTH_MVP_TENANT_ID?.trim();
  return tenant && tenant.length > 0 ? tenant : undefined;
};
