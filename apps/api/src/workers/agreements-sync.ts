import { randomUUID } from 'node:crypto';

import type { BankProviderId } from '../config/bank-integrations';
import { getBankIntegrationSettings, listBankIntegrationSettings, bankIntegrationClients } from '../services/integrations/banks';
import type { BankIntegrationAgreementRaw, BankIntegrationClient } from '../services/integrations/banks/types';
import {
  agreementsDomainService,
  type AgreementDTO,
  type AgreementSnapshot,
  type RateDTO,
  type TableDTO,
} from '../services/agreements-domain-service';
import { logger } from '../config/logger';
import {
  agreementsSyncDurationSummary,
  agreementsSyncFailureCounter,
  agreementsSyncLastSuccessGauge,
  agreementsSyncRequestCounter,
} from '../lib/metrics';

const LOG_PREFIX = '[AgreementsSync]';

const MAX_FAILURES_BEFORE_CIRCUIT = 3;
const CIRCUIT_OPEN_WINDOW_MS = 5 * 60_000;

type CircuitBreakerState = {
  failures: number;
  openUntil?: number;
};

type ProviderSyncState = 'idle' | 'running' | 'succeeded' | 'failed' | 'skipped';

export interface ProviderSyncStats {
  agreements: number;
  rates: number;
  tables: number;
  durationMs?: number;
  fallback?: boolean;
}

export interface ProviderSyncError {
  message: string;
  code?: string;
  retryAt?: string | null;
}

export interface ProviderSyncStatus {
  providerId: BankProviderId;
  status: ProviderSyncState;
  meta: {
    traceId: string;
    timestamp: string;
  };
  stats?: ProviderSyncStats;
  error?: ProviderSyncError;
  lastSuccessAt?: string | null;
  enabled: boolean;
  deprecated?: boolean;
  sunsetAt?: string | null;
}

export interface AgreementsSyncOptions {
  providerId?: BankProviderId;
  traceId?: string;
  force?: boolean;
}

interface AgreementsSyncDependencies {
  clients: Map<BankProviderId, BankIntegrationClient>;
  now: () => Date;
}

const circuitBreakerStore = new Map<BankProviderId, CircuitBreakerState>();
const statusStore = new Map<BankProviderId, ProviderSyncStatus>();

const defaultDependencies: AgreementsSyncDependencies = {
  clients: bankIntegrationClients,
  now: () => new Date(),
};

const initializeProviderStatuses = () => {
  for (const settings of listBankIntegrationSettings()) {
    if (!statusStore.has(settings.id)) {
      statusStore.set(settings.id, {
        providerId: settings.id,
        status: 'idle',
        meta: {
          traceId: 'bootstrap',
          timestamp: new Date(0).toISOString(),
        },
        enabled: settings.enabled,
        deprecated: settings.deprecated ?? false,
        sunsetAt: settings.sunsetAt ?? null,
        lastSuccessAt: null,
      });
    } else {
      const previous = statusStore.get(settings.id)!;
      statusStore.set(settings.id, {
        ...previous,
        enabled: settings.enabled,
        deprecated: settings.deprecated ?? false,
        sunsetAt: settings.sunsetAt ?? null,
      });
    }
  }
};

initializeProviderStatuses();

const getCircuitState = (providerId: BankProviderId): CircuitBreakerState => {
  const state = circuitBreakerStore.get(providerId) ?? { failures: 0 };
  circuitBreakerStore.set(providerId, state);
  return state;
};

const isCircuitOpen = (providerId: BankProviderId, now: Date): boolean => {
  const state = getCircuitState(providerId);
  if (!state.openUntil) {
    return false;
  }
  if (state.openUntil <= now.getTime()) {
    state.openUntil = undefined;
    state.failures = 0;
    return false;
  }
  return true;
};

const registerFailure = (providerId: BankProviderId, now: Date): void => {
  const state = getCircuitState(providerId);
  state.failures += 1;
  if (state.failures >= MAX_FAILURES_BEFORE_CIRCUIT) {
    state.openUntil = now.getTime() + CIRCUIT_OPEN_WINDOW_MS;
    logger.warn(`${LOG_PREFIX} 🚧 Circuit breaker aberto`, {
      providerId,
      failures: state.failures,
      openUntil: new Date(state.openUntil).toISOString(),
    });
  }
};

