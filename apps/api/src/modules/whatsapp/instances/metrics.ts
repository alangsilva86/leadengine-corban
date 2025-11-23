import {
  whatsappHttpRequestsCounter,
  whatsappQrRequestCounter,
  whatsappRefreshOutcomeCounter,
  whatsappRefreshStepDurationSummary,
  whatsappRefreshStepFailureCounter,
  whatsappSnapshotCacheOutcomeCounter,
  whatsappDiscardedSnapshotsCounter,
  whatsappInstanceOperationCounter,
  whatsappInstanceOperationDurationSummary,
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
  recordDiscardedSnapshot: (
    tenantId: string,
    reason: 'missing-tenant' | 'mismatched-tenant',
    reportedTenantId: string | null,
    brokerId: string | null
  ) => void;
  recordQrOutcome: (
    tenantId: string,
    instanceId: string | null,
    outcome: 'success' | 'failure',
    errorCode?: string | null
  ) => void;
  recordOperationOutcome: (
    operation: 'collect' | 'create',
    tenantId: string,
    mode: string,
    result: 'success' | 'failure' | 'timeout'
  ) => void;
  recordOperationDuration: (
    operation: 'collect' | 'create',
    tenantId: string,
    mode: string,
    result: 'success' | 'failure' | 'timeout',
    durationMs: number
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
    discardedSnapshots: whatsappDiscardedSnapshotsCounter,
    instanceOperation: whatsappInstanceOperationCounter,
    instanceOperationDuration: whatsappInstanceOperationDurationSummary,
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

  const recordDiscardedSnapshot = (
    tenantId: string,
    reason: 'missing-tenant' | 'mismatched-tenant',
    reportedTenantId: string | null,
    brokerId: string | null
  ): void => {
    try {
      counters.discardedSnapshots.inc({
        tenantId,
        reportedTenantId: reportedTenantId ?? undefined,
        reason,
        brokerId: brokerId ?? undefined,
      });
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

  const recordOperationOutcome = (
    operation: 'collect' | 'create',
    tenantId: string,
    mode: string,
    result: 'success' | 'failure' | 'timeout'
  ): void => {
    try {
      counters.instanceOperation.inc({
        operation,
        tenantId,
        mode: mode || 'unknown',
        result,
      });
    } catch {
      // metrics are best effort
    }
  };

  const recordOperationDuration = (
    operation: 'collect' | 'create',
    tenantId: string,
    mode: string,
    result: 'success' | 'failure' | 'timeout',
    durationMs: number
  ): void => {
    try {
      counters.instanceOperationDuration.observe(
        {
          operation,
          tenantId,
          mode: mode || 'unknown',
          result,
        },
        Math.max(0, Number.isFinite(durationMs) ? durationMs : 0)
      );
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
    recordDiscardedSnapshot,
    recordQrOutcome,
    recordOperationOutcome,
    recordOperationDuration,
  } satisfies InstanceMetrics;
};

export const defaultInstanceMetrics = createInstanceMetrics();
export const safeIncrementHttpCounter = defaultInstanceMetrics.incrementHttpCounter;
export const recordRefreshOutcome = defaultInstanceMetrics.recordRefreshOutcome;
export const recordQrOutcome = defaultInstanceMetrics.recordQrOutcome;
