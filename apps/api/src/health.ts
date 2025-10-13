import { getRawWhatsAppMode, getWhatsAppMode, isWhatsAppEventPollerDisabled } from './config/whatsapp';
import { getWhatsAppEventPollerMetrics } from './features/whatsapp-inbound/workers/event-poller';
import type { WhatsAppEventPollerMetrics } from './features/whatsapp-inbound/workers/event-poller';

export type HealthPayload = {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  environment: string;
  storage: string;
  whatsapp: {
    runtime: {
      status: 'running' | 'stopped' | 'disabled' | 'inactive' | 'error';
      mode: string;
      transport: string;
      disabled: boolean;
      metrics: WhatsAppEventPollerMetrics;
    };
  };
};

const derivePollerStatus = (
  metrics: WhatsAppEventPollerMetrics,
  { disabled, mode }: { disabled: boolean; mode: string }
): 'running' | 'stopped' | 'disabled' | 'inactive' | 'error' => {
  if (disabled) {
    return 'disabled';
  }

  if (mode !== 'http') {
    return 'inactive';
  }

  if (metrics.running) {
    return 'running';
  }

  if (metrics.consecutiveFailures > 0) {
    return 'error';
  }

  return 'stopped';
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
  const metrics = getWhatsAppEventPollerMetrics();
  const disabled = isWhatsAppEventPollerDisabled();
  const mode = getWhatsAppMode();
  const rawMode = getRawWhatsAppMode();
  const pollerStatus = derivePollerStatus(metrics, { disabled, mode });

  const overallStatus: HealthPayload['status'] = pollerStatus === 'error' ? 'degraded' : 'ok';

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment,
    storage: deriveStorageBackend(),
    whatsapp: {
      runtime: {
        status: pollerStatus,
        mode: rawMode || mode,
        transport: mode,
        disabled,
        metrics,
      },
    },
  };
};

export const __private = {
  derivePollerStatus,
  deriveStorageBackend,
};
