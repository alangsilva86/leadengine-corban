/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { ioMock, sockets, auth } = vi.hoisted(() => {
  class FakeSocket {
    constructor() {
      this.handlers = new Map();
      this.sent = [];
      this.connected = false;
      this.active = true;
      this.connectCalls = 0;
      this.disconnectCalls = 0;
      const managerHandlers = new Map();
      this.io = {
        on: (event, handler) => managerHandlers.set(event, handler),
        off: (event) => managerHandlers.delete(event),
        trigger: (event, payload) => managerHandlers.get(event)?.(payload),
      };
    }

    on(event, handler) {
      const list = this.handlers.get(event) ?? [];
      list.push(handler);
      this.handlers.set(event, list);
      return this;
    }

    off(event, handler) {
      const list = this.handlers.get(event) ?? [];
      this.handlers.set(
        event,
        list.filter((candidate) => candidate !== handler)
      );
      return this;
    }

    listenerCount(event) {
      return (this.handlers.get(event) ?? []).length;
    }

    /** Servidor → cliente. */
    trigger(event, ...args) {
      [...(this.handlers.get(event) ?? [])].forEach((handler) => handler(...args));
    }

    /** Cliente → servidor. */
    emit(event, payload) {
      this.sent.push([event, payload]);
      return this;
    }

    connect() {
      this.connectCalls += 1;
      this.connected = true;
      this.active = true;
      this.trigger('connect');
      return this;
    }

    disconnect() {
      this.disconnectCalls += 1;
      const wasConnected = this.connected;
      this.connected = false;
      if (wasConnected) this.trigger('disconnect', 'io client disconnect');
      return this;
    }
  }

  const created = [];
  const io = vi.fn(() => {
    const socket = new FakeSocket();
    created.push(socket);
    return socket;
  });

  const authState = {
    token: 'token-1',
    tenant: 'tenant-1',
    sub: 'user-1',
    tokenListeners: new Set(),
    tenantListeners: new Set(),
  };

  return { ioMock: io, sockets: created, auth: authState };
});

vi.mock('socket.io-client', () => ({ io: (...args) => ioMock(...args) }));

vi.mock('@/lib/api.js', () => ({ API_BASE_URL: 'https://api.example.test' }));

vi.mock('@/lib/auth.js', () => ({
  getAuthToken: () => auth.token,
  getAuthPayload: () => ({ sub: auth.sub }),
  getTenantId: () => auth.tenant,
  onAuthTokenChange: (callback) => {
    auth.tokenListeners.add(callback);
    callback(auth.token);
    return () => auth.tokenListeners.delete(callback);
  },
  onTenantIdChange: (callback) => {
    auth.tenantListeners.add(callback);
    callback(auth.tenant);
    return () => auth.tenantListeners.delete(callback);
  },
}));

import {
  acquireRealtime,
  emitRealtime,
  getRealtimeState,
  joinRealtimeRoom,
  resetRealtimeForTests,
  resolveEventFingerprint,
  subscribeRealtimeEvent,
} from '../socket.js';
import { useRealtimeConnection } from '../useRealtime.js';
import useRealtimeTickets from '@/features/chat/hooks/useRealtimeTickets.js';
import useContactsLiveUpdates from '@/features/contacts/hooks/useContactsLiveUpdates.js';
import useInstanceLiveUpdates from '@/features/whatsapp/hooks/useInstanceLiveUpdates.js';

const flushImport = () => waitFor(() => expect(ioMock).toHaveBeenCalled());
const lastSocket = () => sockets.at(-1);

const setToken = (token) => {
  auth.token = token;
  auth.tokenListeners.forEach((listener) => listener(token));
};

beforeEach(() => {
  sockets.length = 0;
  ioMock.mockClear();
  auth.token = 'token-1';
  auth.tenant = 'tenant-1';
  auth.sub = 'user-1';
});

afterEach(() => {
  vi.useRealTimers();
  act(() => resetRealtimeForTests());
});

