import { logger } from './logger';

export type OnboardingConfig = {
  inviteEmailFrom: string;
  inviteSmsSender: string;
  portalBaseUrl: string;
  usingFallbackDefaults: boolean;
};

const normalize = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
};

const DEFAULT_INVITE_EMAIL_FROM = 'onboarding@example.com';
const DEFAULT_PORTAL_BASE_URL = 'http://localhost:4173/onboarding';

const resolvedInviteEmailFrom = normalize(process.env.ONBOARDING_INVITE_EMAIL_FROM);
const resolvedPortalBaseUrl = normalize(process.env.ONBOARDING_PORTAL_BASE_URL);

const onboardingConfig: OnboardingConfig = {
  inviteEmailFrom: resolvedInviteEmailFrom || DEFAULT_INVITE_EMAIL_FROM,
  inviteSmsSender: normalize(process.env.ONBOARDING_INVITE_SMS_SENDER) || 'Ticketz',
  portalBaseUrl: resolvedPortalBaseUrl || DEFAULT_PORTAL_BASE_URL,
  usingFallbackDefaults: !resolvedInviteEmailFrom || !resolvedPortalBaseUrl,
};

if (!process.env.ONBOARDING_INVITE_EMAIL_FROM || !process.env.ONBOARDING_PORTAL_BASE_URL) {
  logger.warn('[Onboarding] Variáveis ONBOARDING_INVITE_EMAIL_FROM/ONBOARDING_PORTAL_BASE_URL não definidas. Usando fallback.', {
    inviteEmailFrom: onboardingConfig.inviteEmailFrom,
    portalBaseUrl: onboardingConfig.portalBaseUrl,
  });
}

export const getOnboardingConfig = (): OnboardingConfig => onboardingConfig;
