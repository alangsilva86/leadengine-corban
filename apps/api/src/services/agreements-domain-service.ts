import { getIntegrationState, upsertIntegrationState } from '@ticketz/storage';

import type { BankProviderId } from '../config/bank-integrations';
import { logger } from '../config/logger';

const LOG_PREFIX = '[AgreementsDomain]';

const buildSnapshotKey = (providerId: BankProviderId): string => `agreements-sync:${providerId}:snapshot`;

export interface AgreementDTO {
  providerId: BankProviderId;
  externalId: string;
  name: string;
  status: string | null;
  updatedAt: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface RateDTO {
  providerId: BankProviderId;
  agreementExternalId: string;
  rateId: string;
  type: string;
  value: number;
  unit: string | null;
  effectiveAt: string | null;
  expiresAt: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface TableDTO {
  providerId: BankProviderId;
  agreementExternalId: string;
  tableId: string;
  product: string;
  termMonths: number;
  coefficient: number;
  minValue: number | null;
  maxValue: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface AgreementSnapshotMeta {
  traceId: string;
  syncedAt: string;
}

export interface AgreementSnapshot {
  providerId: BankProviderId;
  agreements: AgreementDTO[];
  rates: RateDTO[];
  tables: TableDTO[];
  meta: AgreementSnapshotMeta;
}

const toSnapshot = (payload: unknown): AgreementSnapshot | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const providerId = record.providerId as BankProviderId | undefined;
  if (!providerId) {
    return null;
  }

  return {
    providerId,
    agreements: Array.isArray(record.agreements)
      ? (record.agreements as AgreementDTO[])
      : [],
    rates: Array.isArray(record.rates) ? (record.rates as RateDTO[]) : [],
    tables: Array.isArray(record.tables) ? (record.tables as TableDTO[]) : [],
    meta:
      record.meta && typeof record.meta === 'object'
        ? (record.meta as AgreementSnapshotMeta)
        : { traceId: 'unknown', syncedAt: new Date(0).toISOString() },
  };
};

export const saveAgreementSnapshot = async (snapshot: AgreementSnapshot): Promise<AgreementSnapshot> => {
  const key = buildSnapshotKey(snapshot.providerId);
  await upsertIntegrationState(key, snapshot);
  logger.info(`${LOG_PREFIX} 📦 Snapshot atualizado`, {
    providerId: snapshot.providerId,
    traceId: snapshot.meta.traceId,
    agreements: snapshot.agreements.length,
    rates: snapshot.rates.length,
    tables: snapshot.tables.length,
  });
  return snapshot;
};

export const loadAgreementSnapshot = async (
  providerId: BankProviderId
): Promise<AgreementSnapshot | null> => {
  const key = buildSnapshotKey(providerId);
  const payload = await getIntegrationState(key);
  const snapshot = toSnapshot(payload);
  if (!snapshot) {
    return null;
  }
  return snapshot;
};

export const agreementsDomainService = {
  saveAgreementSnapshot,
  loadAgreementSnapshot,
};

