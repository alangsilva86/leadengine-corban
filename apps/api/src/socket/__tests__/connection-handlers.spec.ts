import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io';

import { registerSocketConnectionHandlers, TYPING_RELAY_MIN_INTERVAL_MS } from '../connection-handlers';
import { logger } from '../../config/logger';

const mocks = vi.hoisted(() => ({
  ticketFindFirst: vi.fn(),
  campaignFindFirst: vi.fn(),
  findActiveSession: vi.fn(),
}));

vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    ticket: { findFirst: mocks.ticketFindFirst },
    campaign: { findFirst: mocks.campaignFindFirst },
  },
}));

vi.mock('../../middleware/auth', () => ({
  findActiveSession: mocks.findActiveSession,
}));

type Handler = (...args: any[]) => unknown;

type FakeSocket = Socket & {
  handlers: Record<string, Handler>;
  middlewares: Handler[];
  roomEmit: ReturnType<typeof vi.fn>;
  nspEmit: ReturnType<typeof vi.fn>;
  roomMembers: Map<string, Array<{ data: { session: unknown } }>>;
};

const SESSION = {
  user: { id: 'user-1', tenantId: 'tenant-1', name: 'Ana Atendente' },
  claims: { sub: 'user-1', tenantId: 'tenant-1', sid: 'session-1', exp: Math.floor(Date.now() / 1000) + 3600 },
};

