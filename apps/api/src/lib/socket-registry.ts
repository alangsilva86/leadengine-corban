import type { Server as SocketIOServer } from 'socket.io';

import { wsEmitCounter } from './metrics';

type BroadcastEmitter = {
  emit(event: string, payload: unknown): void;
};

export type SocketServerAdapter = Pick<SocketIOServer, 'to'>;

let socketServer: SocketServerAdapter | null = null;

export const registerSocketServer = (server: SocketServerAdapter | null) => {
  socketServer = server;
};

export const getSocketServer = (): SocketServerAdapter | null => socketServer;

const emitToRoom = (room: string, event: string, payload: unknown) => {
  if (!socketServer) {
    return;
  }

  const broadcaster = socketServer.to(room) as BroadcastEmitter;
  if (typeof broadcaster.emit === 'function') {
    broadcaster.emit(event, payload);
    wsEmitCounter.inc({ room, event });
  }
};

export const emitToTenant = (tenantId: string, event: string, payload: unknown) => {
  emitToRoom(`tenant:${tenantId}`, event, payload);
};

export const emitToUser = (userId: string, event: string, payload: unknown) => {
  emitToRoom(`user:${userId}`, event, payload);
};

export const emitToTicket = (ticketId: string, event: string, payload: unknown) => {
  emitToRoom(`ticket:${ticketId}`, event, payload);
};

export const emitToAgreement = (agreementId: string, event: string, payload: unknown) => {
  emitToRoom(`agreement:${agreementId}`, event, payload);
};
