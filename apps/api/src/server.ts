import express, { type Application, type RequestHandler } from 'express';
import cors from 'cors';
import type { CorsOptions } from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer, type IncomingMessage } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { authMiddleware, requireTenant } from './middleware/auth';
import { ticketsRouter } from './routes/tickets';
import { leadsRouter } from './routes/leads';
import { contactsRouter } from './routes/contacts';
import { authRouter } from './routes/auth';
import { integrationWebhooksRouter, webhooksRouter } from './routes/webhooks';
import { integrationsRouter } from './routes/integrations';
import { leadEngineRouter } from './routes/lead-engine';
import { logger } from './config/logger';
import { registerSocketServer } from './lib/socket-registry';
import { getWhatsAppEventPollerMetrics, whatsappEventPoller } from './features/whatsapp-inbound/workers/event-poller';
import './features/whatsapp-inbound/workers/inbound-processor';
import { renderMetrics } from './lib/metrics';
import { campaignsRouter } from './routes/campaigns';
import { queuesRouter } from './routes/queues';
import { ticketMessagesRouter } from './routes/messages.ticket';
import { contactMessagesRouter } from './routes/messages.contact';
import { whatsappMessagesRouter } from './routes/integrations/whatsapp.messages';
import { registerSocketConnectionHandlers } from './socket/connection-handlers';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app: Application = express();
const server = createServer(app);

type RawBodyIncomingMessage = IncomingMessage & {
  originalUrl?: string;
  rawBody?: Buffer;
  rawBodyParseError?: SyntaxError | null;
};

const webhookRawBodyMiddleware: RequestHandler = (req, _res, next) => {
  const rawReq = req as RawBodyIncomingMessage;

  const buffer = Buffer.isBuffer(req.body) ? (req.body as Buffer) : Buffer.alloc(0);
  rawReq.rawBody = buffer.length > 0 ? buffer : undefined;
  rawReq.rawBodyParseError = null;

  if (buffer.length === 0) {
    req.body = {};
    next();
    return;
  }

  const contentType = (req.headers['content-type'] ?? '').toString().toLowerCase();
  const shouldAttemptJsonParse = contentType.includes('application/json') || contentType.includes('text/');

  if (!shouldAttemptJsonParse) {
    req.body = {};
    next();
    return;
  }

  const text = buffer.toString('utf8').trim();

  if (!text) {
    req.body = {};
    next();
    return;
  }

  try {
    req.body = JSON.parse(text);
  } catch (error) {
    rawReq.rawBodyParseError = error instanceof SyntaxError ? error : new SyntaxError('Invalid JSON');
    req.body = {};
  }

  next();
};

const normalizeOrigin = (origin: string): string => {
  const trimmed = origin.trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed === '*') {
    return '*';
  }

  return trimmed.toLowerCase().replace(/\/+$/, '');
};

const defaultCorsOrigins = [
  'https://leadengine-corban.onrender.com',
  'https://leadengine-corban-1.onrender.com',
].map(normalizeOrigin);

const configuredCorsOrigins = (process.env.FRONTEND_URL ?? '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

const parsedCorsOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(normalizeOrigin)
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
  allowedHeaders: ['content-type', 'authorization', 'x-tenant-id', 'accept', 'x-api-key'] as string[],
};

const corsOptions: CorsOptions = allowAllOrigins
  ? {
      origin: true,
      ...sharedCorsSettings,
    }
  : {
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true);
        }

        const normalizedOrigin = normalizeOrigin(origin);

        if (corsAllowedOrigins.has(normalizedOrigin)) {
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

type RateLimitState = {
  limit?: number;
  remaining?: number;
  resetTime?: Date;
};

type RateLimitedRequest = express.Request & { rateLimit?: RateLimitState };

const attachRateLimitHeaders = (req: RateLimitedRequest, res: express.Response) => {
  const rateLimit = req.rateLimit;
  const limit = typeof rateLimit?.limit === 'number' ? rateLimit.limit : rateLimitMaxRequests;
  const remaining = typeof rateLimit?.remaining === 'number' ? Math.max(0, rateLimit.remaining) : limit;
  const resetReference = rateLimit?.resetTime instanceof Date ? rateLimit.resetTime : null;
  const resetTime = resetReference ?? new Date(Date.now() + rateLimitWindowMs);
  const resetSeconds = Math.max(0, Math.ceil((resetTime.getTime() - Date.now()) / 1000));

  res.setHeader('X-RateLimit-Limit', limit.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining).toString());
  res.setHeader('X-RateLimit-Reset', resetSeconds.toString());
};

