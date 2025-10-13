import { getRawWhatsAppMode, getWhatsAppMode } from './config/whatsapp';
import type { WhatsAppTransportMode } from './config/whatsapp';

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
    mode: string;
    transportMode: WhatsAppTransportMode;
  };
};

const deriveOverallStatus = (mode: WhatsAppTransportMode): HealthPayload['status'] =>
  mode === 'disabled' ? 'degraded' : 'ok';

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
  const mode = getWhatsAppMode();
  const rawMode = getRawWhatsAppMode();
  const overallStatus = deriveOverallStatus(mode);

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
      mode: rawMode || mode,
      transportMode: mode,
    },
  };
};

export const __private = {
  deriveOverallStatus,
  deriveStorageBackend,
};
