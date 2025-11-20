import {
  whatsappHttpRequestsCounter,
  whatsappQrRequestCounter,
  whatsappRefreshOutcomeCounter,
  whatsappSnapshotCacheOutcomeCounter,
} from '../../../lib/metrics';

export type InstanceMetrics = {
  incrementHttpCounter: () => void;
  recordRefreshOutcome: (tenantId: string, outcome: 'success' | 'failure', errorCode?: string | null) => void;
  recordSnapshotCacheOutcome: (
    tenantId: string,
    backend: 'memory' | 'redis',
    outcome: 'hit' | 'miss' | 'error'
  ) => void;
  recordQrOutcome: (
    tenantId: string,
    instanceId: string | null,
    outcome: 'success' | 'failure',
    errorCode?: string | null
  ) => void;
};

export const createInstanceMetrics = (
  counters = {
    http: whatsappHttpRequestsCounter,
    qr: whatsappQrRequestCounter,
    refreshOutcome: whatsappRefreshOutcomeCounter,
    snapshotCache: whatsappSnapshotCacheOutcomeCounter,
  }
): InstanceMetrics => {
  const incrementHttpCounter = (): void => {
    try {
      // metrics are best-effort in some environments
      counters.http.inc();
    } catch {
      // ignore metric failures
    }
  };

  const recordRefreshOutcome = (
    tenantId: string,
    outcome: 'success' | 'failure',
    errorCode?: string | null
  ): void => {
    try {
      counters.refreshOutcome.inc({ tenantId, outcome, errorCode: errorCode ?? undefined });
    } catch {
      // metrics are best effort
    }
  };

  const recordSnapshotCacheOutcome = (
    tenantId: string,
    backend: 'memory' | 'redis',
    outcome: 'hit' | 'miss' | 'error'
  ): void => {
    try {
      counters.snapshotCache.inc({ tenantId, backend, outcome });
    } catch {
      // metrics are best effort
    }
  };

  const recordQrOutcome = (
    tenantId: string,
    instanceId: string | null,
    outcome: 'success' | 'failure',
    errorCode?: string | null
  ): void => {
    try {
      counters.qr.inc({
        tenantId,
        instanceId: instanceId ?? undefined,
        outcome,
        errorCode: errorCode ?? undefined,
      });
    } catch {
      // metrics are best effort
    }
  };

  return {
    incrementHttpCounter,
    recordRefreshOutcome,
    recordSnapshotCacheOutcome,
    recordQrOutcome,
  } satisfies InstanceMetrics;
};

export const defaultInstanceMetrics = createInstanceMetrics();
export const safeIncrementHttpCounter = defaultInstanceMetrics.incrementHttpCounter;
export const recordRefreshOutcome = defaultInstanceMetrics.recordRefreshOutcome;
export const recordQrOutcome = defaultInstanceMetrics.recordQrOutcome;
