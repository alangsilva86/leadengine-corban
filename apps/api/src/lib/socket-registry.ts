import type { Server as SocketIOServer } from 'socket.io';

import { wsEmitCounter } from './metrics';

type BroadcastEmitter = {
  emit(event: string, payload: unknown): void;
  to?: (room: string) => BroadcastEmitter;
};

export type SocketServerAdapter = Pick<SocketIOServer, 'to'>;

/** O que os serviços usam para emitir: `to(sala).emit(evento, payload)`. */
export type RealtimeBroadcaster = {
  to(room: string): { emit(event: string, payload: unknown): void };
};

type PendingBroadcast = { event: string; payload: unknown; rooms: Set<string> };

let socketServer: SocketServerAdapter | null = null;
let pending: PendingBroadcast[] = [];
let flushScheduled = false;

/**
 * Entrega um evento uma única vez para a união das salas.
 *
 * O socket.io deduplica quando as salas vão na mesma operação (`io.to(a).to(b).emit`):
 * um cliente que está em `tenant:x` e `user:y` recebe o evento uma vez só. Emitir sala por
 * sala entregava uma cópia por sala.
 */
const broadcast = (rooms: string[], event: string, payload: unknown) => {
  const server = socketServer;
  if (!server || rooms.length === 0) {
    return;
  }

  let operator = server.to(rooms[0]!) as unknown as BroadcastEmitter;
  const rest = rooms.slice(1);

  if (rest.length > 0 && typeof operator.to !== 'function') {
    // Adaptador sem encadeamento (dublês de teste): mantém uma emissão por sala.
    rooms.forEach((room) => {
      const single = server.to(room) as unknown as BroadcastEmitter;
      if (typeof single.emit === 'function') {
        single.emit(event, payload);
        wsEmitCounter.inc({ room, event });
      }
    });
    return;
  }

  for (const room of rest) {
    operator = operator.to!(room);
  }
  if (typeof operator.emit !== 'function') {
    return;
  }
  operator.emit(event, payload);
  rooms.forEach((room) => wsEmitCounter.inc({ room, event }));
};

/** Esvazia a fila do tick atual (exportado para testes e para trocas de servidor). */
export const flushPendingBroadcasts = () => {
  flushScheduled = false;
  if (pending.length === 0) {
    return;
  }
  const batch = pending;
  pending = [];
  batch.forEach((entry) => broadcast([...entry.rooms], entry.event, entry.payload));
};

/**
 * Agrupa as emissões do mesmo tick: o mesmo evento com o mesmo payload (mesma referência)
 * para várias salas vira um único broadcast para a união delas. Os serviços continuam
 * chamando `emitToTenant` + `emitToTicket` + `emitToUser`… e o cliente recebe uma cópia.
 * A ordem entre eventos diferentes é preservada (ordem da primeira emissão de cada um).
 */
const enqueue = (room: string, event: string, payload: unknown) => {
  if (!socketServer) {
    return;
  }

  const existing = pending.find((entry) => entry.event === event && entry.payload === payload);
  if (existing) {
    existing.rooms.add(room);
  } else {
    pending.push({ event, payload, rooms: new Set([room]) });
  }

  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(flushPendingBroadcasts);
  }
};

export const registerSocketServer = (server: SocketServerAdapter | null) => {
  flushPendingBroadcasts();
  socketServer = server;
};

const coalescingBroadcaster: RealtimeBroadcaster = {
  to: (room: string) => ({
    emit: (event: string, payload: unknown) => enqueue(room, event, payload),
  }),
};

/** Emissor com a mesma deduplicação de `emitTo*` (para quem emite direto por sala). */
export const getSocketServer = (): RealtimeBroadcaster | null =>
  socketServer ? coalescingBroadcaster : null;

export const emitToTenant = (tenantId: string, event: string, payload: unknown) => {
  enqueue(`tenant:${tenantId}`, event, payload);
};

export const emitToUser = (userId: string, event: string, payload: unknown) => {
  enqueue(`user:${userId}`, event, payload);
};

export const emitToTicket = (ticketId: string, event: string, payload: unknown) => {
  enqueue(`ticket:${ticketId}`, event, payload);
};

export const emitToCampaign = (campaignId: string, event: string, payload: unknown) => {
  enqueue(`campaign:${campaignId}`, event, payload);
};
