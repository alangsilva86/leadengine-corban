import type { Socket } from 'socket.io';

import { logger } from '../config/logger';
import { emitToTicket } from '../lib/socket-registry';

type TicketTypingPayload = {
  ticketId?: string;
  [key: string]: unknown;
};

export const registerSocketConnectionHandlers = (socket: Socket): void => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('join-tenant', (tenantId: string) => {
    socket.join(`tenant:${tenantId}`);
    logger.info(`Client ${socket.id} joined tenant ${tenantId}`);
  });

  socket.on('join-user', (userId: string) => {
    socket.join(`user:${userId}`);
    logger.info(`Client ${socket.id} joined user ${userId}`);
  });

  socket.on('join-ticket', (ticketId: string) => {
    socket.join(`ticket:${ticketId}`);
    logger.info(`Client ${socket.id} joined ticket ${ticketId}`);
  });

  socket.on('leave-ticket', (ticketId: string) => {
    void socket.leave(`ticket:${ticketId}`);
    logger.info(`Client ${socket.id} left ticket ${ticketId}`);
  });

  socket.on('ticket:typing', (payload: TicketTypingPayload) => {
    const ticketId = payload?.ticketId;

    if (!ticketId) {
      logger.warn(`Client ${socket.id} sent ticket:typing without ticketId`, { payload });
      return;
    }

    emitToTicket(ticketId, 'ticket:typing', payload);
    logger.info(`Client ${socket.id} typing on ticket ${ticketId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
};