// Rate limiting
const limiter = rateLimit({
  windowMs: rateLimitWindowMs, // 15 minutos por padrão
  max: rateLimitMaxRequests, // máximo 100 requests por IP por janela por padrão
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    const rateLimitedReq = req as RateLimitedRequest;
    const resetTime = rateLimitedReq.rateLimit?.resetTime;
    let retryAfterSeconds: number | null = null;

    if (resetTime instanceof Date) {
      const diffSeconds = Math.ceil((resetTime.getTime() - Date.now()) / 1000);
      retryAfterSeconds = diffSeconds > 0 ? diffSeconds : 1;
    } else if (typeof options?.windowMs === 'number' && Number.isFinite(options.windowMs)) {
      retryAfterSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));
    }

    if (retryAfterSeconds !== null) {
      res.setHeader('Retry-After', retryAfterSeconds.toString());
    }

    attachRateLimitHeaders(rateLimitedReq, res);

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: options?.message || 'Too many requests from this IP, please try again later.',
      },
    });
  },
  message: 'Too many requests from this IP, please try again later.',
});

// Middlewares globais
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    if (req.path.startsWith('/api')) {
      attachRateLimitHeaders(req as RateLimitedRequest, res);
    }
    res.status(204).end();
    return;
  }
  next();
});
app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
const createWebhookRawParser = () => express.raw({ type: '*/*', limit: '1mb' });

app.use('/api/integrations/whatsapp/webhook', createWebhookRawParser(), webhookRawBodyMiddleware);
app.use('/api/webhooks/whatsapp', createWebhookRawParser(), webhookRawBodyMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);

// Rate limiting apenas em produção
if (NODE_ENV === 'production') {
  app.use('/api', limiter);
}

app.use('/api', (req, res, next) => {
  attachRateLimitHeaders(req, res);
  next();
});

app.get('/metrics', (_req, res) => {
  const payload = renderMetrics();
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.status(200).send(payload);
  logger.info('📈 Métricas Prometheus servidas', {
    endpoint: '/metrics',
    sizeInBytes: payload.length,
  });
});

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
app.use('/api', authMiddleware, ticketMessagesRouter);
app.use('/api', authMiddleware, contactMessagesRouter);
app.use('/api', authMiddleware, whatsappMessagesRouter);
app.use('/api/integrations', authMiddleware, integrationsRouter);
app.use('/api/campaigns', authMiddleware, requireTenant, campaignsRouter);
app.use('/api/queues', authMiddleware, requireTenant, queuesRouter);

// Socket.IO para tempo real
io.use((socket, next) => {
  // Middleware de autenticação para WebSocket
  const token = socket.handshake.auth?.token;
  if (!token) {
    logger.warn('Socket connection received without auth token; continuing in demo mode', {
      socketId: socket.id,
      address: socket.handshake.address,
    });
    return next();
  }

  // TODO: Validar token JWT
  next();
});

io.engine.on('connection_error', (err) => {
  logger.warn('Socket.IO handshake falhou — mantendo fallback em polling. Confirme se o proxy/front permite WebSocket.', {
    transport: err.context, // engine.io usa context para transporte
    code: (err as { code?: unknown }).code ?? null,
    message: err.message,
    data: err.data ?? null,
  });
});

io.on('connection', registerSocketConnectionHandlers);

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
  logger.info(`🧭 Prometheus metrics available at http://localhost:${PORT}/metrics`);
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
