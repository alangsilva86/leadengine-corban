import { randomUUID } from 'node:crypto';

export type WhatsAppTransportMode = 'http' | 'sidecar' | 'dryrun' | 'disabled';

type Booleanish = string | undefined | null;

type WhatsAppBrokerConfig = {
  baseUrl: string | null;
  apiKey: string | null;
  strictConfig: boolean;
  timeoutMs: number;
  webhookUrl: string;
};

type WhatsAppWebhookConfig = {
  verifyToken: string | null;
  apiKey: string | null;
  signatureSecret: string | null;
  enforceSignature: boolean;
};

type WhatsAppDefaultsConfig = {
  instanceId: string | null;
  tenantId: string;
};

type WhatsAppFeatureFlags = {
  passthroughMode: boolean;
};

type WhatsAppRuntimeConfig = {
  mode: WhatsAppTransportMode;
  rawMode: string;
  eventPollerDisabled: boolean;
  correlationSeed: string;
};

type WhatsAppToolsConfig = {
  webhookReplayUrl: string;
};

type WhatsAppConfig = {
  broker: WhatsAppBrokerConfig;
  webhook: WhatsAppWebhookConfig;
  defaults: WhatsAppDefaultsConfig;
  runtime: WhatsAppRuntimeConfig;
  flags: WhatsAppFeatureFlags;
  tools: WhatsAppToolsConfig;
};

const DEFAULT_TENANT_FALLBACK = 'demo-tenant';
const DEFAULT_BROKER_WEBHOOK =
  'https://ticketzapi-production.up.railway.app/api/integrations/whatsapp/webhook';
const DEFAULT_REPLAY_WEBHOOK = 'http://localhost:3000/api/integrations/whatsapp/webhook';
const DEFAULT_TIMEOUT_MS = 15_000;

const normalizeBoolean = (value: Booleanish, fallback: boolean): boolean => {
  if (value === undefined || value === null) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
};

const normalizeString = (value: string | undefined | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeUrl = (value: string | undefined | null): string | null => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  return normalized.replace(/\/+$/, '');
};

const parseMode = (raw: string | undefined | null): { mode: WhatsAppTransportMode; raw: string } => {
  const normalized = normalizeString(raw)?.toLowerCase() ?? '';

  if (normalized === 'sidecar' || normalized === 'baileys') {
    return { mode: 'sidecar', raw: normalized };
  }

  if (normalized === 'dryrun') {
    return { mode: 'dryrun', raw: normalized };
  }

  if (normalized === 'disabled') {
    return { mode: 'disabled', raw: normalized };
  }

  return { mode: 'http', raw: normalized || 'http' };
};

const parsePositiveInteger = (value: string | undefined | null): number | null => {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return null;
};

