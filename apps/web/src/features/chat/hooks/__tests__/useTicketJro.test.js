/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTicketJro } from '../useTicketJro.js';

const HALF_HOUR_IN_MS = 30 * 60 * 1000;

describe('useTicketJro', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('decreases progress as time advances, updates state, and reaches zero when overdue', () => {
    const startedAt = new Date('2024-01-01T00:00:00.000Z');
    const deadline = new Date(startedAt.getTime() + HALF_HOUR_IN_MS);

    vi.setSystemTime(startedAt);

    const ticket = {
      metadata: {
        internalSla: {
          startedAt,
          deadline,
          windowMs: HALF_HOUR_IN_MS,
        },
      },
    };

    const { result } = renderHook(() => useTicketJro(ticket));

    expect(result.current.progress).toBeCloseTo(1, 5);
    expect(result.current.state).toBe('neutral');

    const halfway = new Date(startedAt.getTime() + HALF_HOUR_IN_MS / 2);
    act(() => {
      vi.setSystemTime(halfway);
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.progress).toBeCloseTo(0.5, 2);
    expect(result.current.state).toBe('yellow');

    const nearDeadline = new Date(deadline.getTime() - HALF_HOUR_IN_MS * 0.15);
    act(() => {
      vi.setSystemTime(nearDeadline);
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.state).toBe('orange');

    const overdue = new Date(deadline.getTime() + 5 * 60 * 1000);
    act(() => {
      vi.setSystemTime(overdue);
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.progress).toBe(0);
    expect(result.current.state).toBe('overdue');
  });

  it('derives window duration when only startedAt and deadline are provided', () => {
    const startedAt = new Date('2024-03-01T00:00:00.000Z');
    const deadline = new Date(startedAt.getTime() + HALF_HOUR_IN_MS);

    vi.setSystemTime(startedAt);

    const ticket = {
      metadata: {
        internalSla: {
          startedAt,
          deadline,
        },
      },
    };

    const { result } = renderHook(() => useTicketJro(ticket));
    expect(result.current.progress).toBeCloseTo(1, 5);

    const halfway = new Date(startedAt.getTime() + HALF_HOUR_IN_MS / 2);
    act(() => {
      vi.setSystemTime(halfway);
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.progress).toBeCloseTo(0.5, 2);
  });

  it('handles windowMs provided in minutes', () => {
    const startedAt = new Date('2024-04-01T12:00:00.000Z');
    const deadline = new Date(startedAt.getTime() + 5 * 60 * 1000);

    vi.setSystemTime(startedAt);

    const ticket = {
      metadata: {
        internalSla: {
          startedAt,
          deadline,
          windowMs: 5,
        },
      },
    };

    const { result } = renderHook(() => useTicketJro(ticket));
    expect(result.current.progress).toBeCloseTo(1, 5);

    const halfway = new Date(startedAt.getTime() + 2.5 * 60 * 1000);
    act(() => {
      vi.setSystemTime(halfway);
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.progress).toBeCloseTo(0.5, 2);
  });

  it('uses configured window even when startedAt is missing', () => {
    const deadline = new Date('2024-02-02T00:30:00.000Z');
    const windowLength = HALF_HOUR_IN_MS;

    vi.setSystemTime(new Date('2024-02-02T00:00:00.000Z'));

    const ticket = {
      metadata: {
        internalSla: {
          deadline,
          windowMs: windowLength,
        },
      },
    };

    const { result } = renderHook(() => useTicketJro(ticket));
    expect(result.current.progress).toBeCloseTo(1, 5);
  });

  it('keeps progress empty when deadline is missing or window cannot be derived', () => {
    const baseStartedAt = new Date('2024-02-02T00:00:00.000Z');
    const baseDeadline = new Date(baseStartedAt.getTime() + HALF_HOUR_IN_MS);

    const withoutDeadline = {
      metadata: {
        internalSla: {
          startedAt: baseStartedAt,
          windowMs: HALF_HOUR_IN_MS,
        },
      },
    };

    const { result: missingDeadline } = renderHook(() => useTicketJro(withoutDeadline));
    expect(missingDeadline.current.progress).toBe(0);

    const withoutWindow = {
      metadata: {},
    };

    const { result: missingWindow } = renderHook(() => useTicketJro(withoutWindow));
    expect(missingWindow.current.progress).toBe(0);
  });
});