describe('conexão de tempo real compartilhada', () => {
  it('abre uma única conexão para vários consumidores e um listener por evento', async () => {
    const releases = [acquireRealtime(), acquireRealtime(), acquireRealtime()];
    const first = vi.fn();
    const second = vi.fn();
    subscribeRealtimeEvent('tickets.updated', first);
    subscribeRealtimeEvent(['tickets.updated', 'messages.new'], second);

    await flushImport();
    const socket = lastSocket();

    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(ioMock).toHaveBeenCalledWith(
      'https://api.example.test',
      expect.objectContaining({ path: '/socket.io', autoConnect: false, auth: expect.any(Function) })
    );
    expect(socket.connected).toBe(true);
    expect(getRealtimeState()).toMatchObject({ status: 'connected', connected: true });
    expect(socket.listenerCount('tickets.updated')).toBe(1);

    const payload = { ticketId: 't-1', ticketUpdatedAt: '2026-01-01T00:00:00.000Z' };
    socket.trigger('tickets.updated', payload);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith(payload, 'tickets.updated');
    releases.forEach((release) => release());
  });

  it('lê o token atual a cada handshake', async () => {
    const release = acquireRealtime();
    await flushImport();
    const { auth: authOption } = ioMock.mock.calls[0][1];

    auth.token = 'token-2';
    const callback = vi.fn();
    authOption(callback);

    expect(callback).toHaveBeenCalledWith({ token: 'token-2' });
    release();
  });

  it('só fecha depois que o último consumidor sai, com folga para trocas de página', async () => {
    const releaseA = acquireRealtime();
    const releaseB = acquireRealtime();
    await flushImport();
    const socket = lastSocket();
    vi.useFakeTimers();

    releaseA();
    releaseA(); // idempotente
    vi.advanceTimersByTime(5_000);
    expect(socket.disconnectCalls).toBe(0);

    releaseB();
    vi.advanceTimersByTime(1_000);
    const releaseC = acquireRealtime(); // nova página montou dentro da folga
    vi.advanceTimersByTime(5_000);
    expect(socket.disconnectCalls).toBe(0);
    expect(ioMock).toHaveBeenCalledTimes(1);

    releaseC();
    vi.advanceTimersByTime(2_000);
    expect(socket.disconnectCalls).toBe(1);
    expect(getRealtimeState()).toMatchObject({ status: 'idle', connected: false });
  });

  it('descarta cópias do mesmo evento e entrega versões novas', async () => {
    const release = acquireRealtime();
    const handler = vi.fn();
    subscribeRealtimeEvent('tickets.updated', handler);
    await flushImport();
    const socket = lastSocket();

    const payload = { ticketId: 't-1', ticketUpdatedAt: '2026-01-01T00:00:00.000Z', ticketStage: 'NOVO' };
    socket.trigger('tickets.updated', payload);
    socket.trigger('tickets.updated', { ...payload });
    socket.trigger('tickets.updated', { ...payload, ticketUpdatedAt: '2026-01-01T00:00:01.000Z' });
    socket.trigger('tickets.updated', { ticketId: 't-1' }); // sem versão: sempre entrega
    socket.trigger('tickets.updated', { ticketId: 't-1' });

    expect(handler).toHaveBeenCalledTimes(4);
    release();
  });

  it('calcula a impressão digital a partir de eventId ou de identidade + versão', () => {
    expect(resolveEventFingerprint({ eventId: 'evt-1' })).toBe('evt-1');
    expect(resolveEventFingerprint({ message: { id: 'm-1', updatedAt: 'v1', status: 'SENT' } })).toBe(
      'm-1|m-1|v1|SENT|'
    );
    expect(resolveEventFingerprint({ ticketId: 't-1' })).toBeNull();
    expect(resolveEventFingerprint(null)).toBeNull();
  });

  it('entra nas salas com ref-count e reentra ao reconectar', async () => {
    const release = acquireRealtime();
    const leaveA = joinRealtimeRoom('ticket', 't-1');
    const leaveB = joinRealtimeRoom('ticket', 't-1');
    await flushImport();
    const socket = lastSocket();

    expect(socket.sent).toEqual([['join-ticket', 't-1']]);

    socket.connected = false;
    socket.trigger('disconnect', 'transport close');
    expect(getRealtimeState().status).toBe('reconnecting');
    socket.connect();
    expect(socket.sent.filter(([event]) => event === 'join-ticket')).toHaveLength(2);

    leaveA();
    expect(socket.sent.some(([event]) => event === 'leave-ticket')).toBe(false);
    leaveB();
    expect(socket.sent.at(-1)).toEqual(['leave-ticket', 't-1']);
    release();
  });

  it('reconecta com backoff quando o servidor encerra a sessão', async () => {
    const release = acquireRealtime();
    await flushImport();
    const socket = lastSocket();
    vi.useFakeTimers();

    socket.connected = false;
    socket.trigger('disconnect', 'io server disconnect');
    expect(getRealtimeState().status).toBe('reconnecting');
    expect(socket.connectCalls).toBe(1);

    vi.advanceTimersByTime(2_000);
    expect(socket.connectCalls).toBe(2);
    expect(getRealtimeState().status).toBe('connected');
    release();
  });

  it('marca offline quando o Manager desiste e volta com "Tentar agora"', async () => {
    const release = acquireRealtime();
    await flushImport();
    const socket = lastSocket();

    socket.connected = false;
    socket.trigger('disconnect', 'transport close');
    socket.io.trigger('reconnect_failed');
    expect(getRealtimeState()).toMatchObject({ status: 'offline', connected: false });

    const { result } = renderHook(() => useRealtimeConnection());
    act(() => result.current.reconnect());
    expect(result.current).toMatchObject({ status: 'connected', connected: true, error: null });
    release();
  });

  it('desconecta sem token e reconecta quando a sessão volta', async () => {
    const release = acquireRealtime();
    await flushImport();
    const socket = lastSocket();

    act(() => setToken(null));
    expect(socket.connected).toBe(false);
    expect(getRealtimeState().status).toBe('idle');

    act(() => setToken('token-renovado'));
    expect(socket.connected).toBe(true);
    expect(socket.connectCalls).toBe(2);
    release();
  });

  it('mantém a conexão quando o token é renovado para a mesma sessão e refaz o handshake na troca de tenant', async () => {
    const release = acquireRealtime();
    await flushImport();
    const socket = lastSocket();

    act(() => setToken('token-renovado'));
    expect(socket.disconnectCalls).toBe(0);

    auth.tenant = 'tenant-2';
    act(() => auth.tenantListeners.forEach((listener) => listener('tenant-2')));
    expect(socket.disconnectCalls).toBe(1);
    expect(socket.connectCalls).toBe(2);
    expect(getRealtimeState().status).toBe('connected');
    release();
  });

  it('expõe a falha ao criar o socket como estado offline', async () => {
    ioMock.mockImplementationOnce(() => {
      throw new Error('Falha ao iniciar socket');
    });
    const release = acquireRealtime();

    await waitFor(() => expect(getRealtimeState().status).toBe('offline'));
    expect(getRealtimeState().error).toBe('Falha ao iniciar socket');
    release();
  });

  it('só envia eventos ao servidor quando conectado', async () => {
    expect(emitRealtime('ticket:typing', { ticketId: 't-1' })).toBe(false);
    const release = acquireRealtime();
    await flushImport();

    expect(emitRealtime('ticket:typing', { ticketId: 't-1' })).toBe(true);
    expect(lastSocket().sent).toContainEqual(['ticket:typing', { ticketId: 't-1' }]);
    release();
  });
});

