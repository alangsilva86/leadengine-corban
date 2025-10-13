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

type WhatsAppConfig = {
  broker: WhatsAppBrokerConfig;
  webhook: WhatsAppWebhookConfig;
  defaults: WhatsAppDefaultsConfig;
  runtime: WhatsAppRuntimeConfig;
  flags: WhatsAppFeatureFlags;
};

const DEFAULT_TENANT_FALLBACK = 'demo-tenant';

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

const normalizePositiveInteger = (value: string | undefined | null): number | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const DEFAULT_BROKER_TIMEOUT_MS = 15_000;
const DEFAULT_WEBHOOK_URL =
  'https://ticketzapi-production.up.railway.app/api/integrations/whatsapp/webhook';

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

const buildWhatsAppConfig = (): WhatsAppConfig => {
  const mode = parseMode(process.env.WHATSAPP_MODE);

  const timeoutCandidates = [
    process.env.WHATSAPP_BROKER_TIMEOUT_MS,
    process.env.LEAD_ENGINE_TIMEOUT_MS,
  ];

  const timeoutMs = (() => {
    for (const candidate of timeoutCandidates) {
      const normalized = normalizePositiveInteger(candidate);
      if (normalized !== null) {
        return normalized;
      }
    }

    return DEFAULT_BROKER_TIMEOUT_MS;
  })();

  const webhookUrl =
    normalizeString(process.env.WHATSAPP_BROKER_WEBHOOK_URL) ??
    normalizeString(process.env.WHATSAPP_WEBHOOK_URL) ??
    normalizeString(process.env.WEBHOOK_URL) ??
    DEFAULT_WEBHOOK_URL;

  return {
    broker: {
      baseUrl: normalizeString(process.env.WHATSAPP_BROKER_URL),
      apiKey: normalizeString(process.env.WHATSAPP_BROKER_API_KEY),
      strictConfig: normalizeBoolean(process.env.WHATSAPP_BROKER_STRICT_CONFIG, false),
      timeoutMs,
      webhookUrl,
    },
    webhook: {
      verifyToken:
        normalizeString(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) ??
        normalizeString(process.env.WHATSAPP_VERIFY_TOKEN),
      apiKey:
        normalizeString(process.env.WHATSAPP_WEBHOOK_API_KEY) ??
        normalizeString(process.env.WHATSAPP_BROKER_API_KEY),
      signatureSecret:
        normalizeString(process.env.WHATSAPP_WEBHOOK_HMAC_SECRET) ??
        normalizeString(process.env.WHATSAPP_WEBHOOK_SIGNATURE_SECRET) ??
        normalizeString(process.env.WHATSAPP_WEBHOOK_API_KEY) ??
        normalizeString(process.env.WHATSAPP_BROKER_API_KEY),
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

export const __private = {
  buildWhatsAppConfig,
  normalizeBoolean,
  normalizeString,
  parseMode,
  normalizePositiveInteger,
};

export type { WhatsAppConfig };
