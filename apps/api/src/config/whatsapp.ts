import { isWhatsappBrokerStrictConfigEnabled } from './feature-flags';

const DEFAULT_TENANT_FALLBACK = 'demo-tenant';

const parseEnvBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
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

export const getBrokerBaseUrl = (): string | null => {
  const value = process.env.WHATSAPP_BROKER_URL?.trim();
  return value && value.length > 0 ? value : null;
};

export const getBrokerApiKey = (): string | null => {
  const value = process.env.WHATSAPP_BROKER_API_KEY?.trim();
  return value && value.length > 0 ? value : null;
};

export const isStrictBrokerConfigEnabled = (): boolean => isWhatsappBrokerStrictConfigEnabled();

export const getDefaultInstanceId = (): string | null => {
  const value = process.env.WHATSAPP_DEFAULT_INSTANCE_ID?.trim();
  return value && value.length > 0 ? value : null;
};

export const getDefaultTenantId = (): string => {
  const value = process.env.AUTH_MVP_TENANT_ID?.trim();
  if (value && value.length > 0) {
    return value;
  }

  return DEFAULT_TENANT_FALLBACK;
};

export const getWebhookVerifyToken = (): string | null => {
  const value = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
  if (value && value.length > 0) {
    return value;
  }

  const fallback = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  return fallback && fallback.length > 0 ? fallback : null;
};

export const getWebhookApiKey = (): string | null => {
  const explicit = process.env.WHATSAPP_WEBHOOK_API_KEY?.trim();
  if (explicit && explicit.length > 0) {
    return explicit;
  }
  return getBrokerApiKey();
};

export const getWebhookSignatureSecret = (): string | null => {
  const explicit = process.env.WHATSAPP_WEBHOOK_SIGNATURE_SECRET?.trim();
  if (explicit && explicit.length > 0) {
    return explicit;
  }

  const fallback = getWebhookApiKey();
  return fallback && fallback.length > 0 ? fallback : null;
};

export const isWebhookSignatureRequired = (): boolean => {
  const raw = process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE;
  return parseEnvBoolean(raw, false);
};

export const shouldBypassTenantGuards = (): boolean => parseEnvBoolean(process.env.WHATSAPP_PASSTHROUGH_MODE, true);
