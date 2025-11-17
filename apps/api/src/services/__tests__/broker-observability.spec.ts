import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  __resetBrokerObservability,
  getBrokerObservabilitySnapshot,
  recordBrokerFailure,
  recordBrokerSuccess,
} from '../broker-observability';

describe('broker observability', () => {
  afterEach(() => {
    __resetBrokerObservability();
    vi.useRealTimers();
  });

  it('marks degraded after multiple failures within the sliding window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00.000Z'));
    recordBrokerFailure({ tenantId: 'tenant-1' });
    vi.setSystemTime(new Date('2024-01-01T10:01:00.000Z'));
    recordBrokerFailure({ tenantId: 'tenant-1' });
    vi.setSystemTime(new Date('2024-01-01T10:02:00.000Z'));
    recordBrokerFailure({ tenantId: 'tenant-1' });

    const snapshot = getBrokerObservabilitySnapshot();
    expect(snapshot.degraded).toBe(true);
    expect(snapshot.consecutiveFailures).toBeGreaterThanOrEqual(3);
    expect(snapshot.lastError?.tenantId).toBe('tenant-1');
  });

  it('resets counters when a success is recorded', () => {
    recordBrokerFailure({ tenantId: 'tenant-1', brokerStatus: 502 });
    recordBrokerSuccess({ tenantId: 'tenant-1', brokerStatus: 200 });
    const snapshot = getBrokerObservabilitySnapshot();
    expect(snapshot.degraded).toBe(false);
    expect(snapshot.consecutiveFailures).toBe(0);
    expect(snapshot.lastSuccessAt).toBeTruthy();
    expect(snapshot.lastFailureAt).toBeTruthy();
  });
});
