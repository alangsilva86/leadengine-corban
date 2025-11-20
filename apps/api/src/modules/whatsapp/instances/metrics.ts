import {
  whatsappHttpRequestsCounter,
  whatsappQrRequestCounter,
  whatsappRefreshOutcomeCounter,
} from '../../../lib/metrics';

export type InstanceMetrics = {
  incrementHttpCounter: () => void;
  recordRefreshOutcome: (tenantId: string, outcome: 'success' | 'failure', errorCode?: string | null) => void;
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
    recordQrOutcome,
  } satisfies InstanceMetrics;
};

export const defaultInstanceMetrics = createInstanceMetrics();
export const safeIncrementHttpCounter = defaultInstanceMetrics.incrementHttpCounter;
export const recordRefreshOutcome = defaultInstanceMetrics.recordRefreshOutcome;
export const recordQrOutcome = defaultInstanceMetrics.recordQrOutcome;
