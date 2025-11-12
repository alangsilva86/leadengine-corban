/** @vitest-environment jsdom */
import { renderHook, act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'leadengine_onboarding_v1';

const apiGetMock = vi.fn();
const unsubscribeTokenMock = vi.fn();
const unsubscribeTenantMock = vi.fn();

let tokenCallback;
let tenantCallback;

vi.mock('../lib/api.js', () => ({
  apiGet: (...args) => apiGetMock(...args),
}));

vi.mock('../lib/auth.js', () => ({
  onAuthTokenChange: (callback) => {
    tokenCallback = callback;
    return unsubscribeTokenMock;
  },
  onTenantIdChange: (callback) => {
    tenantCallback = callback;
    return unsubscribeTenantMock;
  },
}));

// Import after mocks are registered
import useOnboardingJourney from '../features/onboarding/useOnboardingJourney.js';

describe('useOnboardingJourney', () => {
  beforeEach(() => {
    tokenCallback = undefined;
    tenantCallback = undefined;
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue({ data: { id: 'user-1', tenantId: 'tenant-1' } });
    unsubscribeTokenMock.mockReset();
    unsubscribeTenantMock.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('restores onboarding state from storage and persists updates', async () => {
    const persistedState = {
      currentPage: 'whatsapp',
      selectedAgreement: { id: 'agreement-1', name: 'Mock Agreement' },
      whatsappStatus: 'connected',
      activeCampaign: { id: 'campaign-1' },
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));

    const { result } = renderHook(() => useOnboardingJourney());

    await waitFor(() =>
      expect(result.current.onboarding.selectedAgreement).toEqual(persistedState.selectedAgreement)
    );

    expect(result.current.safeCurrentPage).toBe('channels');
    expect(result.current.onboarding.whatsappStatus).toBe('connected');
    expect(result.current.computeNextSetupPage()).toBe('inbox');
    expect(result.current.onboarding.stages.map((stage) => stage.id)).toEqual([
      'channels',
      'agreements',
      'campaigns',
      'inbox',
    ]);

    act(() => {
      result.current.handleNavigate('channels');
    });

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      expect(stored.currentPage).toBe('channels');
    });
  });

  it('reloads the current user when auth token or tenant changes', async () => {
    const signals = [];
    apiGetMock.mockImplementation((url, options = {}) => {
      if (url === '/api/auth/me' && options?.signal) {
        signals.push(options.signal);
      }
      return Promise.resolve({ data: { id: 'user-1', tenantId: 'tenant-1' } });
    });

    const { unmount } = renderHook(() => useOnboardingJourney());

    await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith('/api/auth/me', expect.anything()));

    expect(typeof tokenCallback).toBe('function');
    expect(typeof tenantCallback).toBe('function');

    const initialSignal = signals[0];
    expect(initialSignal?.aborted).toBe(false);

    act(() => {
      tokenCallback();
    });

    await waitFor(() => expect(apiGetMock).toHaveBeenCalledTimes(2));
    expect(initialSignal?.aborted).toBe(true);

    const secondSignal = signals[1];
    expect(secondSignal).not.toBe(initialSignal);
    expect(secondSignal?.aborted).toBe(false);

    act(() => {
      tenantCallback();
    });

    await waitFor(() => expect(apiGetMock).toHaveBeenCalledTimes(3));
    expect(secondSignal?.aborted).toBe(true);

    unmount();

    expect(unsubscribeTokenMock).toHaveBeenCalledTimes(1);
    expect(unsubscribeTenantMock).toHaveBeenCalledTimes(1);
  });
});
