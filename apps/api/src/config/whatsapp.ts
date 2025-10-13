import { getWhatsAppConfig, refreshWhatsAppConfig, type WhatsAppTransportMode } from './whatsapp-config';
import { isWhatsappBrokerStrictConfigEnabled } from './feature-flags';

export const getBrokerBaseUrl = (): string | null => getWhatsAppConfig().broker.baseUrl;

export const getBrokerApiKey = (): string | null => getWhatsAppConfig().broker.apiKey;

export const isStrictBrokerConfigEnabled = (): boolean =>
  getWhatsAppConfig().broker.strictConfig || isWhatsappBrokerStrictConfigEnabled();

export const getDefaultInstanceId = (): string | null => getWhatsAppConfig().defaults.instanceId;

export const getDefaultTenantId = (): string => getWhatsAppConfig().defaults.tenantId;

export const getWebhookVerifyToken = (): string | null => getWhatsAppConfig().webhook.verifyToken;

export const getWebhookApiKey = (): string | null => getWhatsAppConfig().webhook.apiKey;

export const getWebhookSignatureSecret = (): string | null => getWhatsAppConfig().webhook.signatureSecret;

export const isWebhookSignatureRequired = (): boolean => getWhatsAppConfig().webhook.enforceSignature;

export const shouldBypassTenantGuards = (): boolean => getWhatsAppConfig().flags.passthroughMode;

export const getWhatsAppMode = (): WhatsAppTransportMode => getWhatsAppConfig().runtime.mode;

export const getRawWhatsAppMode = (): string => getWhatsAppConfig().runtime.rawMode;

export const isWhatsAppEventPollerDisabled = (): boolean => getWhatsAppConfig().runtime.eventPollerDisabled;

export const refreshWhatsAppEnv = () => refreshWhatsAppConfig();

export type { WhatsAppTransportMode } from './whatsapp-config';
