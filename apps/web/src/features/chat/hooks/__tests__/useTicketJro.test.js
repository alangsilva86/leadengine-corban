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

  it('decreases progress as time advances and reaches zero when overdue', () => {
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

    const halfway = new Date(startedAt.getTime() + HALF_HOUR_IN_MS / 2);
    act(() => {
      vi.setSystemTime(halfway);
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.progress).toBeCloseTo(0.5, 2);

    const overdue = new Date(deadline.getTime() + 5 * 60 * 1000);
    act(() => {
      vi.setSystemTime(overdue);
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.progress).toBe(0);
  });

  it('keeps progress empty when required data is missing', () => {
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

    const withoutStartedAt = {
      metadata: {
        internalSla: {
          deadline: baseDeadline,
          windowMs: HALF_HOUR_IN_MS,
        },
      },
    };

    const { result: missingStartedAt } = renderHook(() => useTicketJro(withoutStartedAt));
    expect(missingStartedAt.current.progress).toBe(0);

    const withoutWindow = {
      metadata: {
        internalSla: {
          startedAt: baseStartedAt,
          deadline: baseDeadline,
        },
      },
    };

    const { result: missingWindow } = renderHook(() => useTicketJro(withoutWindow));
    expect(missingWindow.current.progress).toBe(0);
  });
});
