import { isDatabaseEnabled } from '../../lib/prisma';

interface AgreementsConfig {
  demoModeEnabled: boolean;
}

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

const computeConfig = (): AgreementsConfig => {
  const demoMode = parseBoolean(process.env.AGREEMENTS_DEMO_MODE, !isDatabaseEnabled);
  return { demoModeEnabled: demoMode } satisfies AgreementsConfig;
};

let cachedConfig: AgreementsConfig = computeConfig();

export const getAgreementsConfig = (): AgreementsConfig => cachedConfig;

export const refreshAgreementsConfig = (overrides?: Partial<AgreementsConfig>): AgreementsConfig => {
  cachedConfig = { ...computeConfig(), ...overrides } satisfies AgreementsConfig;
  return cachedConfig;
};
