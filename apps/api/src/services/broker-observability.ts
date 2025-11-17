const FAILURE_WINDOW_MS = 5 * 60 * 1000;

type BrokerAttempt = {
  tenantId: string;
  ticketId?: string | null;
  chatId?: string | null;
  instanceId?: string | null;
  requestId?: string | null;
  brokerStatus?: number | null;
  errorCode?: string | null;
  recoveryQueued?: boolean;
};

type BrokerSnapshotEntry = {
  recordedAt: number;
  tenantId: string;
  ticketId: string | null;
  chatId: string | null;
  instanceId: string | null;
  requestId: string | null;
  brokerStatus: number | null;
  errorCode: string | null;
  recoveryQueued: boolean;
};

type BrokerObservabilityState = {
  lastSuccess: BrokerSnapshotEntry | null;
  lastFailure: BrokerSnapshotEntry | null;
  consecutiveFailures: number;
};

const toSnapshotEntry = (attempt: BrokerAttempt): BrokerSnapshotEntry => ({
  recordedAt: Date.now(),
  tenantId: attempt.tenantId,
  ticketId: attempt.ticketId ?? null,
  chatId: attempt.chatId ?? null,
  instanceId: attempt.instanceId ?? null,
  requestId: attempt.requestId ?? null,
  brokerStatus: attempt.brokerStatus ?? null,
  errorCode: attempt.errorCode ?? null,
  recoveryQueued: Boolean(attempt.recoveryQueued),
});

const state: BrokerObservabilityState = {
  lastSuccess: null,
  lastFailure: null,
  consecutiveFailures: 0,
};

export const recordBrokerSuccess = (attempt: BrokerAttempt): void => {
  state.lastSuccess = toSnapshotEntry(attempt);
  state.consecutiveFailures = 0;
};

export const recordBrokerFailure = (attempt: BrokerAttempt): void => {
  const previousFailure = state.lastFailure;
  state.lastFailure = toSnapshotEntry(attempt);
  const lastFailureAge = previousFailure ? Date.now() - previousFailure.recordedAt : Infinity;
  state.consecutiveFailures = lastFailureAge <= FAILURE_WINDOW_MS ? state.consecutiveFailures + 1 : 1;
};

export const getBrokerObservabilitySnapshot = () => {
  const now = Date.now();
  const lastFailureAge = state.lastFailure ? now - state.lastFailure.recordedAt : Infinity;
  const degraded = state.consecutiveFailures >= 3 && lastFailureAge <= FAILURE_WINDOW_MS;

  return {
    lastSuccessAt: state.lastSuccess ? new Date(state.lastSuccess.recordedAt).toISOString() : null,
    lastFailureAt: state.lastFailure ? new Date(state.lastFailure.recordedAt).toISOString() : null,
    consecutiveFailures: state.consecutiveFailures,
    degraded,
    lastError: state.lastFailure
      ? {
          tenantId: state.lastFailure.tenantId,
          ticketId: state.lastFailure.ticketId,
          chatId: state.lastFailure.chatId,
          instanceId: state.lastFailure.instanceId,
          requestId: state.lastFailure.requestId,
          brokerStatus: state.lastFailure.brokerStatus,
          errorCode: state.lastFailure.errorCode,
          recoveryQueued: state.lastFailure.recoveryQueued,
        }
      : null,
  } as const;
};

export type BrokerObservabilitySnapshot = ReturnType<typeof getBrokerObservabilitySnapshot>;

export const __resetBrokerObservability = () => {
  state.lastSuccess = null;
  state.lastFailure = null;
  state.consecutiveFailures = 0;
};
