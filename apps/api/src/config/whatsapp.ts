import {
  getBrokerApiKey as baseGetBrokerApiKey,
  getBrokerBaseUrl as baseGetBrokerBaseUrl,
  getBrokerTimeoutMs as baseGetBrokerTimeoutMs,
  getBrokerWebhookUrl as baseGetBrokerWebhookUrl,
  getDefaultInstanceId as baseGetDefaultInstanceId,
  getDefaultTenantId as baseGetDefaultTenantId,
  getRawWhatsAppMode as baseGetRawWhatsAppMode,
  getWebhookApiKey as baseGetWebhookApiKey,
  getWebhookReplayUrl as baseGetWebhookReplayUrl,
  getWebhookSignatureSecret as baseGetWebhookSignatureSecret,
  getWebhookVerifyToken as baseGetWebhookVerifyToken,
  getWhatsAppConfig,
  getWhatsAppCorrelationSeed as baseGetWhatsAppCorrelationSeed,
  getWhatsAppMode as baseGetWhatsAppMode,
  isWebhookSignatureRequired as baseIsWebhookSignatureRequired,
  isWhatsAppEventPollerDisabled as baseIsWhatsAppEventPollerDisabled,
  refreshWhatsAppEnv as baseRefreshWhatsAppEnv,
  shouldBypassTenantGuards as baseShouldBypassTenantGuards,
  type WhatsAppTransportMode,
} from '../../../../config/whatsapp';
import { isWhatsappBrokerStrictConfigEnabled } from './feature-flags';

export const getBrokerBaseUrl = (): string | null => baseGetBrokerBaseUrl();

export const getBrokerApiKey = (): string | null => baseGetBrokerApiKey();

export const getBrokerTimeoutMs = (): number => baseGetBrokerTimeoutMs();

export const getBrokerWebhookUrl = (): string => baseGetBrokerWebhookUrl();

export const getDefaultInstanceId = (): string | null => baseGetDefaultInstanceId();

export const getDefaultTenantId = (): string => baseGetDefaultTenantId();

export const getWebhookVerifyToken = (): string | null => baseGetWebhookVerifyToken();

export const getWebhookApiKey = (): string | null => baseGetWebhookApiKey();

export const getWebhookSignatureSecret = (): string | null => baseGetWebhookSignatureSecret();

export const isWebhookSignatureRequired = (): boolean => baseIsWebhookSignatureRequired();

export const shouldBypassTenantGuards = (): boolean => baseShouldBypassTenantGuards();

export const getWhatsAppMode = (): WhatsAppTransportMode => baseGetWhatsAppMode();

export const getWhatsAppCorrelationSeed = (): string => baseGetWhatsAppCorrelationSeed();

export const getRawWhatsAppMode = (): string => baseGetRawWhatsAppMode();

export const isWhatsAppEventPollerDisabled = (): boolean => baseIsWhatsAppEventPollerDisabled();

export const getWebhookReplayUrl = (): string => baseGetWebhookReplayUrl();

export const isStrictBrokerConfigEnabled = (): boolean =>
  (getWhatsAppConfig().broker.strictConfig ?? false) || isWhatsappBrokerStrictConfigEnabled();

export const refreshWhatsAppEnv = () => baseRefreshWhatsAppEnv();

export type { WhatsAppTransportMode };
