import { getPollEncryptionConfig } from './config/poll-encryption';
import { getOnboardingConfig } from './config/onboarding';
import { getBrokerBaseUrl, getBrokerTimeoutMs, getBrokerWebhookUrl } from './config/whatsapp';
import { getBrokerObservabilitySnapshot } from './services/broker-observability';
import { getBrokerCircuitBreakerMetrics } from './services/whatsapp-broker-client-protected';

export type HealthPayload = {
  status: 'ok';
  timestamp: string;
  uptime: number;
  environment: string;
  storage: string;
  alerts: {
    insecureFallbacks: string[];
  };
  whatsapp: {
    broker: {
      baseUrl: string | null;
      webhookUrl: string;
      timeoutMs: number;
      circuitBreaker: ReturnType<typeof getBrokerCircuitBreakerMetrics>;
      lastSuccessAt: string | null;
      lastFailureAt: string | null;
      consecutiveFailures: number;
      degraded: boolean;
      lastError: ReturnType<typeof getBrokerObservabilitySnapshot>['lastError'];
    };
  };
};

const deriveStorageBackend = (): string => {
  const storageFlag = (process.env.STORAGE_BACKEND || '').trim().toLowerCase();

  if (storageFlag === 'postgres' || storageFlag === 'postgres/prisma' || storageFlag === 'prisma') {
    return 'postgres/prisma';
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl) {
    if (/^postgres/i.test(databaseUrl)) {
      return 'postgres/prisma';
    }

    return 'database/prisma';
  }

  return 'in-memory';
};

export const buildHealthPayload = ({ environment }: { environment: string }): HealthPayload => {
  const brokerSnapshot = getBrokerObservabilitySnapshot();
  const circuitBreaker = getBrokerCircuitBreakerMetrics();
  const brokerConfig = {
    baseUrl: getBrokerBaseUrl(),
    webhookUrl: getBrokerWebhookUrl(),
    timeoutMs: getBrokerTimeoutMs(),
  };

  const onboardingConfig = getOnboardingConfig();
  const pollEncryption = getPollEncryptionConfig();

  const insecureFallbacks = [] as string[];
  if (onboardingConfig.usingFallbackDefaults) {
    insecureFallbacks.push('onboarding_invite_defaults');
  }
  if (pollEncryption.usingFallbackSource) {
    insecureFallbacks.push('poll_runtime_encryption_fallback');
  }

  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment,
    storage: deriveStorageBackend(),
    alerts: {
      insecureFallbacks,
    },
    whatsapp: {
      broker: {
        baseUrl: brokerConfig.baseUrl,
        webhookUrl: brokerConfig.webhookUrl,
        timeoutMs: brokerConfig.timeoutMs,
        circuitBreaker,
        lastSuccessAt: brokerSnapshot.lastSuccessAt,
        lastFailureAt: brokerSnapshot.lastFailureAt,
        consecutiveFailures: brokerSnapshot.consecutiveFailures,
        degraded: brokerSnapshot.degraded,
        lastError: brokerSnapshot.lastError,
      },
    },
  };
};