const resetCircuit = (providerId: BankProviderId): void => {
  circuitBreakerStore.set(providerId, { failures: 0 });
};

const mergeStatus = (
  providerId: BankProviderId,
  patch: Partial<Omit<ProviderSyncStatus, 'providerId'>>
): ProviderSyncStatus => {
  const current = statusStore.get(providerId);
  const merged: ProviderSyncStatus = {
    providerId,
    status: current?.status ?? 'idle',
    meta: current?.meta ?? { traceId: 'bootstrap', timestamp: new Date(0).toISOString() },
    enabled: current?.enabled ?? false,
    deprecated: current?.deprecated ?? false,
    sunsetAt: current?.sunsetAt ?? null,
    lastSuccessAt: current?.lastSuccessAt ?? null,
    stats: current?.stats,
    error: current?.error,
    ...patch,
  } as ProviderSyncStatus;
  statusStore.set(providerId, merged);
  return merged;
};

const normalizeAgreements = (
  providerId: BankProviderId,
  records: BankIntegrationAgreementRaw[]
): { agreements: AgreementDTO[]; rates: RateDTO[]; tables: TableDTO[] } => {
  const agreements: AgreementDTO[] = [];
  const rates: RateDTO[] = [];
  const tables: TableDTO[] = [];

  for (const record of records) {
    agreements.push({
      providerId,
      externalId: record.agreement.id,
      name: record.agreement.name,
      status: record.agreement.status ?? null,
      updatedAt: record.agreement.updatedAt ?? null,
      metadata: record.agreement.metadata ?? null,
    });

    for (const rate of record.rates) {
      rates.push({
        providerId,
        agreementExternalId: record.agreement.id,
        rateId: rate.id,
        type: rate.type,
        value: rate.value,
        unit: rate.unit ?? null,
        effectiveAt: rate.effectiveAt ?? null,
        expiresAt: rate.expiresAt ?? null,
        metadata: rate.metadata ?? null,
      });
    }

    for (const table of record.tables) {
      tables.push({
        providerId,
        agreementExternalId: record.agreement.id,
        tableId: table.id,
        product: table.product,
        termMonths: table.termMonths,
        coefficient: table.coefficient,
        minValue: table.minValue ?? null,
        maxValue: table.maxValue ?? null,
        metadata: table.metadata ?? null,
      });
    }
  }

  return { agreements, rates, tables };
};

