import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { authMiddleware } from './middleware/auth';
import { ticketsRouter } from './routes/tickets';
import { leadsRouter } from './routes/leads';
import { contactsRouter } from './routes/contacts';
import { authRouter } from './routes/auth';
import { webhooksRouter } from './routes/webhooks';
import { integrationsRouter } from './routes/integrations';
import { leadEngineRouter } from './routes/lead-engine';
import { logger } from './config/logger';

if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
}

const app: Application = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'https://ticketz-leadengine.vercel.app',
      'https://3000-i5oqgkzbpmyda4vo6tuz9-326b496f.manusvm.computer',
      'http://localhost:5173',
      'http://localhost:3000'
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Configurações básicas
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP por janela
  message: 'Too many requests from this IP, please try again later.',
});

// Middlewares globais
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://ticketz-leadengine.vercel.app',
    'https://3000-i5oqgkzbpmyda4vo6tuz9-326b496f.manusvm.computer',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);

// Rate limiting apenas em produção
if (NODE_ENV === 'production') {
  app.use('/api', limiter);
}

// Health check simples para o MVP (sem dependência de banco)
app.get('/health', (_req, res) => {
  const details: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    storage: 'in-memory',
  };

  res.json({ status: 'ok', ...details });
});

// Rotas públicas (sem autenticação)
app.use('/api/auth', authRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/lead-engine', leadEngineRouter);

// Rotas protegidas (com autenticação)
app.use('/api/tickets', authMiddleware, ticketsRouter);
app.use('/api/leads', authMiddleware, leadsRouter);
app.use('/api/contacts', authMiddleware, contactsRouter);
app.use('/api/integrations', authMiddleware, integrationsRouter);

// Socket.IO para tempo real
io.use((socket, next) => {
  // Middleware de autenticação para WebSocket
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  
  // TODO: Validar token JWT
  next();
});

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  // Juntar-se a sala do tenant
  socket.on('join-tenant', (tenantId: string) => {
    socket.join(`tenant:${tenantId}`);
    logger.info(`Client ${socket.id} joined tenant ${tenantId}`);
  });
  
  // Juntar-se a sala de usuário
  socket.on('join-user', (userId: string) => {
    socket.join(`user:${userId}`);
    logger.info(`Client ${socket.id} joined user ${userId}`);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

const buildRootAvailabilityPayload = () => ({
  status: 'ok',
  service: 'ticketz-api',
  environment: NODE_ENV,
  version: process.env.npm_package_version,
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
});

const respondWithAvailability = (req: express.Request, res: express.Response) => {
  const payload = buildRootAvailabilityPayload();

  res.status(200).set({
    'x-service-name': payload.service,
    'x-service-environment': payload.environment,
    'x-service-version': payload.version ?? 'unknown',
  });

  if (req.method === 'HEAD') {
    res.setHeader('content-length', '0');
    res.end();
    return;
  }

  res.json(payload);
};

// Root availability check
app.get('/', respondWithAvailability);
app.head('/', respondWithAvailability);

// Middleware de tratamento de erros (deve ser o último)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
  });
});

// Iniciar servidor
server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT} in ${NODE_ENV} mode`);
  logger.info(`📊 Health check available at http://localhost:${PORT}/health`);
  logger.info(`📡 WebSocket server ready for real-time connections`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Exportar para testes
export { app, io };
