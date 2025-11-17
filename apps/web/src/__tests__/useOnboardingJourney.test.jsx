/** @vitest-environment jsdom */
import { renderHook, act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const STORAGE_KEY = 'leadengine_onboarding_v1';

// Import after setup
import useOnboardingJourney from '../features/onboarding/useOnboardingJourney.js';

describe('useOnboardingJourney', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
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

  it('uses the provided current user metadata when available', () => {
    const mockUser = { id: 'user-1', tenantId: 'tenant-abc', name: 'Agent' };
    const { result } = renderHook(() =>
      useOnboardingJourney({ currentUser: mockUser, loadingCurrentUser: false })
    );

    expect(result.current.currentUser).toEqual({ ...mockUser, tenantId: 'tenant-abc' });
    expect(result.current.loadingCurrentUser).toBe(false);
  });
});
