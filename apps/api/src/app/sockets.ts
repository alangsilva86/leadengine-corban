import type { Server as SocketIOServer } from 'socket.io';

import type { Logger } from '../types/logger';
import { registerSocketConnectionHandlers } from '../socket/connection-handlers';
import { registerSocketServer as storeSocketServer } from '../lib/socket-registry';

type RegisterSocketServerDeps = {
  logger: Logger;
};

export const registerSocketServer = (io: SocketIOServer, { logger }: RegisterSocketServerDeps) => {
  storeSocketServer(io);

  io.use((socket, next) => {
    logger.debug('Socket connection established (modo demo)', {
      socketId: socket.id,
      address: socket.handshake.address,
    });
    next();
  });

  io.engine.on('connection_error', (err) => {
    logger.warn(
      '🎯 LeadEngine • Tempo Real :: 🔌 Handshake WebSocket tropeçou — ativando plano B (polling).',
      {
        transport: err.context,
        code: (err as { code?: unknown }).code ?? null,
        message: err.message,
        data: err.data ?? null,
      },
    );
  });

  io.on('connection', registerSocketConnectionHandlers);
};