const resolveBrokerTimeout = (): number => {
  const candidates = [process.env.WHATSAPP_BROKER_TIMEOUT_MS, process.env.LEAD_ENGINE_TIMEOUT_MS];

  for (const candidate of candidates) {
    const resolved = parsePositiveInteger(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return DEFAULT_TIMEOUT_MS;
};

const resolveBrokerWebhookUrl = (): string => {
  const candidates = [
    normalizeString(process.env.WHATSAPP_BROKER_WEBHOOK_URL),
    normalizeString(process.env.WHATSAPP_WEBHOOK_URL),
    normalizeString(process.env.WEBHOOK_URL),
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }

  return DEFAULT_BROKER_WEBHOOK;
};

const resolveWebhookReplayUrl = (brokerWebhookUrl: string): string => {
  return (
    normalizeString(process.env.WHATSAPP_WEBHOOK_REPLAY_URL) ?? brokerWebhookUrl ?? DEFAULT_REPLAY_WEBHOOK
  );
};

const buildWhatsAppConfig = (): WhatsAppConfig => {
  const mode = parseMode(process.env.WHATSAPP_MODE);
  const brokerWebhookUrl = resolveBrokerWebhookUrl();

  return {
    broker: {
      baseUrl:
        normalizeUrl(process.env.WHATSAPP_BROKER_URL) ?? normalizeUrl(process.env.BROKER_BASE_URL),
      apiKey:
        normalizeString(process.env.WHATSAPP_BROKER_API_KEY) ?? normalizeString(process.env.BROKER_API_KEY),
      strictConfig: normalizeBoolean(process.env.WHATSAPP_BROKER_STRICT_CONFIG, false),
      timeoutMs: resolveBrokerTimeout(),
      webhookUrl: brokerWebhookUrl,
    },
    webhook: {
      verifyToken:
        normalizeString(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) ??
        normalizeString(process.env.WHATSAPP_VERIFY_TOKEN),
      apiKey:
        normalizeString(process.env.WHATSAPP_WEBHOOK_API_KEY) ??
        normalizeString(process.env.WHATSAPP_BROKER_API_KEY) ??
        normalizeString(process.env.BROKER_API_KEY),
      signatureSecret:
        normalizeString(process.env.WHATSAPP_WEBHOOK_SIGNATURE_SECRET) ??
        normalizeString(process.env.WHATSAPP_WEBHOOK_API_KEY) ??
        normalizeString(process.env.WHATSAPP_BROKER_API_KEY) ??
        normalizeString(process.env.BROKER_API_KEY),
      enforceSignature: normalizeBoolean(process.env.WHATSAPP_WEBHOOK_ENFORCE_SIGNATURE, false),
    },
    defaults: {
      instanceId: normalizeString(process.env.WHATSAPP_DEFAULT_INSTANCE_ID),
      tenantId: normalizeString(process.env.AUTH_MVP_TENANT_ID) ?? DEFAULT_TENANT_FALLBACK,
    },
    runtime: {
      mode: mode.mode,
      rawMode: mode.raw,
      eventPollerDisabled: normalizeBoolean(process.env.WHATSAPP_EVENT_POLLER_DISABLED, false),
      correlationSeed: normalizeString(process.env.WHATSAPP_CORRELATION_SEED) ?? randomUUID(),
    },
    flags: {
      passthroughMode: normalizeBoolean(process.env.WHATSAPP_PASSTHROUGH_MODE, true),
    },
    tools: {
      webhookReplayUrl: resolveWebhookReplayUrl(brokerWebhookUrl),
    },
  };
};

let cachedConfig: WhatsAppConfig | null = null;

export const getWhatsAppConfig = (): WhatsAppConfig => {
  if (!cachedConfig) {
    cachedConfig = buildWhatsAppConfig();
  }

  return cachedConfig;
};

export const refreshWhatsAppConfig = (): WhatsAppConfig => {
  cachedConfig = buildWhatsAppConfig();
  return cachedConfig;
};

export const getBrokerBaseUrl = (): string | null => getWhatsAppConfig().broker.baseUrl;

export const getBrokerApiKey = (): string | null => getWhatsAppConfig().broker.apiKey;

export const getBrokerTimeoutMs = (): number => getWhatsAppConfig().broker.timeoutMs;

export const getBrokerWebhookUrl = (): string => getWhatsAppConfig().broker.webhookUrl;

export const getDefaultInstanceId = (): string | null => getWhatsAppConfig().defaults.instanceId;

export const getDefaultTenantId = (): string => getWhatsAppConfig().defaults.tenantId;

export const getWebhookVerifyToken = (): string | null => getWhatsAppConfig().webhook.verifyToken;

export const getWebhookApiKey = (): string | null => getWhatsAppConfig().webhook.apiKey;

export const getWebhookSignatureSecret = (): string | null => getWhatsAppConfig().webhook.signatureSecret;

export const isWebhookSignatureRequired = (): boolean => getWhatsAppConfig().webhook.enforceSignature;

export const shouldBypassTenantGuards = (): boolean => getWhatsAppConfig().flags.passthroughMode;

export const getWhatsAppMode = (): WhatsAppTransportMode => getWhatsAppConfig().runtime.mode;

export const getRawWhatsAppMode = (): string => getWhatsAppConfig().runtime.rawMode;

export const isWhatsAppEventPollerDisabled = (): boolean =>
  getWhatsAppConfig().runtime.eventPollerDisabled;

export const getWhatsAppCorrelationSeed = (): string => getWhatsAppConfig().runtime.correlationSeed;

export const getWebhookReplayUrl = (): string => getWhatsAppConfig().tools.webhookReplayUrl;

export const refreshWhatsAppEnv = (): WhatsAppConfig => refreshWhatsAppConfig();

export const __private = {
  buildWhatsAppConfig,
  normalizeBoolean,
  normalizeString,
  normalizeUrl,
  parseMode,
  parsePositiveInteger,
  resolveBrokerTimeout,
  resolveBrokerWebhookUrl,
  resolveWebhookReplayUrl,
};

export type { WhatsAppConfig };
