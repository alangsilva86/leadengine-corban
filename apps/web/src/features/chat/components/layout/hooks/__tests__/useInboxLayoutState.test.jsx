import { act, renderHook, waitFor } from '@testing-library/react';
import useInboxLayoutState from '../useInboxLayoutState.js';
import { CONTEXT_PREFERENCE_KEY } from '../../preferences.ts';

const mockUseMediaQuery = vi.fn();

vi.mock('@/hooks/use-media-query.js', () => ({
  useMediaQuery: (query) => mockUseMediaQuery(query),
}));

const setBreakpoint = ({ desktop = false, tablet = false } = {}) => {
  mockUseMediaQuery.mockImplementation((query) => {
    if (query.includes('1280')) {
      return desktop;
    }
    if (query.includes('1024')) {
      return tablet || desktop;
    }
    return false;
  });
};

describe('useInboxLayoutState', () => {
  beforeEach(() => {
    mockUseMediaQuery.mockReset();
    window.localStorage.clear();
  });

  it('restores persisted context preference and emits telemetry for persistent users', async () => {
    setBreakpoint({ desktop: true });
    window.localStorage.setItem(CONTEXT_PREFERENCE_KEY, 'true');
    const telemetry = vi.fn();

    const { result } = renderHook(() =>
      useInboxLayoutState({
        defaultContextOpen: false,
        contextAvailable: true,
        currentUser: { id: 'user-1' },
        telemetry,
      }),
    );

    expect(result.current.contextDrawerOpen).toBe(true);
    expect(telemetry).toHaveBeenCalledWith('chat.context.toggle', { open: true });

    await act(async () => {
      result.current.handleToggleContext();
      await waitFor(() => {
        expect(result.current.contextDrawerOpen).toBe(false);
      });
    });

    await waitFor(() => {
      expect(window.localStorage.getItem(CONTEXT_PREFERENCE_KEY)).toBe('false');
    });
    expect(telemetry).toHaveBeenLastCalledWith('chat.context.toggle', { open: false });
  });

  it('keeps preferences in memory for guests and toggles mobile sheet with keyboard shortcut', async () => {
    setBreakpoint();
    const telemetry = vi.fn();
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem');

    const { result } = renderHook(() =>
      useInboxLayoutState({
        defaultContextOpen: true,
        contextAvailable: true,
        currentUser: null,
        telemetry,
      }),
    );

    expect(result.current.contextDrawerOpen).toBe(true);
    expect(setItemSpy).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', altKey: true }));
      await waitFor(() => {
        expect(result.current.mobileListOpen).toBe(true);
      });
    });

    expect(telemetry).toHaveBeenCalledWith('chat.context.toggle', { open: true });
    setItemSpy.mockRestore();
  });

  it('closes context when the desktop list is restored', async () => {
    setBreakpoint({ desktop: true });
    const telemetry = vi.fn();

    const { result } = renderHook(() =>
      useInboxLayoutState({
        defaultContextOpen: false,
        contextAvailable: true,
        currentUser: { id: 'user-2' },
        telemetry,
      }),
    );

    expect(result.current.desktopListVisible).toBe(true);

    await act(async () => {
      result.current.handleToggleContext();
      await waitFor(() => {
        expect(result.current.contextDrawerOpen).toBe(true);
      });
    });

    await act(async () => {
      result.current.handleToggleListVisibility();
      await waitFor(() => {
        expect(result.current.desktopListVisible).toBe(true);
        expect(result.current.contextDrawerOpen).toBe(false);
      });
    });

    await waitFor(() => {
      expect(window.localStorage.getItem(CONTEXT_PREFERENCE_KEY)).toBe('false');
    });
    expect(telemetry).toHaveBeenLastCalledWith('chat.context.toggle', { open: false });
  });
});
