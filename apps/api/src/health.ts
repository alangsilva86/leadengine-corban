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
      status: 'running' | 'disabled';
      mode: string;
      transport: WhatsAppTransportMode;
      disabled: boolean;
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

const deriveRuntimeInfo = (
  transportMode: WhatsAppTransportMode,
  rawMode: string | null
): HealthPayload['whatsapp']['runtime'] => {
  const normalizedRawMode = (rawMode ?? '').trim();
  const effectiveMode = normalizedRawMode.length > 0 ? normalizedRawMode : transportMode;

  if (transportMode === 'disabled') {
    return {
      status: 'disabled',
      mode: effectiveMode,
      transport: transportMode,
      disabled: true,
    };
  }

  return {
    status: 'running',
    mode: effectiveMode,
    transport: transportMode,
    disabled: false,
  };
};

export const buildHealthPayload = ({ environment }: { environment: string }): HealthPayload => {
  const mode = getWhatsAppMode();
  const rawMode = getRawWhatsAppMode();
  const overallStatus = deriveOverallStatus(mode);
  const runtime = deriveRuntimeInfo(mode, rawMode);

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment,
    storage: deriveStorageBackend(),
    whatsapp: {
      runtime,
      mode: runtime.mode,
      transportMode: mode,
    },
  };
};

export const __private = {
  deriveOverallStatus,
  deriveStorageBackend,
  deriveRuntimeInfo,
};
