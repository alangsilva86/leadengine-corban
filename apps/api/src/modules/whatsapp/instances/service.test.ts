import { describe, expect, it, vi } from 'vitest';

import { collectInstancesForTenant, type InstanceCollectionDependencies } from './service';
import type { StoredInstance } from './types';

describe('collectInstancesForTenant', () => {
  it('updates stored phone numbers scoped by tenant', async () => {
    const updatePhoneNumber = vi.fn();

    const storedInstance = {
      id: 'instance-1',
      tenantId: 'tenant-1',
      name: 'My instance',
      status: 'connected',
      connected: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      lastSeenAt: null,
      phoneNumber: null,
      metadata: { phoneNumber: '+55 (11) 99999-9999' },
      brokerId: null,
    } as unknown as StoredInstance;

    const dependencies: InstanceCollectionDependencies = {
      repository: {
        findByTenant: vi.fn(),
        updatePhoneNumber,
      } as any,
      cache: {
        getLastSyncAt: vi.fn(),
        invalidateCachedSnapshots: vi.fn(),
        setLastSyncAt: vi.fn(),
        setCachedSnapshots: vi.fn(),
        getCachedSnapshots: vi.fn().mockResolvedValue({
          snapshots: null,
          backend: 'memory',
          hit: false,
          error: null,
        }),
      } as any,
      metrics: {
        recordSnapshotCacheOutcome: vi.fn(),
        recordRefreshStepDuration: vi.fn(),
        recordRefreshStepFailure: vi.fn(),
        incrementHttpCounter: vi.fn(),
        recordRefreshOutcome: vi.fn(),
        recordOperationOutcome: vi.fn(),
        recordOperationDuration: vi.fn(),
      } as any,
      syncInstances: vi.fn(),
      brokerClient: { listInstances: vi.fn() } as any,
    };

    await collectInstancesForTenant('tenant-1', { existing: [storedInstance] }, dependencies);

    expect(updatePhoneNumber).toHaveBeenCalledWith('tenant-1', 'instance-1', '+551199999999');
  });
});
