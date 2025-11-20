import { WhatsAppInstanceStatus } from '@prisma/client';
import { normalizeWhatsAppStatus, WHATSAPP_STATUS, type WhatsAppStatusValue } from '@leadengine/wa-status';
import type { WhatsAppStatus } from '../../../services/whatsapp-broker-client';
import type { NormalizedInstance } from './types';

export const mapDbStatusToNormalized = (status: WhatsAppInstanceStatus): NormalizedInstance['status'] => {
  return normalizeWhatsAppStatus({ status }).status;
};

export const mapNormalizedStatusToDbStatus = (
  status: WhatsAppStatusValue,
): WhatsAppInstanceStatus => {
  switch (status) {
    case WHATSAPP_STATUS.CONNECTED:
      return 'connected';
    case WHATSAPP_STATUS.CONNECTING:
    case WHATSAPP_STATUS.RECONNECTING:
    case WHATSAPP_STATUS.QR_REQUIRED:
      return 'connecting';
    case WHATSAPP_STATUS.PENDING:
      return 'pending';
    case WHATSAPP_STATUS.FAILED:
      return 'failed';
    case WHATSAPP_STATUS.ERROR:
      return 'error';
    default:
      return 'disconnected';
  }
};

const resolveDbStatusFromRaw = (
  status: string | null | undefined,
  connected: boolean | null | undefined,
): WhatsAppInstanceStatus => {
  const normalized = normalizeWhatsAppStatus({ status, connected });
  return mapNormalizedStatusToDbStatus(normalized.status);
};

export const mapBrokerStatusToDbStatus = (
  status: WhatsAppStatus | null | undefined,
): WhatsAppInstanceStatus => {
  if (!status) {
    return resolveDbStatusFromRaw(null, null);
  }

  return resolveDbStatusFromRaw(status.status, status.connected);
};

export const mapBrokerInstanceStatusToDbStatus = (
  status: string | null | undefined,
): WhatsAppInstanceStatus => {
  return resolveDbStatusFromRaw(status, null);
};
