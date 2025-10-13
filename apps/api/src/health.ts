import type { WhatsAppTransportMode } from './config/whatsapp';

export type HealthPayload = {
  status: 'ok' | 'degraded';
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

const WHATSAPP_TRANSPORT_MODE: WhatsAppTransportMode = 'http';

const WHATSAPP_RUNTIME: HealthPayload['whatsapp']['runtime'] = {
  status: 'running',
  mode: WHATSAPP_TRANSPORT_MODE,
  transport: WHATSAPP_TRANSPORT_MODE,
  disabled: false,
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
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment,
    storage: deriveStorageBackend(),
    whatsapp: {
      runtime: WHATSAPP_RUNTIME,
      mode: WHATSAPP_TRANSPORT_MODE,
      transportMode: WHATSAPP_TRANSPORT_MODE,
    },
  };
};

export const __private = {
  deriveStorageBackend,
};
