import type { Server as SocketIOServer } from 'socket.io';

import { authenticateAccessToken } from '../middleware/auth';
import type { Logger } from '../types/logger';
import { registerSocketConnectionHandlers } from '../socket/connection-handlers';
import { registerSocketServer as storeSocketServer } from '../lib/socket-registry';

type RegisterSocketServerDeps = {
  logger: Logger;
};

export const registerSocketServer = (io: SocketIOServer, { logger }: RegisterSocketServerDeps) => {
  storeSocketServer(io);

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || !token) return next(new Error('UNAUTHORIZED'));

    try {
      const session = await authenticateAccessToken(token);
      if (!session) return next(new Error('UNAUTHORIZED'));
      socket.data.session = session;
      return next();
    } catch {
      return next(new Error('UNAUTHORIZED'));
    }
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