const createFakeSocket = (session: unknown = SESSION): FakeSocket => {
  const handlers: Record<string, Handler> = {};
  const middlewares: Handler[] = [];
  const rooms = new Set<string>(['socket-123']);
  const roomEmit = vi.fn();
  const nspEmit = vi.fn();
  // Membros das salas como o adapter do socket.io os devolve em fetchSockets().
  const roomMembers = new Map<string, Array<{ data: { session: unknown } }>>();

  const socket = {
    id: 'socket-123',
    data: { session },
    connected: true,
    rooms,
    handlers,
    middlewares,
    roomEmit,
    nspEmit,
    roomMembers,
    nsp: {
      in: vi.fn((room: string) => ({ fetchSockets: async () => roomMembers.get(room) ?? [] })),
      to: vi.fn(() => ({ emit: nspEmit })),
    },
    on: vi.fn((event: string, handler: Handler) => {
      handlers[event] = handler;
      return socket;
    }),
    once: vi.fn((event: string, handler: Handler) => {
      handlers[event] = handler;
      return socket;
    }),
    use: vi.fn((middleware: Handler) => {
      middlewares.push(middleware);
      return socket;
    }),
    join: vi.fn(async (room: string | string[]) => {
      (Array.isArray(room) ? room : [room]).forEach((name) => rooms.add(name));
    }),
    leave: vi.fn(async (room: string) => {
      rooms.delete(room);
    }),
    to: vi.fn(() => ({ emit: roomEmit })),
    disconnect: vi.fn(),
  } as unknown as FakeSocket;

  return socket;
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('registerSocketConnectionHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findActiveSession.mockResolvedValue({ id: 'session-1' });
  });

  it('disconnects sockets that reached the handler without an authenticated session', () => {
    const socket = createFakeSocket(null);

    registerSocketConnectionHandlers(socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.on).not.toHaveBeenCalled();
  });

  it('joins tenant and user rooms derived from the session in a single call', () => {
    const socket = createFakeSocket();

    registerSocketConnectionHandlers(socket);

    expect(socket.join).toHaveBeenCalledTimes(1);
    expect(socket.join).toHaveBeenCalledWith(['tenant:tenant-1', 'user:user-1']);
  });

  it('joins the ticket room only after confirming the ticket belongs to the tenant', async () => {
    const socket = createFakeSocket();
    mocks.ticketFindFirst.mockResolvedValueOnce({ id: 'ticket-1' });

    registerSocketConnectionHandlers(socket);
    await socket.handlers['join-ticket']?.('ticket-1');

    expect(mocks.ticketFindFirst).toHaveBeenCalledWith({
      where: { id: 'ticket-1', tenantId: 'tenant-1' },
      select: { id: true },
    });
    expect(socket.join).toHaveBeenCalledWith('ticket:ticket-1');
  });

  it('ignores join-ticket for tickets of another tenant or invalid ids', async () => {
    const socket = createFakeSocket();
    mocks.ticketFindFirst.mockResolvedValueOnce(null);

    registerSocketConnectionHandlers(socket);
    await socket.handlers['join-ticket']?.('ticket-from-other-tenant');
    await socket.handlers['join-ticket']?.({ id: 'not-a-string' });
    await socket.handlers['join-ticket']?.('');

    expect(mocks.ticketFindFirst).toHaveBeenCalledTimes(1);
    expect(socket.join).not.toHaveBeenCalledWith('ticket:ticket-from-other-tenant');
    expect(socket.rooms.has('ticket:ticket-from-other-tenant')).toBe(false);
  });

  it('logs and survives authorization failures', async () => {
    const socket = createFakeSocket();
    mocks.ticketFindFirst.mockRejectedValueOnce(new Error('db down'));

    registerSocketConnectionHandlers(socket);
    await socket.handlers['join-ticket']?.('ticket-1');

    expect(socket.join).not.toHaveBeenCalledWith('ticket:ticket-1');
    expect(logger.warn).toHaveBeenCalledWith(
      'Falha ao autorizar uma inscrição de tempo real',
      expect.objectContaining({ resource: 'ticket' })
    );
  });

  it('leaves the ticket room when receiving leave-ticket', () => {
    const socket = createFakeSocket();

    registerSocketConnectionHandlers(socket);
    socket.handlers['leave-ticket']?.('ticket-2');

    expect(socket.leave).toHaveBeenCalledWith('ticket:ticket-2');
  });

  const joinTicket = async (socket: FakeSocket, ticketId: string) => {
    mocks.ticketFindFirst.mockResolvedValueOnce({ id: ticketId });
    await socket.handlers['join-ticket']?.(ticketId);
  };

  it('relays typing to the ticket room and the tenant room (list indicator), using the session user', async () => {
    const socket = createFakeSocket();

    registerSocketConnectionHandlers(socket);
    await joinTicket(socket, 'ticket-3');
    socket.handlers['ticket:typing']?.({ ticketId: 'ticket-3', userId: 'spoofed-user', userName: 'Spoof' });

    expect(socket.to).toHaveBeenCalledWith(['ticket:ticket-3', 'tenant:tenant-1']);
    expect(socket.roomEmit).toHaveBeenCalledWith('ticket:typing', {
      ticketId: 'ticket-3',
      userId: 'user-1',
      userName: 'Ana Atendente',
      state: 'start',
      mode: 'reply',
      timestamp: expect.any(Number),
    });
  });

  it('labels internal-note typing and relays stop', async () => {
    const socket = createFakeSocket();

    registerSocketConnectionHandlers(socket);
    await joinTicket(socket, 'ticket-4');
    socket.handlers['ticket:typing']?.({ ticketId: 'ticket-4', state: 'start', mode: 'note' });
    socket.handlers['ticket:typing']?.({ ticketId: 'ticket-4', state: 'stop' });

    expect(socket.roomEmit).toHaveBeenNthCalledWith(1, 'ticket:typing', expect.objectContaining({ state: 'start', mode: 'note' }));
    expect(socket.roomEmit).toHaveBeenNthCalledWith(2, 'ticket:typing', expect.objectContaining({ state: 'stop' }));
  });

  it('throttles repeated typing starts per ticket', async () => {
    vi.useFakeTimers();
    try {
      const socket = createFakeSocket();

      registerSocketConnectionHandlers(socket);
      await joinTicket(socket, 'ticket-5');
      socket.handlers['ticket:typing']?.({ ticketId: 'ticket-5' });
      socket.handlers['ticket:typing']?.({ ticketId: 'ticket-5' });
      expect(socket.roomEmit).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(TYPING_RELAY_MIN_INTERVAL_MS);
      socket.handlers['ticket:typing']?.({ ticketId: 'ticket-5' });
      expect(socket.roomEmit).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops typing payloads without ticketId or for rooms the socket did not join', () => {
    const socket = createFakeSocket();

    registerSocketConnectionHandlers(socket);
    socket.handlers['ticket:typing']?.({ timestamp: 987 });
    socket.handlers['ticket:typing']?.({ ticketId: 'ticket-not-joined' });

    expect(socket.to).not.toHaveBeenCalled();
    expect(socket.roomEmit).not.toHaveBeenCalled();
  });

  it('announces stop when the typist leaves the ticket or disconnects', async () => {
    const socket = createFakeSocket();

    registerSocketConnectionHandlers(socket);
    await joinTicket(socket, 'ticket-6');
    await joinTicket(socket, 'ticket-7');
    socket.handlers['ticket:typing']?.({ ticketId: 'ticket-6' });
    socket.handlers['ticket:typing']?.({ ticketId: 'ticket-7' });
    socket.roomEmit.mockClear();

    await socket.handlers['leave-ticket']?.('ticket-6');
    socket.handlers['disconnecting']?.();

    expect(socket.roomEmit).toHaveBeenCalledTimes(2);
    expect(socket.roomEmit).toHaveBeenCalledWith('ticket:typing', expect.objectContaining({ ticketId: 'ticket-6', state: 'stop' }));
    expect(socket.roomEmit).toHaveBeenCalledWith('ticket:typing', expect.objectContaining({ ticketId: 'ticket-7', state: 'stop' }));
  });

  it('broadcasts who is viewing the ticket (one entry per user) after joining', async () => {
    const socket = createFakeSocket();
    const otherAgent = { user: { id: 'user-2', tenantId: 'tenant-1', name: 'Bruno' } };
    socket.roomMembers.set('ticket:ticket-8', [
      { data: { session: SESSION } },
      { data: { session: otherAgent } },
      { data: { session: otherAgent } },
    ]);

    registerSocketConnectionHandlers(socket);
    await joinTicket(socket, 'ticket-8');

    expect(socket.nsp.to).toHaveBeenCalledWith('ticket:ticket-8');
    expect(socket.nspEmit).toHaveBeenCalledWith('ticket:viewers', {
      ticketId: 'ticket-8',
      viewers: [
        { userId: 'user-1', userName: 'Ana Atendente' },
        { userId: 'user-2', userName: 'Bruno' },
      ],
      timestamp: expect.any(Number),
    });
  });

  it('acknowledges legacy join-tenant only for the session tenant', () => {
    const socket = createFakeSocket();
    const ack = vi.fn();

    registerSocketConnectionHandlers(socket);
    socket.handlers['join-tenant']?.({ tenantId: 'tenant-1' }, ack);
    socket.handlers['join-tenant']?.('tenant-2', ack);

    expect(ack).toHaveBeenNthCalledWith(1, { ok: true });
    expect(ack).toHaveBeenNthCalledWith(2, { ok: false, error: 'FORBIDDEN' });
    expect(socket.join).toHaveBeenCalledTimes(1);
  });

  it('disconnects when a packet arrives after the session was revoked', async () => {
    const socket = createFakeSocket();
    const next = vi.fn();
    mocks.findActiveSession.mockResolvedValueOnce(null);

    registerSocketConnectionHandlers(socket);
    socket.middlewares[0]?.(['join-ticket', 'ticket-1'], next);
    await flush();

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'UNAUTHORIZED' }));
  });

  it('lets packets through while the session is active', async () => {
    const socket = createFakeSocket();
    const next = vi.fn();

    registerSocketConnectionHandlers(socket);
    socket.middlewares[0]?.(['join-ticket', 'ticket-1'], next);
    await flush();

    expect(next).toHaveBeenCalledWith();
    expect(socket.disconnect).not.toHaveBeenCalled();
  });
});
