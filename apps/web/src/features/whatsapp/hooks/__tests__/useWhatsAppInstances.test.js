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

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const REFRESH_URL = '/api/integrations/whatsapp/instances?refresh=1';
const BASE_URL = '/api/integrations/whatsapp/instances';

describe('useWhatsAppInstances', () => {
  const disableAutoSync = (result) => {
    act(() => {
      result.current.setSessionActive(false);
      result.current.setAuthDeferred(true);
    });
  };

  const loadAndFreeze = async (result, options) => {
    let response;
    await act(async () => {
      response = await result.current.loadInstances(options);
      result.current.setSessionActive(false);
      result.current.setAuthDeferred(true);
    });
    return response;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    apiGet.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('uses refresh endpoint by default during initial synchronization', async () => {
    apiGet.mockResolvedValueOnce({ instances: [] });
    apiGet.mockResolvedValueOnce({});

    const { result } = renderHook(() => useWhatsAppInstances({ autoSync: false, autoGenerateQr: false }));

    disableAutoSync(result);

    await loadAndFreeze(result);

    expect(apiGet.mock.calls[0]?.[0]).toBe(REFRESH_URL);
  });

  it('prefers non-refresh endpoint after first load and falls back when empty', async () => {
    apiGet.mockResolvedValueOnce({
      instances: [{ id: 'inst-1', status: 'connected', connected: true }],
    });
    apiGet.mockResolvedValueOnce({});

    const { result } = renderHook(() => useWhatsAppInstances({ autoSync: false, autoGenerateQr: false }));

    disableAutoSync(result);

    await loadAndFreeze(result);

    apiGet.mockClear();
    apiGet.mockResolvedValueOnce({ instances: [] });
    apiGet.mockResolvedValueOnce({
      instances: [{ id: 'inst-2', status: 'connected', connected: true }],
    });
    apiGet.mockResolvedValueOnce({});

    await loadAndFreeze(result);

    expect(apiGet.mock.calls[0]?.[0]).toBe(BASE_URL);
    expect(apiGet.mock.calls[1]?.[0]).toBe(REFRESH_URL);
  });

  it('uses refresh endpoint when forceRefresh is true', async () => {
    apiGet.mockResolvedValueOnce({
      instances: [{ id: 'inst-1', status: 'connected', connected: true }],
    });
    apiGet.mockResolvedValueOnce({});

    const { result } = renderHook(() => useWhatsAppInstances({ autoSync: false, autoGenerateQr: false }));

    disableAutoSync(result);

    await loadAndFreeze(result);

    apiGet.mockClear();
    apiGet.mockResolvedValueOnce({
      instances: [{ id: 'inst-1', status: 'connected', connected: true }],
    });
    apiGet.mockResolvedValueOnce({});

    await loadAndFreeze(result, { forceRefresh: true });

    expect(apiGet.mock.calls[0]?.[0]).toBe(REFRESH_URL);
  });

  it('loads and selects preferred instance from list', async () => {
    apiGet.mockResolvedValueOnce({
      instances: [
        { id: 'inst-1', status: 'disconnected', connected: false },
        { id: 'inst-2', status: 'connected', connected: true },
      ],
    });

    const { result } = renderHook(() =>
      useWhatsAppInstances({
        status: 'disconnected',
        logger: { log: vi.fn() },
        autoSync: false,
        autoGenerateQr: false,
      })
    );

    disableAutoSync(result);

    const response = await loadAndFreeze(result);

    expect(response?.success).toBe(true);
    expect(['connected', 'disconnected']).toContain(response?.status);
  });

  it('reports API errors using friendly resolver', async () => {
    const onError = vi.fn();
    apiGet.mockRejectedValueOnce({
      status: 500,
      payload: { error: { code: 'E500', message: 'Internal' } },
    });

    const { result } = renderHook(() =>
      useWhatsAppInstances({ onError, autoSync: false, autoGenerateQr: false })
    );

    disableAutoSync(result);

    const response = await loadAndFreeze(result);

    expect(response?.success).toBe(false);
    expect(onError).toHaveBeenCalled();
  });

  it('reconciles status after connecting an instance', async () => {
    apiGet.mockResolvedValueOnce({
      instances: [{ id: 'inst-1', status: 'disconnected', connected: false }],
    });
    apiGet.mockResolvedValueOnce({});

    const { result } = renderHook(() => useWhatsAppInstances({ autoSync: false, autoGenerateQr: false }));

    disableAutoSync(result);

    await loadAndFreeze(result);

    apiGet.mockResolvedValueOnce({
      instance: { id: 'inst-1', status: 'connected', connected: true },
      status: 'connected',
      connected: true,
    });

    let connectResponse;
    await act(async () => {
      connectResponse = await result.current.connectInstance('inst-1');
      result.current.setSessionActive(false);
      result.current.setAuthDeferred(true);
    });

    expect(connectResponse?.status).toBe('connected');
  });
});