describe('hooks de tempo real sobre a conexão compartilhada', () => {
  it('Inbox + contatos + instâncias do WhatsApp usam um único socket', async () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children);
    const onTicketUpdated = vi.fn();
    const onInstanceEvent = vi.fn();

    const { result, unmount } = renderHook(
      () => {
        const tickets = useRealtimeTickets({ tenantId: 'tenant-1', ticketId: 't-1', onTicketUpdated });
        useContactsLiveUpdates({ contactId: 'c-1' });
        const instances = useInstanceLiveUpdates({ tenantId: 'tenant-1', onEvent: onInstanceEvent });
        return { tickets, instances };
      },
      { wrapper }
    );

    await flushImport();
    await waitFor(() => expect(result.current.tickets.connected).toBe(true));
    const socket = lastSocket();

    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(result.current.instances.connected).toBe(true);
    expect(socket.sent).toEqual(
      expect.arrayContaining([
        ['join-ticket', 't-1'],
        ['join-contact', 'c-1'],
      ])
    );
    // Salas do tenant/usuário vêm da sessão no servidor: nada de join-tenant/join-user.
    expect(socket.sent.some(([event]) => event === 'join-tenant' || event === 'join-user')).toBe(false);

    const envelope = { ticketId: 't-1', ticketUpdatedAt: '2026-01-01T00:00:00.000Z', ticketStage: 'NOVO' };
    act(() => {
      socket.trigger('tickets.updated', envelope);
      socket.trigger('tickets.updated', envelope);
      socket.trigger('whatsapp.instance.updated', { instanceId: 'i-1' });
    });

    expect(onTicketUpdated).toHaveBeenCalledTimes(1);
    expect(onInstanceEvent).toHaveBeenCalledWith({ type: 'updated', payload: { instanceId: 'i-1' } });

    unmount();
    expect(socket.sent).toEqual(expect.arrayContaining([['leave-ticket', 't-1'], ['leave-contact', 'c-1']]));
  });

  it('não conecta sem tenant ou quando desabilitado', () => {
    const first = renderHook(() => useInstanceLiveUpdates({ tenantId: null, enabled: true }));
    const second = renderHook(() => useRealtimeTickets({ tenantId: 'tenant-1', enabled: false }));

    expect(ioMock).not.toHaveBeenCalled();
    expect(first.result.current.connected).toBe(false);
    expect(second.result.current.status).toBe('idle');
    first.unmount();
    second.unmount();
  });

  it('não reassina eventos quando os callbacks mudam a cada render', async () => {
    const { rerender } = renderHook(({ cb }) => useRealtimeTickets({ tenantId: 'tenant-1', onTicketUpdated: cb }), {
      initialProps: { cb: vi.fn() },
    });
    await flushImport();
    const socket = lastSocket();
    const latest = vi.fn();

    rerender({ cb: vi.fn() });
    rerender({ cb: latest });
    act(() => socket.trigger('tickets.updated', { ticketId: 't-9' }));

    expect(socket.listenerCount('tickets.updated')).toBe(1);
    expect(latest).toHaveBeenCalledTimes(1);
  });
});
