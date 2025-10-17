/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useInboxAutoRefreshTimer } from '../useInboxAutoRefreshTimer.js';
import { useInboxCountBroadcast } from '../useInboxCountBroadcast.js';
import { useSavedViewPrompt } from '../useSavedViewPrompt.js';
import { useWhatsAppLauncher } from '../useWhatsAppLauncher.js';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}));

describe('lead inbox helper hooks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('counts down automatically with useInboxAutoRefreshTimer', () => {
    const target = Date.now() + 5000;
    const { result, rerender, unmount } = renderHook(
      ({ nextRefreshAt }) => useInboxAutoRefreshTimer(nextRefreshAt),
      { initialProps: { nextRefreshAt: target } }
    );

    expect(result.current).toBe(5);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(3);

    rerender({ nextRefreshAt: null });
    expect(result.current).toBeNull();

    unmount();
  });

  it('broadcasts inbox counts and resets on unmount', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const { rerender, unmount } = renderHook(
      ({ count }) => {
        useInboxCountBroadcast(count);
      },
      { initialProps: { count: 7 } }
    );

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy.mock.calls[0][0]).toBeInstanceOf(CustomEvent);
    expect(dispatchSpy.mock.calls[0][0].detail).toBe(7);

    rerender({ count: 3 });
    expect(dispatchSpy.mock.calls.at(-1)[0].detail).toBe(3);

    unmount();
    expect(dispatchSpy.mock.calls.at(-1)[0].detail).toBe(0);
    dispatchSpy.mockRestore();
  });

  it('uses saved view prompt when saving is allowed', () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Visão VIP');
    const saveCurrentView = vi.fn();
    const selectSavedView = vi.fn();

    const { result } = renderHook(() =>
      useSavedViewPrompt({
        canSaveView: true,
        matchingView: null,
        savedViewsCount: 1,
        saveCurrentView,
        selectSavedView,
      })
    );

    act(() => {
      result.current();
    });

    expect(promptSpy).toHaveBeenCalledWith('Nome da visão', 'Visão 2');
    expect(saveCurrentView).toHaveBeenCalledWith('Visão VIP');
    expect(selectSavedView).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('selects matching view when saving is not allowed', () => {
    const matchingView = { id: 'view-1' };
    const saveCurrentView = vi.fn();
    const selectSavedView = vi.fn();

    const { result } = renderHook(() =>
      useSavedViewPrompt({
        canSaveView: false,
        matchingView,
        savedViewsCount: 2,
        saveCurrentView,
        selectSavedView,
      })
    );

    act(() => {
      result.current();
    });

    expect(saveCurrentView).not.toHaveBeenCalled();
    expect(selectSavedView).toHaveBeenCalledWith(matchingView);
  });

  it('opens WhatsApp when a valid phone is provided', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => undefined);

    const { result } = renderHook(() => useWhatsAppLauncher());

    act(() => {
      result.current.openWhatsAppForAllocation({ phone: '+55 (11) 99999-9999' });
    });

    expect(openSpy).toHaveBeenCalledWith('https://wa.me/5511999999999', '_blank');
    expect(toast.info).not.toHaveBeenCalled();

    openSpy.mockRestore();
  });

  it('shows info toast when no phone is available', () => {
    const { result } = renderHook(() => useWhatsAppLauncher());

    act(() => {
      result.current.openWhatsAppForAllocation({ phone: null });
    });

    expect(toast.info).toHaveBeenCalledWith('Nenhum telefone disponível para este lead.', expect.any(Object));
  });
});
