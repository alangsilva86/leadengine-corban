import type { Prisma, WhatsAppInstanceStatus } from '@prisma/client';
import type { WhatsAppStatus } from '../../../services/whatsapp-broker-client';

export type InstanceLastError = {
  code?: string | null;
  message?: string | null;
  requestId?: string | null;
  at?: string | null;
};

export type InstanceMetadata = Record<string, unknown> | null | undefined;

export type NormalizedInstance = {
  id: string;
  tenantId: string | null;
  name: string | null;
  status: 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'qr_required' | 'error' | 'pending' | 'failed';
  connected: boolean;
  createdAt: string | null;
  lastActivity: string | null;
  phoneNumber: string | null;
  user: string | null;
  agreementId: string | null;
  stats?: unknown;
  metrics?: Record<string, unknown> | null;
  messages?: Record<string, unknown> | null;
  rate?: Record<string, unknown> | null;
  rawStatus?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  lastError?: InstanceLastError | null;
};

export type StoredInstance = Prisma.WhatsAppInstance;

export type PrismaTransactionClient = Prisma.TransactionClient;

export type InstanceArchiveRecord = {
  deletedAt: string | null;
};

export type NormalizedInstanceStatus = {
  status: NormalizedInstance['status'];
  connected: boolean;
};

export type ReadInstanceArchives = (
  tenantId: string,
  instanceIds: string[]
) => Promise<Map<string, InstanceArchiveRecord>>;

export type MapBrokerStatusToDbStatus = (
  status: WhatsAppStatus | null | undefined
) => WhatsAppInstanceStatus;

