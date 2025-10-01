import express, { type Application } from 'express';
import cors from 'cors';
import type { CorsOptions } from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { authMiddleware } from './middleware/auth';
import { ticketsRouter } from './routes/tickets';
import { leadsRouter } from './routes/leads';
import { contactsRouter } from './routes/contacts';
import { authRouter } from './routes/auth';
import { integrationWebhooksRouter, webhooksRouter } from './routes/webhooks';
import { integrationsRouter } from './routes/integrations';
import { leadEngineRouter } from './routes/lead-engine';
import { logger } from './config/logger';
import { registerSocketServer } from './lib/socket-registry';
import { getWhatsAppEventPollerMetrics, whatsappEventPoller } from './workers/whatsapp-event-poller';

if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
}

const app: Application = express();
const server = createServer(app);

type RawBodyIncomingMessage = IncomingMessage & { originalUrl?: string; rawBody?: Buffer };

const captureRawBody = (req: RawBodyIncomingMessage, _res: ServerResponse, buf: Buffer): void => {
  if (req.originalUrl?.startsWith('/api/integrations/whatsapp/webhook')) {
    req.rawBody = Buffer.from(buf);
  }
};

const defaultCorsOrigins = [
  'https://leadengine-corban.onrender.com',
  'https://leadengine-corban-1.onrender.com',
];

const configuredCorsOrigins = (process.env.FRONTEND_URL ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const parsedCorsOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsAllowedOrigins = new Set<string>([...defaultCorsOrigins, ...configuredCorsOrigins, ...parsedCorsOrigins]);
const allowAllOrigins = corsAllowedOrigins.has('*');

if (allowAllOrigins) {
  corsAllowedOrigins.delete('*');
}

const resolvedCorsOrigins = Array.from(corsAllowedOrigins);

const sharedCorsSettings = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as string[],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'Accept', 'x-api-key'] as string[],
};

const corsOptions: CorsOptions = allowAllOrigins
  ? {
      origin: true,
      ...sharedCorsSettings,
    }
  : {
      origin: (origin, callback) => {
        if (!origin || corsAllowedOrigins.has(origin)) {
          return callback(null, true);
        }

        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      ...sharedCorsSettings,
    };

const io = new SocketIOServer(server, {
  cors: allowAllOrigins
    ? {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      }
    : {
        origin: resolvedCorsOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
});

registerSocketServer(io);

// Configurações básicas
const NODE_ENV = process.env.NODE_ENV || 'development';
const fallbackPort = NODE_ENV !== 'production' ? '4000' : undefined;
const resolvedPort = process.env.PORT ?? fallbackPort;

if (!resolvedPort) {
  throw new Error('PORT environment variable must be defined in production environments.');
}

const PORT = Number(resolvedPort);

// Rate limit configuration
const DEFAULT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 100;

const parsedRateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS);
const rateLimitWindowMs =
  Number.isFinite(parsedRateLimitWindowMs) && parsedRateLimitWindowMs > 0
    ? parsedRateLimitWindowMs
    : DEFAULT_RATE_LIMIT_WINDOW_MS;

const parsedRateLimitMaxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS);
const rateLimitMaxRequests =
  Number.isInteger(parsedRateLimitMaxRequests) && parsedRateLimitMaxRequests > 0
    ? parsedRateLimitMaxRequests
    : DEFAULT_RATE_LIMIT_MAX_REQUESTS;

// Rate limiting
const limiter = rateLimit({
  windowMs: rateLimitWindowMs, // 15 minutos por padrão
  max: rateLimitMaxRequests, // máximo 100 requests por IP por janela por padrão
  message: 'Too many requests from this IP, please try again later.',
});

// Middlewares globais
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(express.json({ limit: '10mb', verify: captureRawBody }));
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
    whatsappEventPoller: getWhatsAppEventPollerMetrics(),
  };

  res.json({ status: 'ok', ...details });
});

// Rotas públicas (sem autenticação)
app.use('/api/auth', authRouter);
app.use('/api/integrations', integrationWebhooksRouter);
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

// Root availability check
const rootAvailabilityPayload = {
  status: 'ok',
  environment: NODE_ENV,
};

app.get('/', (_req, res) => {
  res.status(200).json(rootAvailabilityPayload);
});

app.head('/', (_req, res) => {
  const payloadString = JSON.stringify(rootAvailabilityPayload);

  res
    .status(200)
    .set({
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payloadString).toString(),
    })
    .end();
});

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

  const pollerDisabled = process.env.WHATSAPP_EVENT_POLLER_DISABLED === 'true';
  const isTestEnv = NODE_ENV === 'test';

  if (pollerDisabled) {
    logger.info('WhatsApp event poller is disabled via configuration');
  } else if (isTestEnv) {
    logger.info('WhatsApp event poller skipped in test environment');
  } else {
    whatsappEventPoller.start();
    logger.info('WhatsApp event poller started');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  whatsappEventPoller.stop().catch((error) => {
    logger.warn('Failed to stop WhatsApp event poller on SIGTERM', { error });
  });
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  whatsappEventPoller.stop().catch((error) => {
    logger.warn('Failed to stop WhatsApp event poller on SIGINT', { error });
  });
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Exportar para testes
export { app, io };
