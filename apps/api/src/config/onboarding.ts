import { logger } from './logger';

export type OnboardingConfig = {
  inviteEmailFrom: string;
  inviteSmsSender: string;
  portalBaseUrl: string;
};

const normalize = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
};

const onboardingConfig: OnboardingConfig = {
  inviteEmailFrom: normalize(process.env.ONBOARDING_INVITE_EMAIL_FROM) || 'noreply@example.com',
  inviteSmsSender: normalize(process.env.ONBOARDING_INVITE_SMS_SENDER) || 'Ticketz',
  portalBaseUrl: normalize(process.env.ONBOARDING_PORTAL_BASE_URL) || 'https://leadengine-corban.up.railway.app/onboarding',
};

if (!process.env.ONBOARDING_INVITE_EMAIL_FROM || !process.env.ONBOARDING_PORTAL_BASE_URL) {
  logger.warn('[Onboarding] Variáveis ONBOARDING_INVITE_EMAIL_FROM/ONBOARDING_PORTAL_BASE_URL não definidas. Usando fallback.', {
    inviteEmailFrom: onboardingConfig.inviteEmailFrom,
    portalBaseUrl: onboardingConfig.portalBaseUrl,
  });
}

export const getOnboardingConfig = (): OnboardingConfig => onboardingConfig;
