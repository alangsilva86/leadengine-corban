/** @vitest-environment jsdom */
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useInstancesAutoRefresh } from '../useInstancesAutoRefresh.js';

const setHidden = (hidden) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
};

describe('useInstancesAutoRefresh', () => {
  let api;
  const baseProps = () => ({ api, autoRefresh: true, pauseWhenHidden: true, sessionActive: true, authDeferred: false });

  beforeEach(() => {
    vi.useFakeTimers();
    api = { loadInstances: vi.fn(() => Promise.resolve()) };
    setHidden(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    setHidden(false);
  });

  it('faz polling a cada 15 s quando o tempo real está desconectado', () => {
    renderHook(() => useInstancesAutoRefresh({ ...baseProps(), realtimeConnected: false }));
    vi.advanceTimersByTime(45_000);
    expect(api.loadInstances).toHaveBeenCalledTimes(3);
    expect(api.loadInstances).toHaveBeenCalledWith({ reason: 'auto' });
  });

  it('continua o polling com o tempo real conectado (status do broker não chega por evento)', () => {
    renderHook(() => useInstancesAutoRefresh({ ...baseProps(), realtimeConnected: true }));
    vi.advanceTimersByTime(60_000);
    expect(api.loadInstances).toHaveBeenCalledTimes(4);
  });

  it('pula os ciclos com a aba oculta', () => {
    setHidden(true);
    renderHook(() => useInstancesAutoRefresh({ ...baseProps(), realtimeConnected: false }));
    vi.advanceTimersByTime(60_000);
    expect(api.loadInstances).not.toHaveBeenCalled();
  });

  it('recarrega ao voltar para a aba', () => {
    setHidden(true);
    renderHook(() => useInstancesAutoRefresh({ ...baseProps(), realtimeConnected: true }));
    setHidden(false);
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(1_000);
    expect(api.loadInstances).toHaveBeenCalledWith({ forceRefresh: true, reason: 'manual' });
  });

  it('recarrega na hora quando o tempo real cai', () => {
    const { rerender } = renderHook((props) => useInstancesAutoRefresh(props), {
      initialProps: { ...baseProps(), realtimeConnected: true },
    });
    expect(api.loadInstances).not.toHaveBeenCalled();
    rerender({ ...baseProps(), realtimeConnected: false });
    expect(api.loadInstances).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(15_000);
    expect(api.loadInstances).toHaveBeenCalledTimes(2);
  });
});
