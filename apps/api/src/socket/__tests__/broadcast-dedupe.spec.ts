import { afterEach, describe, expect, it, vi } from 'vitest';
import { Server } from 'socket.io';

import {
  emitToCampaign,
  emitToTenant,
  emitToTicket,
  emitToUser,
  flushPendingBroadcasts,
  getSocketServer,
  registerSocketServer,
  type SocketServerAdapter,
} from '../../lib/socket-registry';
import { emitTicketEvent } from '../../services/tickets/shared/realtime';

/** Dublê de `io`: `to()` encadeável como o BroadcastOperator do socket.io. */
const createChainableServer = () => {
  const broadcasts: Array<{ rooms: string[]; event: string; payload: unknown }> = [];
  const operator = (rooms: string[]) => ({
    to: (room: string) => operator([...rooms, room]),
    emit: (event: string, payload: unknown) => {
      broadcasts.push({ rooms, event, payload });
      return true;
    },
  });
  const server = { to: (room: string) => operator([room]) };
  return { server: server as unknown as SocketServerAdapter, broadcasts };
};

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  registerSocketServer(null);
});

describe('socket-registry broadcast dedupe', () => {
  it('sends one broadcast to the union of rooms when the same payload targets several rooms', async () => {
    const { server, broadcasts } = createChainableServer();
    registerSocketServer(server);
    const payload = { ticketId: 'ticket-1' };

    emitToTenant('tenant-1', 'tickets.updated', payload);
    emitToTicket('ticket-1', 'tickets.updated', payload);
    emitToCampaign('campaign-1', 'tickets.updated', payload);
    emitToUser('user-1', 'tickets.updated', payload);
    await nextTick();

    expect(broadcasts).toEqual([
      {
        rooms: ['tenant:tenant-1', 'ticket:ticket-1', 'campaign:campaign-1', 'user:user-1'],
        event: 'tickets.updated',
        payload,
      },
    ]);
  });

  it('collapses repeated rooms (e.g. emitToUser + emitTicketEvent for the same author)', async () => {
    const { server, broadcasts } = createChainableServer();
    registerSocketServer(server);
    const note = { id: 'note-1' };

    emitToUser('user-1', 'ticket.note.created', note);
    emitTicketEvent('tenant-1', 'ticket-1', 'ticket.note.created', note, 'user-1');
    await nextTick();

    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0]?.rooms).toEqual(['user:user-1', 'tenant:tenant-1', 'ticket:ticket-1']);
  });

  it('keeps distinct events and payloads apart, in emission order', async () => {
    const { server, broadcasts } = createChainableServer();
    registerSocketServer(server);
    const first = { id: 'a' };
    const second = { id: 'b' };

    emitToTenant('tenant-1', 'messages.new', first);
    emitToTenant('tenant-1', 'tickets.updated', first);
    emitToTicket('ticket-1', 'messages.new', second);
    emitToTicket('ticket-1', 'messages.new', first);
    await nextTick();

    expect(broadcasts.map(({ event, payload, rooms }) => [event, payload, rooms])).toEqual([
      ['messages.new', first, ['tenant:tenant-1', 'ticket:ticket-1']],
      ['tickets.updated', first, ['tenant:tenant-1']],
      ['messages.new', second, ['ticket:ticket-1']],
    ]);
  });

  it('dedupes direct emits made through getSocketServer()', async () => {
    const { server, broadcasts } = createChainableServer();
    registerSocketServer(server);
    const message = { id: 'm-1' };

    const socket = getSocketServer();
    socket?.to('tenant:tenant-1').emit('messages.new', message);
    socket?.to('ticket:ticket-1').emit('messages.new', message);
    emitToTicket('ticket-1', 'messages.new', message);
    await nextTick();

    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0]?.rooms).toEqual(['tenant:tenant-1', 'ticket:ticket-1']);
  });

  it('falls back to one emit per room for adapters without chaining', async () => {
    const events: Array<{ room: string; event: string }> = [];
    registerSocketServer({
      to: (room: string) => ({ emit: (event: string) => events.push({ room, event }) }),
    } as unknown as SocketServerAdapter);
    const payload = {};

    emitToTenant('tenant-1', 'tickets.updated', payload);
    emitToTicket('ticket-1', 'tickets.updated', payload);
    await nextTick();

    expect(events).toEqual([
      { room: 'tenant:tenant-1', event: 'tickets.updated' },
      { room: 'ticket:ticket-1', event: 'tickets.updated' },
    ]);
  });

  it('flushes pending broadcasts before the server is swapped and drops emits without a server', async () => {
    const { server, broadcasts } = createChainableServer();
    registerSocketServer(server);

    emitToTenant('tenant-1', 'tickets.updated', { id: 1 });
    registerSocketServer(null);
    emitToTenant('tenant-1', 'tickets.updated', { id: 2 });
    await nextTick();
    flushPendingBroadcasts();

    expect(broadcasts).toHaveLength(1);
    expect(getSocketServer()).toBeNull();
  });

  it('reaches the socket.io adapter as a single broadcast with every room', async () => {
    const io = new Server();
    const adapter = io.of('/').adapter;
    const broadcastSpy = vi.spyOn(adapter, 'broadcast').mockImplementation(() => {});
    registerSocketServer(io);
    const payload = { ticketId: 'ticket-9' };

    emitTicketEvent('tenant-9', 'ticket-9', 'tickets.updated', payload, 'user-9', 'campaign-9');
    await nextTick();

    expect(broadcastSpy).toHaveBeenCalledTimes(1);
    const [, options] = broadcastSpy.mock.calls[0]!;
    expect([...options.rooms]).toEqual([
      'tenant:tenant-9',
      'ticket:ticket-9',
      'campaign:campaign-9',
      'user:user-9',
    ]);
  });

  it('delivers once per socket even when it sits in several of the target rooms', async () => {
    const io = new Server();
    const nsp = io.of('/');
    const delivered: string[] = [];
    // Sockets falsos: o adapter só precisa de `id` e de `client.writeToEngine`/`packet`.
    const makeSocket = (id: string) => ({
      id,
      client: { writeToEngine: () => delivered.push(id) },
      packet: () => delivered.push(id),
      notifyOutgoingListeners: () => () => {},
    });
    ['a', 'b'].forEach((id) => nsp.sockets.set(id, makeSocket(id) as never));
    nsp.adapter.addAll('a', new Set(['tenant:t', 'user:ua']));
    nsp.adapter.addAll('b', new Set(['tenant:t', 'user:ub', 'ticket:k']));
    registerSocketServer(io);

    emitTicketEvent('t', 'k', 'tickets.updated', { ticketId: 'k' }, 'ua');
    await nextTick();

    expect(delivered.sort()).toEqual(['a', 'b']);
  });
});
