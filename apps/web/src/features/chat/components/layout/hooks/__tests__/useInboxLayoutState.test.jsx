/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useInboxLayoutState from '../useInboxLayoutState.js';
import { CONTEXT_PREFERENCE_KEY } from '../../preferences.ts';

const mockUseMediaQuery = vi.fn();

vi.mock('@/hooks/use-media-query.js', () => ({
  useMediaQuery: (query) => mockUseMediaQuery(query),
}));

const setBreakpoint = ({ desktop = false, tablet = false } = {}) => {
  mockUseMediaQuery.mockImplementation((query) => {
    if (query.includes('1440') || query.includes('1280')) {
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

  it('restaura o painel fixo lembrado (≥1440px) e grava a preferência ao alternar', () => {
    setBreakpoint({ desktop: true });
    window.localStorage.setItem(CONTEXT_PREFERENCE_KEY, 'true');
    const telemetry = vi.fn();

    const { result } = renderHook(() =>
      useInboxLayoutState({ currentUser: { id: 'user-1' }, telemetry }),
    );

    expect(result.current.contextDrawerOpen).toBe(true);
    expect(telemetry).toHaveBeenCalledWith('chat.context.toggle', { open: true });

    act(() => {
      result.current.handleToggleContext();
    });

    expect(result.current.contextDrawerOpen).toBe(false);
    expect(window.localStorage.getItem(CONTEXT_PREFERENCE_KEY)).toBe('false');
    expect(telemetry).toHaveBeenLastCalledWith('chat.context.toggle', { open: false });
  });

  it('abre a folha sobreposta abaixo de 1440px sem herdar a preferência do painel fixo', () => {
    setBreakpoint({ tablet: true });
    window.localStorage.setItem(CONTEXT_PREFERENCE_KEY, 'true');

    const { result } = renderHook(() => useInboxLayoutState({ currentUser: { id: 'user-1' } }));

    expect(result.current.contextDrawerOpen).toBe(false);

    act(() => {
      result.current.handleToggleContext();
    });

    expect(result.current.contextDrawerOpen).toBe(true);
    expect(window.localStorage.getItem(CONTEXT_PREFERENCE_KEY)).toBe('true');
  });

  it('mantém a lista visível ao abrir o painel no desktop e alterna a lista com ⌥L', () => {
    setBreakpoint({ desktop: true });

    const { result } = renderHook(() => useInboxLayoutState({ currentUser: { id: 'user-2' } }));

    act(() => {
      result.current.handleToggleContext();
    });
    expect(result.current.contextDrawerOpen).toBe(true);
    expect(result.current.desktopListVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', code: 'KeyL', altKey: true }));
    });
    expect(result.current.desktopListVisible).toBe(false);
  });

  it('ignora ⌥L enquanto o atendente digita', () => {
    setBreakpoint({ desktop: true });
    const { result } = renderHook(() => useInboxLayoutState({ currentUser: null }));
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    act(() => {
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', code: 'KeyL', altKey: true, bubbles: true }));
    });

    expect(result.current.desktopListVisible).toBe(true);
    textarea.remove();
  });
});
