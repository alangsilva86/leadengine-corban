import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createInstancesStore } from '../instancesStore';
import type { InstancesStoreBundle, InstancesStoreDependencies } from '../instancesStore';

export const makeTestInstancesStore = (
  overrides: Partial<InstancesStoreDependencies> = {},
): InstancesStoreBundle => {
  const deps: InstancesStoreDependencies = {
    readCache: () => null,
    persistCache: () => {},
    clearCache: () => {},
    ...overrides,
  };
  return createInstancesStore(deps);
};

const makeInstance = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: overrides.name ?? `Instance ${id}`,
  status: overrides.status ?? 'connected',
  connected: overrides.connected ?? true,
  tenantId: overrides.tenantId ?? null,
  phoneNumber: overrides.phoneNumber ?? null,
  displayId: overrides.displayId ?? id,
  metadata: overrides.metadata ?? {},
});

describe('instancesStore', () => {
  const persistCache = vi.fn();
  const readCache = vi.fn();
  const clearCache = vi.fn();

  const createStore = () =>
    createInstancesStore({
      readCache,
      persistCache,
      clearCache,
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates from cache when available', () => {
    readCache.mockReturnValue({
      schemaVersion: 2,
      list: [makeInstance('inst-1'), makeInstance('inst-2')],
      currentId: 'inst-2',
      updatedAt: Date.now(),
    });

    const bundle = createStore();
    bundle.store.getState().hydrateFromCache();

    const state = bundle.store.getState();
    expect(state.instances).toHaveLength(2);
    expect(state.currentInstance?.id).toBe('inst-2');
    expect(state.instancesReady).toBe(true);
  });

  it('selects preferred instance when applying load result', () => {
    const bundle = createStore();
    const payload = {
      raw: {},
      data: {},
      instances: [makeInstance('inst-1'), makeInstance('inst-2', { connected: false })],
      instance: makeInstance('inst-2'),
      status: 'connected',
      statusPayload: null,
      connected: true,
      instanceId: 'inst-2',
      qr: null,
    };

    bundle.store.setState({ loadRequestId: 1 });

    bundle.store.getState().applyLoadResult(payload, {
      requestId: 1,
      preferredInstanceId: 'inst-2',
      campaignInstanceId: null,
      forced: false,
    });

    const state = bundle.store.getState();
    expect(state.currentInstance?.id).toBe('inst-2');
    expect(state.status).toBe('connected');
    expect(persistCache).toHaveBeenCalledWith(state.instances, 'inst-2');
  });

  it('resets state on auth fallback reset', () => {
    const bundle = createStore();
    bundle.store.setState({
      instances: [makeInstance('inst-1')],
      currentInstance: makeInstance('inst-1'),
      instancesReady: true,
      sessionActive: true,
      authDeferred: false,
    });

    bundle.store.getState().handleAuthFallback({ reset: true });

    const state = bundle.store.getState();
    expect(state.instances).toHaveLength(0);
    expect(state.currentInstance).toBeNull();
    expect(state.authDeferred).toBe(true);
    expect(clearCache).toHaveBeenCalled();
  });
});
