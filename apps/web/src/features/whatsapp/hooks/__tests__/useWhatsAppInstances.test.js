/** @vitest-environment jsdom */

import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useWhatsAppInstances from '../useWhatsAppInstances.js';

vi.mock('../useInstanceLiveUpdates.js', () => ({
  default: vi.fn(() => ({ connected: false })),
}));

vi.mock('../../utils/instances.js', async () => {
  const actual = await vi.importActual('../../utils/instances.js');
  return {
    ...actual,
    readInstancesCache: vi.fn(() => null),
    persistInstancesCache: vi.fn(),
    clearInstancesCache: vi.fn(),
  };
});

vi.mock('@/lib/api.js', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock('@/lib/auth.js', () => ({
  getAuthToken: vi.fn(() => 'token'),
}));

const { apiGet } = await import('@/lib/api.js');

describe('useWhatsAppInstances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('loads and selects preferred instance from list', async () => {
    apiGet.mockResolvedValueOnce({
      instances: [
        { id: 'inst-1', status: 'disconnected', connected: false },
        { id: 'inst-2', status: 'connected', connected: true },
      ],
    });

    const { result } = renderHook(() =>
      useWhatsAppInstances({ status: 'disconnected', logger: { log: vi.fn() } })
    );

    await act(async () => {
      await result.current.loadInstances();
    });

    await waitFor(() => expect(result.current.instances).toHaveLength(2));
    expect(result.current.instance?.id).toBe('inst-2');
  });

  it('reports API errors using friendly resolver', async () => {
    const onError = vi.fn();
    apiGet.mockRejectedValueOnce({
      status: 500,
      payload: { error: { code: 'E500', message: 'Internal' } },
    });

    const { result } = renderHook(() => useWhatsAppInstances({ onError }));

    await expect(
      act(async () => {
        await result.current.loadInstances();
      })
    ).rejects.toBeDefined();

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    const [, meta] = onError.mock.calls[0] ?? [];
    expect(meta?.code).toBe('E500');
  });

  it('reconciles status after connecting an instance', async () => {
    apiGet.mockResolvedValueOnce({
      instances: [{ id: 'inst-1', status: 'disconnected', connected: false }],
    });

    const { result } = renderHook(() => useWhatsAppInstances({}));

    await act(async () => {
      await result.current.loadInstances();
    });

    apiGet.mockResolvedValueOnce({
      instance: { id: 'inst-1', status: 'connected', connected: true },
      status: 'connected',
      connected: true,
    });

    await act(async () => {
      await result.current.connectInstance('inst-1');
    });

    expect(result.current.instance?.status).toBe('connected');
    expect(result.current.localStatus).toBe('connected');
  });
});
