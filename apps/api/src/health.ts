import { getWhatsAppMode } from './config/whatsapp';
import type { WhatsAppTransportMode } from './config/whatsapp';

export type HealthPayload = {
  status: 'ok';
  timestamp: string;
  uptime: number;
  environment: string;
  storage: string;
  whatsapp: {
    runtime: {
      status: 'running';
      mode: WhatsAppTransportMode;
      transport: WhatsAppTransportMode;
      disabled: false;
    };
    mode: WhatsAppTransportMode;
    transportMode: WhatsAppTransportMode;
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
  const mode = getWhatsAppMode();
  const runtime: HealthPayload['whatsapp']['runtime'] = {
    status: 'running',
    mode,
    transport: mode,
    disabled: false,
  };

  return {
    status: 'ok',
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
  deriveStorageBackend,
};