const buildError = (error: unknown): ProviderSyncError => {
  if (error && typeof error === 'object') {
    const err = error as { message?: unknown; code?: unknown; status?: unknown };
    return {
      message: typeof err.message === 'string' && err.message.trim() ? err.message : 'Falha desconhecida na sincronização.',
      code: typeof err.code === 'string' && err.code.trim() ? err.code : undefined,
      retryAt: undefined,
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  return { message: 'Falha desconhecida na sincronização.' };
};

const recordSuccessMetrics = (providerId: BankProviderId, durationMs: number) => {
  agreementsSyncRequestCounter.inc({ providerId, result: 'success' });
  agreementsSyncDurationSummary.observe({ providerId }, durationMs);
  agreementsSyncLastSuccessGauge.set({ providerId }, Date.now());
};

const recordFailureMetrics = (providerId: BankProviderId, error: ProviderSyncError) => {
  agreementsSyncRequestCounter.inc({ providerId, result: 'error' });
  const errorCode = error.code ?? 'unknown';
  agreementsSyncFailureCounter.inc({ providerId, errorCode });
};

const loadSnapshotFallback = async (
  providerId: BankProviderId
): Promise<AgreementSnapshot | null> => agreementsDomainService.loadAgreementSnapshot(providerId);

const resolveClient = (
  providerId: BankProviderId,
  dependencies: AgreementsSyncDependencies
): BankIntegrationClient | undefined => dependencies.clients.get(providerId);

const startSync = (
  providerId: BankProviderId,
  traceId: string,
  settingsEnabled: boolean
): ProviderSyncStatus =>
  mergeStatus(providerId, {
    status: 'running',
    meta: { traceId, timestamp: new Date().toISOString() },
    stats: undefined,
    error: undefined,
    enabled: settingsEnabled,
  });

const finishWithSuccess = (
  providerId: BankProviderId,
  traceId: string,
  stats: ProviderSyncStats,
  enabled: boolean,
  deprecated?: boolean,
  sunsetAt?: string | null
): ProviderSyncStatus =>
  mergeStatus(providerId, {
    status: 'succeeded',
    meta: { traceId, timestamp: new Date().toISOString() },
    stats,
    error: undefined,
    lastSuccessAt: new Date().toISOString(),
    enabled,
    deprecated,
    sunsetAt: sunsetAt ?? null,
  });

const finishWithFailure = (
  providerId: BankProviderId,
  traceId: string,
  error: ProviderSyncError,
  fallbackStats: ProviderSyncStats | undefined,
  enabled: boolean,
  deprecated?: boolean,
  sunsetAt?: string | null
): ProviderSyncStatus =>
  mergeStatus(providerId, {
    status: 'failed',
    meta: { traceId, timestamp: new Date().toISOString() },
    error,
    stats: fallbackStats,
    enabled,
    deprecated,
    sunsetAt: sunsetAt ?? null,
  });

const finishWithSkip = (
  providerId: BankProviderId,
  traceId: string,
  message: string,
  fallbackStats: ProviderSyncStats | undefined,
  enabled: boolean,
  deprecated?: boolean,
  sunsetAt?: string | null
): ProviderSyncStatus =>
  mergeStatus(providerId, {
    status: 'skipped',
    meta: { traceId, timestamp: new Date().toISOString() },
    error: { message },
    stats: fallbackStats,
    enabled,
    deprecated,
    sunsetAt: sunsetAt ?? null,
  });

const ensureTraceId = (input?: string): string => {
  const trimmed = typeof input === 'string' ? input.trim() : '';
  return trimmed || randomUUID();
};

const computeStats = (
  agreements: AgreementDTO[],
  rates: RateDTO[],
  tables: TableDTO[],
  durationMs: number,
  fallback = false
): ProviderSyncStats => ({
  agreements: agreements.length,
  rates: rates.length,
  tables: tables.length,
  durationMs,
  fallback,
});

const runProviderSync = async (
  providerId: BankProviderId,
  traceId: string,
  options: AgreementsSyncOptions,
  dependencies: AgreementsSyncDependencies
): Promise<ProviderSyncStatus> => {
  const settings = getBankIntegrationSettings(providerId);
  if (!settings) {
    throw new Error(`Configuração não encontrada para o provedor ${providerId}`);
  }

  const now = dependencies.now();
  const isOpen = isCircuitOpen(providerId, now);

  if (isOpen && !options.force) {
    const snapshot = await loadSnapshotFallback(providerId);
    const stats = snapshot
      ? computeStats(snapshot.agreements, snapshot.rates, snapshot.tables, 0, true)
      : undefined;
    logger.warn(`${LOG_PREFIX} ⚠️ Circuito aberto — retornando snapshot`, {
      providerId,
      traceId,
    });
    agreementsSyncRequestCounter.inc({ providerId, result: 'skipped' });
    return finishWithSkip(
      providerId,
      traceId,
      'Sincronização ignorada: circuito aberto.',
      stats,
      settings.enabled,
      settings.deprecated,
      settings.sunsetAt ?? null
    );
  }

  if (!settings.enabled) {
    const snapshot = await loadSnapshotFallback(providerId);
    const stats = snapshot
      ? computeStats(snapshot.agreements, snapshot.rates, snapshot.tables, 0, true)
      : undefined;
    agreementsSyncRequestCounter.inc({ providerId, result: 'disabled' });
    return finishWithSkip(
      providerId,
      traceId,
      'Provedor desabilitado.',
      stats,
      settings.enabled,
      settings.deprecated,
      settings.sunsetAt ?? null
    );
  }

  const client = resolveClient(providerId, dependencies);
  if (!client) {
    const snapshot = await loadSnapshotFallback(providerId);
    const stats = snapshot
      ? computeStats(snapshot.agreements, snapshot.rates, snapshot.tables, 0, true)
      : undefined;
    agreementsSyncRequestCounter.inc({ providerId, result: 'error' });
    return finishWithFailure(
      providerId,
      traceId,
      { message: 'Cliente de integração não disponível.' },
      stats,
      settings.enabled,
      settings.deprecated,
      settings.sunsetAt ?? null
    );
  }

  startSync(providerId, traceId, settings.enabled);

  const startedAt = Date.now();

  try {
    const records = await client.fetchAgreements({ traceId });
    const normalized = normalizeAgreements(providerId, records);
    const durationMs = Date.now() - startedAt;

    const snapshot: AgreementSnapshot = {
      providerId,
      agreements: normalized.agreements,
      rates: normalized.rates,
      tables: normalized.tables,
      meta: {
        traceId,
        syncedAt: new Date().toISOString(),
      },
    };

    await agreementsDomainService.saveAgreementSnapshot(snapshot);

    recordSuccessMetrics(providerId, durationMs);
    resetCircuit(providerId);

    const stats = computeStats(normalized.agreements, normalized.rates, normalized.tables, durationMs, false);
    logger.info(`${LOG_PREFIX} ✅ Sincronização concluída`, {
      providerId,
      traceId,
      ...stats,
    });

    return finishWithSuccess(
      providerId,
      traceId,
      stats,
      settings.enabled,
      settings.deprecated,
      settings.sunsetAt ?? null
    );
  } catch (error) {
    const normalizedError = buildError(error);
    const durationMs = Date.now() - startedAt;
    recordFailureMetrics(providerId, normalizedError);
    registerFailure(providerId, dependencies.now());

    const snapshot = await loadSnapshotFallback(providerId);
    const stats = snapshot
      ? computeStats(snapshot.agreements, snapshot.rates, snapshot.tables, durationMs, true)
      : undefined;

    logger.error(`${LOG_PREFIX} ❌ Falha ao sincronizar provedor`, {
      providerId,
      traceId,
      error: normalizedError.message,
      code: normalizedError.code ?? null,
    });

    return finishWithFailure(
      providerId,
      traceId,
      normalizedError,
      stats,
      settings.enabled,
      settings.deprecated,
      settings.sunsetAt ?? null
    );
  }
};

export const runAgreementsSync = async (
  options: AgreementsSyncOptions = {},
  dependencies: Partial<AgreementsSyncDependencies> = {}
): Promise<ProviderSyncStatus[]> => {
  const mergedDependencies: AgreementsSyncDependencies = {
    ...defaultDependencies,
    ...dependencies,
  };

  initializeProviderStatuses();

  const traceId = ensureTraceId(options.traceId);
  const providers = options.providerId
    ? [options.providerId]
    : listBankIntegrationSettings().map((settings) => settings.id);

  const results: ProviderSyncStatus[] = [];

  for (const providerId of providers) {
    try {
      const status = await runProviderSync(providerId, traceId, options, mergedDependencies);
      results.push(status);
    } catch (error) {
      const settings = getBankIntegrationSettings(providerId);
      const normalizedError = buildError(error);
      recordFailureMetrics(providerId, normalizedError);
      registerFailure(providerId, mergedDependencies.now());
      const snapshot = await loadSnapshotFallback(providerId);
      const stats = snapshot
        ? computeStats(snapshot.agreements, snapshot.rates, snapshot.tables, 0, true)
        : undefined;
      const status = finishWithFailure(
        providerId,
        traceId,
        normalizedError,
        stats,
        settings?.enabled ?? false,
        settings?.deprecated,
        settings?.sunsetAt ?? null
      );
      results.push(status);
    }
  }

  return results;
};

export const getProviderStatus = (providerId: BankProviderId): ProviderSyncStatus | undefined =>
  statusStore.get(providerId);

export const listProviderStatuses = (): ProviderSyncStatus[] => {
  initializeProviderStatuses();
  return Array.from(statusStore.values());
};

export const __testing = {
  circuitBreakerStore,
  statusStore,
  initializeProviderStatuses,
  normalizeAgreements,
  buildError,
  ensureTraceId,
  computeStats,
};

