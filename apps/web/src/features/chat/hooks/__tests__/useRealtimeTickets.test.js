/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ioMock = vi.fn();

vi.mock('socket.io-client', () => ({
  io: ioMock,
}));

describe('useRealtimeTickets', () => {
  let useRealtimeTickets;
  let socketMock;
  let handlers;

  beforeEach(async () => {
    handlers = {};
    socketMock = {
      on: vi.fn((event, handler) => {
        handlers[event] = handler;
        return socketMock;
      }),
      off: vi.fn((event, handler) => {
        const currentHandler = handlers[event];
        if (!handler || currentHandler === handler) {
          delete handlers[event];
        }
        return socketMock;
      }),
      emit: vi.fn(),
      disconnect: vi.fn(),
      connected: true,
      id: 'socket-123',
    };

    ioMock.mockImplementation(() => socketMock);

    vi.resetModules();
    ({ useRealtimeTickets } = await import('../useRealtimeTickets.js'));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("invokes onTyping when receiving a 'ticket:typing' event", async () => {
    const onTyping = vi.fn();

    const { unmount } = renderHook(() =>
      useRealtimeTickets({ enabled: true, tenantId: 'tenant-123', onTyping })
    );

    await waitFor(() => {
      expect(handlers['ticket:typing']).toBeTypeOf('function');
    });

    act(() => {
      handlers['ticket:typing']?.({ typing: true, userId: 'user-456' });
    });

    expect(onTyping).toHaveBeenCalledWith({ typing: true, userId: 'user-456' });

    unmount();
  });

  it('avoids duplicate callbacks when message updates use aliased events', async () => {
    const onMessageUpdated = vi.fn();
    const logSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { unmount } = renderHook(() =>
      useRealtimeTickets({ enabled: true, tenantId: 'tenant-123', onMessageUpdated })
    );

    await waitFor(() => {
      expect(handlers['messages.updated']).toBeTypeOf('function');
      expect(handlers['message:updated']).toBeTypeOf('function');
    });

    const payload = { message: { id: 'msg-123', updatedAt: '2024-05-01T12:00:00Z' } };

    act(() => {
      handlers['messages.updated']?.(payload);
      handlers['message:updated']?.({ ...payload });
    });

    expect(onMessageUpdated).toHaveBeenCalledTimes(1);
    const messageUpdateLogs = logSpy.mock.calls.filter(([message]) =>
      typeof message === 'string' && message.includes('Mensagem atualizada')
    );
    expect(messageUpdateLogs).toHaveLength(1);

    unmount();
    logSpy.mockRestore();
  });
});
