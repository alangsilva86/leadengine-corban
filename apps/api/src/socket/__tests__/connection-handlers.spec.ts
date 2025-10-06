import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io';

import { registerSocketConnectionHandlers } from '../connection-handlers';
import { emitToTicket } from '../../lib/socket-registry';
import { logger } from '../../config/logger';

vi.mock('../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../lib/socket-registry', () => ({
  emitToTicket: vi.fn(),
}));

type RegisteredHandlers = Record<string, (payload: any) => void>;

type FakeSocket = Socket & {
  handlers: RegisteredHandlers;
};

const createFakeSocket = (): FakeSocket => {
  const handlers: RegisteredHandlers = {};
  const join = vi.fn();
  const leave = vi.fn().mockResolvedValue(undefined);

  const socket = {
    id: 'socket-123',
    handshake: { address: '::1', auth: {} },
    handlers,
    on: vi.fn((event: string, handler: (payload: any) => void) => {
      handlers[event] = handler;
      return socket;
    }),
    join,
    leave,
  } as unknown as FakeSocket;

  return socket;
};

describe('registerSocketConnectionHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('joins the provided ticket room when receiving join-ticket', () => {
    const socket = createFakeSocket();

    registerSocketConnectionHandlers(socket);

    socket.handlers['join-ticket']?.('ticket-1');

    expect(socket.join).toHaveBeenCalledWith('ticket:ticket-1');
    expect(logger.info).toHaveBeenCalledWith('Client socket-123 joined ticket ticket-1');
  });

  it('leaves the ticket room when receiving leave-ticket', () => {
    const socket = createFakeSocket();

    registerSocketConnectionHandlers(socket);

    socket.handlers['leave-ticket']?.('ticket-2');

    expect(socket.leave).toHaveBeenCalledWith('ticket:ticket-2');
    expect(logger.info).toHaveBeenCalledWith('Client socket-123 left ticket ticket-2');
  });

  it('broadcasts typing payloads to the ticket room', () => {
    const socket = createFakeSocket();
    const payload = { ticketId: 'ticket-3', timestamp: 123456 };

    registerSocketConnectionHandlers(socket);

    socket.handlers['ticket:typing']?.(payload);

    expect(emitToTicket).toHaveBeenCalledWith('ticket-3', 'ticket:typing', payload);
    expect(logger.info).toHaveBeenCalledWith('Client socket-123 typing on ticket ticket-3');
  });

  it('logs a warning when typing payload lacks ticketId', () => {
    const socket = createFakeSocket();

    registerSocketConnectionHandlers(socket);

    socket.handlers['ticket:typing']?.({ timestamp: 987 });

    expect(emitToTicket).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('Client socket-123 sent ticket:typing without ticketId', {
      payload: { timestamp: 987 },
    });
  });
});
