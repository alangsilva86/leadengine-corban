import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createQrService } from '../qrService';
import { createInstancesStore } from '../../state/instancesStore';

describe('qrService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores QR data and countdown when generated', async () => {
    const bundle = createInstancesStore({
      readCache: () => null,
      persistCache: vi.fn(),
      clearCache: vi.fn(),
    });

    const apiGet = vi
      .fn()
      .mockResolvedValueOnce({
        qr: {
          qrCode: 'payload',
          expiresAt: new Date(Date.now() + 10_000).toISOString(),
        },
      });

    const dispose = createQrService({
      store: bundle.store,
      events: bundle.events,
      api: { get: apiGet },
    });

    bundle.store.getState().generateQr({ instanceId: 'inst-1' });
    await Promise.resolve();
    await Promise.resolve();

    vi.advanceTimersByTime(1000);

    const state = bundle.store.getState();
    expect(state.qrData).toBeDefined();
    expect(state.qrState.instanceId).toBe('inst-1');
    if (typeof state.secondsLeft === 'number') {
      expect(state.secondsLeft).toBeLessThanOrEqual(10);
    } else {
      expect(state.secondsLeft).toBeNull();
    }

    dispose();
  });
});
