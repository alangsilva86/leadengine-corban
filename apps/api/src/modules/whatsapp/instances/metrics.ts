import {
  whatsappHttpRequestsCounter,
  whatsappQrRequestCounter,
  whatsappRefreshOutcomeCounter,
  whatsappRefreshStepDurationSummary,
  whatsappRefreshStepFailureCounter,
  whatsappSnapshotCacheOutcomeCounter,
} from '../../../lib/metrics';

export type InstanceMetrics = {
  incrementHttpCounter: () => void;
  recordRefreshOutcome: (tenantId: string, outcome: 'success' | 'failure', errorCode?: string | null) => void;
  recordRefreshStepDuration: (
    tenantId: string,
    operation: string,
    durationMs: number,
    outcome: 'success' | 'failure'
  ) => void;
  recordRefreshStepFailure: (tenantId: string, operation: string, errorCode?: string | null) => void;
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
    refreshStepDuration: whatsappRefreshStepDurationSummary,
    refreshStepFailure: whatsappRefreshStepFailureCounter,
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

  const recordRefreshStepDuration = (
    tenantId: string,
    operation: string,
    durationMs: number,
    outcome: 'success' | 'failure'
  ): void => {
    try {
      counters.refreshStepDuration.observe(
        { tenantId, operation, outcome },
        Math.max(0, Number.isFinite(durationMs) ? durationMs : 0)
      );
    } catch {
      // metrics are best effort
    }
  };

  const recordRefreshStepFailure = (tenantId: string, operation: string, errorCode?: string | null): void => {
    try {
      counters.refreshStepFailure.inc({ tenantId, operation, errorCode: errorCode ?? undefined });
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
    recordRefreshStepDuration,
    recordRefreshStepFailure,
    recordSnapshotCacheOutcome,
    recordQrOutcome,
  } satisfies InstanceMetrics;
};

export const defaultInstanceMetrics = createInstanceMetrics();
export const safeIncrementHttpCounter = defaultInstanceMetrics.incrementHttpCounter;
export const recordRefreshOutcome = defaultInstanceMetrics.recordRefreshOutcome;
export const recordQrOutcome = defaultInstanceMetrics.recordQrOutcome;
