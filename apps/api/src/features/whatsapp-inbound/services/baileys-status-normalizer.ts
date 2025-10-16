import type { MessageStatus } from '../../../types/tickets';

import { normalizeBrokerStatus } from '../../../services/ticket-service';

const BAILEYS_STATUS_MAP: Record<number, MessageStatus> = {
  0: 'PENDING',
  1: 'SENT',
  2: 'DELIVERED',
  3: 'READ',
  4: 'READ',
};

const normalizeNumericStatus = (status: number): MessageStatus => {
  if (!Number.isFinite(status)) {
    return 'SENT';
  }

  const normalized = Math.trunc(status);
  const mapped = BAILEYS_STATUS_MAP[normalized as keyof typeof BAILEYS_STATUS_MAP];

  if (mapped) {
    return mapped;
  }

  if (normalized < 0) {
    return 'PENDING';
  }

  return 'SENT';
};

export const normalizeBaileysMessageStatus = (status: unknown): MessageStatus => {
  if (typeof status === 'number') {
    return normalizeNumericStatus(status);
  }

  if (typeof status === 'bigint') {
    return normalizeNumericStatus(Number(status));
  }

  if (typeof status === 'string') {
    const trimmed = status.trim();
    if (!trimmed) {
      return 'SENT';
    }

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return normalizeNumericStatus(numeric);
    }

    return normalizeBrokerStatus(trimmed);
  }

  return 'SENT';
};
