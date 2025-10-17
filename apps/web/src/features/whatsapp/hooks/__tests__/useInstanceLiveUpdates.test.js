/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useInstanceLiveUpdates from '../useInstanceLiveUpdates.js';

const { mockIo, sockets, MockSocket } = vi.hoisted(() => {
  class MockSocket {
    constructor() {
      this.handlers = new Map();
      this.emittedEvents = [];
      this.disconnected = false;
    }

    on(event, handler) {
      const handlers = this.handlers.get(event) ?? [];
      handlers.push(handler);
      this.handlers.set(event, handlers);
    }

    emit(event, payload) {
      this.emittedEvents.push({ event, payload });
      const handlers = this.handlers.get(event);
      handlers?.forEach((handler) => handler(payload));
    }

    trigger(event, payload) {
      const handlers = this.handlers.get(event);
      handlers?.forEach((handler) => handler(payload));
    }

    disconnect() {
      this.disconnected = true;
    }
  }

  const createdSockets = [];
  const ioMock = vi.fn(() => {
    const socket = new MockSocket();
    createdSockets.push(socket);
    return socket;
  });

  return {
    mockIo: ioMock,
    sockets: createdSockets,
    MockSocket,
  };
});

vi.mock('socket.io-client', () => ({
  io: (...args) => mockIo(...args),
}));

vi.mock('@/lib/api.js', () => ({
  API_BASE_URL: 'https://api.example.test',
}));

beforeEach(() => {
  sockets.length = 0;
  mockIo.mockReset();
  mockIo.mockImplementation(() => {
    const socket = new MockSocket();
    sockets.push(socket);
    return socket;
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useInstanceLiveUpdates', () => {
  it('conecta ao socket, ingressa no tenant e encaminha eventos', async () => {
    const onEvent = vi.fn();

    const { result, unmount } = renderHook(() =>
      useInstanceLiveUpdates({ tenantId: 'tenant-123', enabled: true, onEvent })
    );

    await waitFor(() => {
      expect(mockIo).toHaveBeenCalledTimes(1);
    });
    expect(mockIo).toHaveBeenCalledWith('https://api.example.test', expect.any(Object));

    const socket = sockets.at(-1);
    expect(socket).toBeDefined();

    act(() => {
      socket.trigger('connect');
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    expect(socket.emittedEvents).toContainEqual({ event: 'join-tenant', payload: 'tenant-123' });

    const payload = { instanceId: 'inst-1' };
    act(() => {
      socket.trigger('whatsapp.instance.updated', payload);
    });

    expect(onEvent).toHaveBeenCalledWith({ type: 'updated', payload });

    act(() => {
      socket.trigger('disconnect');
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(false);
    });

    unmount();
    expect(socket.disconnected).toBe(true);
  });

  it('reporta mensagens de erro quando a conexão falha imediatamente', async () => {
    const failure = new Error('Falha ao iniciar socket');
    mockIo.mockImplementationOnce(() => {
      throw failure;
    });

    const { result } = renderHook(() =>
      useInstanceLiveUpdates({ tenantId: 'tenant-456', enabled: true })
    );

    await waitFor(() => {
      expect(result.current.connectionError).toBe('Falha ao iniciar socket');
    });
  });

  it('não tenta conectar sem tenant ou quando desabilitado', () => {
    const first = renderHook(() => useInstanceLiveUpdates({ tenantId: null, enabled: true }));
    expect(mockIo).not.toHaveBeenCalled();
    first.unmount();

    mockIo.mockClear();

    const second = renderHook(() => useInstanceLiveUpdates({ tenantId: 'tenant-789', enabled: false }));
    expect(mockIo).not.toHaveBeenCalled();
    second.unmount();
  });
});
