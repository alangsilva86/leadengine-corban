/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/realtime/socket.js', () => ({ emitRealtime: vi.fn() }));

import useTypingIndicator, {
  TYPING_EXPIRY_MS,
  TYPING_IDLE_MS,
  TYPING_THROTTLE_MS,
} from '../useTypingIndicator.js';

describe('useTypingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('receiving teammates presence', () => {
    it('shows teammates typing, ignores the current user (other tabs) and clears on stop', () => {
      const { result } = renderHook(() => useTypingIndicator({ emit: vi.fn(), currentUserId: 'me' }));

      act(() => {
        result.current.registerTypingEvent({ ticketId: 't-1', userId: 'me', userName: 'Eu', state: 'start' });
        result.current.registerTypingEvent({ ticketId: 't-1', userId: 'ana', userName: 'Ana Souza', state: 'start' });
        result.current.registerTypingEvent({ ticketId: 't-2', userId: 'bruno', userName: 'Bruno', mode: 'note' });
      });

      expect(result.current.agentsTyping).toEqual([
        { userId: 'ana', userName: 'Ana Souza', ticketId: 't-1', mode: 'reply' },
        { userId: 'bruno', userName: 'Bruno', ticketId: 't-2', mode: 'note' },
      ]);

      act(() => {
        result.current.registerTypingEvent({ ticketId: 't-1', userId: 'ana', state: 'stop' });
      });

      expect(result.current.agentsTyping.map((agent) => agent.userId)).toEqual(['bruno']);
    });

    it('expires a typing notice ~6 s after the last update', () => {
      const { result } = renderHook(() => useTypingIndicator({ emit: vi.fn(), currentUserId: 'me' }));

      act(() => {
        result.current.registerTypingEvent({ ticketId: 't-1', userId: 'ana', userName: 'Ana' });
      });
      act(() => {
        vi.advanceTimersByTime(TYPING_EXPIRY_MS - 1_000);
        // Ana continua digitando: o aviso é renovado.
        result.current.registerTypingEvent({ ticketId: 't-1', userId: 'ana', userName: 'Ana' });
      });
      act(() => {
        vi.advanceTimersByTime(TYPING_EXPIRY_MS - 1_000);
      });
      expect(result.current.agentsTyping).toHaveLength(1);

      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(result.current.agentsTyping).toEqual([]);
    });

    it('keeps who is viewing each ticket, without the current user', () => {
      const { result } = renderHook(() => useTypingIndicator({ emit: vi.fn(), currentUserId: 'me' }));

      act(() => {
        result.current.registerViewersEvent({
          ticketId: 't-1',
          viewers: [
            { userId: 'me', userName: 'Eu' },
            { userId: 'bruno', userName: 'Bruno' },
          ],
        });
      });

      expect(result.current.viewersByTicket).toEqual({ 't-1': [{ userId: 'bruno', userName: 'Bruno' }] });
    });
  });

  describe('broadcasting the current user typing', () => {
    it('throttles start, renews while typing and sends stop after being idle', () => {
      const emit = vi.fn();
      const { result } = renderHook(() => useTypingIndicator({ emit, currentUserId: 'me' }));

      act(() => {
        result.current.broadcastTyping({ ticketId: 't-1', mode: 'reply' });
        result.current.broadcastTyping({ ticketId: 't-1', mode: 'reply' });
        vi.advanceTimersByTime(TYPING_THROTTLE_MS - 1);
        result.current.broadcastTyping({ ticketId: 't-1', mode: 'reply' });
      });
      expect(emit).toHaveBeenCalledTimes(1);
      expect(emit).toHaveBeenLastCalledWith('ticket:typing', { ticketId: 't-1', state: 'start', mode: 'reply' });

      act(() => {
        vi.advanceTimersByTime(1);
        result.current.broadcastTyping({ ticketId: 't-1', mode: 'reply' });
      });
      expect(emit).toHaveBeenCalledTimes(2);

      act(() => {
        vi.advanceTimersByTime(TYPING_IDLE_MS);
      });
      expect(emit).toHaveBeenCalledTimes(3);
      expect(emit).toHaveBeenLastCalledWith('ticket:typing', { ticketId: 't-1', state: 'stop', mode: 'reply' });
    });

    it('sends stop for the previous ticket when switching conversations, and on explicit stop', () => {
      const emit = vi.fn();
      const { result } = renderHook(() => useTypingIndicator({ emit, currentUserId: 'me' }));

      act(() => {
        result.current.broadcastTyping({ ticketId: 't-1', mode: 'note' });
        result.current.broadcastTyping({ ticketId: 't-2', mode: 'reply' });
        result.current.stopTyping({ ticketId: 't-2' });
        result.current.stopTyping({ ticketId: 't-2' });
      });

      expect(emit.mock.calls).toEqual([
        ['ticket:typing', { ticketId: 't-1', state: 'start', mode: 'note' }],
        ['ticket:typing', { ticketId: 't-1', state: 'stop', mode: 'note' }],
        ['ticket:typing', { ticketId: 't-2', state: 'start', mode: 'reply' }],
        ['ticket:typing', { ticketId: 't-2', state: 'stop', mode: 'reply' }],
      ]);
    });

    it('announces stop when the inbox unmounts mid-typing', () => {
      const emit = vi.fn();
      const { result, unmount } = renderHook(() => useTypingIndicator({ emit, currentUserId: 'me' }));

      act(() => {
        result.current.broadcastTyping({ ticketId: 't-1' });
      });
      unmount();

      expect(emit).toHaveBeenLastCalledWith('ticket:typing', { ticketId: 't-1', state: 'stop', mode: 'reply' });
    });
  });
});
