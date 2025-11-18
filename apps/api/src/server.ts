import express, { type Application, type RequestHandler, type Router } from 'express';
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
import { requirePlatformAdmin } from './middleware/platform-admin';
import { ticketsRouter } from './routes/tickets';
import { leadsRouter } from './routes/leads';
import { contactsRouter } from './routes/contacts';
import { contactTasksRouter } from './routes/contact-tasks';
import { authRouter } from './routes/auth';
import { onboardingRouter } from './routes/onboarding';
import { onboardingInvitationsRouter } from './routes/onboarding-invitations';
import { integrationWebhooksRouter, webhooksRouter } from './routes/webhooks';
import { integrationsRouter } from './routes/integrations';
import { leadEngineRouter } from './routes/lead-engine';
import { crmRouter } from './routes/crm';
import { logger } from './config/logger';
import { registerSocketServer } from './lib/socket-registry';
import { getWhatsAppMode } from './config/whatsapp';
import { renderMetrics } from './lib/metrics';
import { campaignsRouter } from './routes/campaigns';
import { reportsRouter } from './routes/reports';
import { queuesRouter } from './routes/queues';
import { ticketMessagesRouter } from './routes/messages.ticket';
import { contactMessagesRouter } from './routes/messages.contact';
import { whatsappMessagesRouter } from './routes/integrations/whatsapp.messages';
import { whatsappUploadsRouter } from './routes/whatsapp.uploads';
import { aiRouter } from './routes/ai';
import { registerSocketConnectionHandlers } from './socket/connection-handlers';
import { buildHealthPayload } from './health';
import { preferencesRouter } from './routes/preferences';
import { salesRouter } from './routes/sales';
import { agreementsRouter } from './routes/agreements';
import { whatsappDebugRouter } from './features/debug/routes/whatsapp-debug';
import { isWhatsappDebugToolsEnabled } from './config/feature-flags';
import { isWhatsappDebugFeatureEnabled } from './config/feature-flags';
import {
  debugMessagesRouter as enabledDebugMessagesRouter,
  buildDisabledDebugMessagesRouter,
} from './features/debug/routes/messages';
import { agreementsProvidersRouter } from './routes/agreements.providers';
import { tenantsRouter } from './routes/tenants';
import { usersRouter } from './routes/users';
import { initializeBrokerCircuitBreaker, getBrokerCircuitBreakerMetrics } from './services/whatsapp-broker-client-protected';
import { tenantAdminRouter } from './modules/tenant-admin/tenants.routes';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app: Application = express();
const server = createServer(app);

const shouldRegisterWhatsappDebugRoutes = isWhatsappDebugFeatureEnabled();
const debugMessagesRouter: Router = shouldRegisterWhatsappDebugRoutes
  ? enabledDebugMessagesRouter
  : buildDisabledDebugMessagesRouter();

type RawBodyIncomingMessage = IncomingMessage & {
  originalUrl?: string;
  rawBody?: Buffer;
  rawBodyParseError?: SyntaxError | null;
};

const webhookRawBodyMiddleware: RequestHandler = (req, _res, next) => {
  const rawReq = req as RawBodyIncomingMessage;

  const buffer = Buffer.isBuffer(req.body) ? (req.body as Buffer) : undefined;
  const safeBuffer = buffer ?? Buffer.alloc(0);
  rawReq.rawBody = safeBuffer;
  rawReq.rawBodyParseError = null;

  if (safeBuffer.length === 0) {
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

  const text = safeBuffer.toString('utf8').trim();

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

const defaultCorsOrigins = ['https://leadengine-corban.up.railway.app'].map(normalizeOrigin);

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
  allowedHeaders: [
    'content-type',
    'authorization',
    'x-tenant-id',
    'accept',
    'x-api-key',
    'x-platform-admin-token',
    'x-platform-admin',
    'idempotency-key',
  ] as string[],
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

const socketPath = process.env.SOCKET_IO_PATH ?? '/socket.io';

const socketCorsConfig = allowAllOrigins
  ? {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    }
  : {
      origin: resolvedCorsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    };

const io = new SocketIOServer(server, {
  path: socketPath,
  cors: socketCorsConfig,
  pingTimeout: 25_000,
  pingInterval: 20_000,
});

registerSocketServer(io);

try {
  initializeBrokerCircuitBreaker();
  const brokerCircuitBreakerMetrics = getBrokerCircuitBreakerMetrics();

  if (!brokerCircuitBreakerMetrics.initialized) {
    logger.error('Broker circuit breaker reported uninitialized state immediately after initialization', {
      brokerCircuitBreakerMetrics,
    });
  } else {
    logger.info('Broker circuit breaker initialized successfully', brokerCircuitBreakerMetrics);
  }
} catch (error) {
  logger.error('Failed to initialize broker circuit breaker', { error });
}

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
app.use((req, res, next) => {
  const headerValue = req.headers['x-request-id'];
  const fromHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const trimmed = typeof fromHeader === 'string' ? fromHeader.trim() : '';
  const requestId =
    trimmed.length > 0
      ? trimmed
      : `rid_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  req.rid = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
});
app.use(requestLogger);

// Rate limiting apenas em produção
if (NODE_ENV === 'production') {
  app.use('/api', limiter);
}

app.use('/api', (req, res, next) => {
  attachRateLimitHeaders(req, res);
  next();
});

app.get('/metrics', async (_req, res) => {
  const payload = await renderMetrics();
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.status(200).send(payload);
  logger.info('📈 Métricas Prometheus servidas', {
    endpoint: '/metrics',
    sizeInBytes: payload.length,
  });
});

// Health check simples para o MVP (sem dependência de banco)
app.get(['/health', '/healthz'], (_req, res) => {
  res.json(buildHealthPayload({ environment: NODE_ENV }));
});

app.get('/_diag/echo', (req, res) => {
  const payload = {
    ok: true,
    requestId: req.rid ?? null,
    method: req.method,
    path: req.originalUrl,
    headers: {
      'x-request-id': req.get('x-request-id') ?? null,
      'x-tenant-id': req.get('x-tenant-id') ?? null,
      authorization: req.get('authorization') ? true : false,
      'content-type': req.get('content-type') ?? null,
      'user-agent': req.get('user-agent') ?? null,
    },
  };

  res.status(200).json(payload);
});

// Debug endpoint para verificar AI auto-reply
app.get('/_diag/ai-auto-reply', async (_req, res) => {
  try {
    const { prisma } = await import('./lib/prisma');
    
    // Buscar configurações de AI de todos os tenants
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        slug: true,
        aiEnabled: true,
        aiMode: true,
        aiModel: true,
      },
    });

    const payload = {
      ok: true,
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
      openaiKeyConfigured: !!process.env.OPENAI_API_KEY,
      loggerTransports: logger.transports.map((t: any) => ({
        name: t.name,
        level: t.level,
      })),
      tenants: tenants.map(t => ({
        id: t.id,
        slug: t.slug,
        aiEnabled: t.aiEnabled,
        aiMode: t.aiMode,
        aiModel: t.aiModel,
      })),
    };

    logger.info('🔍 AI AUTO-REPLY DEBUG ENDPOINT ACCESSED', payload);
    res.status(200).json(payload);
  } catch (error) {
    logger.error('❌ Error in AI auto-reply debug endpoint', { error });
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Rotas públicas (sem autenticação)
app.use('/api/auth', authRouter);
app.use('/api/onboarding/invitations', authMiddleware, onboardingInvitationsRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/integrations', integrationWebhooksRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/lead-engine', authMiddleware, requireTenant, leadEngineRouter);
app.use('/api/ai', authMiddleware, requireTenant, aiRouter);
// Tenant admin endpoints are namespaced under /api/tenant-admin/tenants
app.use('/api/tenant-admin/tenants', authMiddleware, requirePlatformAdmin, tenantAdminRouter);
app.use('/api/crm', authMiddleware, crmRouter);
app.use('/api/debug/wa', (req, res, next) => {
  if (!isWhatsappDebugToolsEnabled()) {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.originalUrl} not found`,
    });
    return;
  }
  next();
}, whatsappDebugRouter);
app.use('/api', debugMessagesRouter);

// Rotas protegidas (com autenticação)
app.use('/api/tickets', authMiddleware, requireTenant, ticketsRouter);
app.use('/api/leads', authMiddleware, requireTenant, leadsRouter);
app.use('/api/contacts', authMiddleware, contactsRouter);
app.use('/api/tasks', authMiddleware, contactTasksRouter);
app.use('/api', authMiddleware, ticketMessagesRouter);
app.use('/api', authMiddleware, contactMessagesRouter);
app.use('/api', authMiddleware, whatsappMessagesRouter);
app.use('/api', authMiddleware, whatsappUploadsRouter);
app.use('/api/integrations', authMiddleware, integrationsRouter);
app.use('/api/campaigns', authMiddleware, requireTenant, campaignsRouter);
// agreementsRouter já define caminhos como `/v1/agreements`, então montamos sob `/api`
// para expor os endpoints em `/api/v1/agreements`. Mantemos a rota antiga
// `/api/agreements/v1/agreements` para compatibilidade retroativa.
app.use('/api', authMiddleware, requireTenant, agreementsRouter);
app.use('/api/agreements', authMiddleware, requireTenant, agreementsRouter);
app.use('/api/reports', authMiddleware, requireTenant, reportsRouter);
app.use('/api/queues', authMiddleware, requireTenant, queuesRouter);
app.use('/api/sales', authMiddleware, requireTenant, salesRouter);
app.use('/api/tenants', authMiddleware, requireTenant, tenantsRouter);
app.use('/api/users', authMiddleware, requireTenant, usersRouter);
app.use('/api/v1/agreements', authMiddleware, requireTenant, agreementsProvidersRouter);
app.use('/api', authMiddleware, preferencesRouter);

// Socket.IO para tempo real
io.use((socket, next) => {
  logger.debug('Socket connection established (modo demo)', {
    socketId: socket.id,
    address: socket.handshake.address,
  });
  next();
});

io.engine.on('connection_error', (err) => {
  logger.warn('🎯 LeadEngine • Tempo Real :: 🔌 Handshake WebSocket tropeçou — ativando plano B (polling).', {
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

// Endpoint temporário para debug de AI config
app.get('/_debug/ai-config', async (req, res) => {
  try {
    const { prisma } = await import('./lib/prisma');
    const aiConfig = await prisma.aiConfig.findUnique({
      where: { tenantId: 'demo-tenant' },
    });
    res.json({
      tenantId: 'demo-tenant',
      aiConfig,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/_debug/ai-config/update', async (req, res) => {
  try {
    const { prisma } = await import('./lib/prisma');
    const updated = await prisma.aiConfig.update({
      where: { tenantId: 'demo-tenant' },
      data: { defaultMode: 'IA_AUTO' },
    });
    res.json({ success: true, updated });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
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

// ========================================
// BANNER DE STARTUP COM CONSOLE.LOG DIRETO
// (Bypass do logger para garantir que apareça no Railway)
// ========================================
console.log('\n');
console.log('🔥🔥🔥 ========================================');
console.log('🔥 LEADENGINE API STARTED');
console.log('🔥 VERSION: 2025-11-03-CONSOLE-LOG-DIRECT');
console.log('🔥 FEATURES: ai-auto-reply, queue-logging');
console.log('🔥🔥🔥 ========================================');
console.log('🤖 AI AUTO-REPLY: ENABLED');
console.log('📥 INBOUND QUEUE: LOGGING ENABLED');
console.log(`🔧 Attempting to start server on port ${PORT} in ${NODE_ENV} mode`);
console.log('\n');

// Iniciar servidor
server.listen(PORT, () => {
  logger.info(`✅ Server successfully bound to port ${PORT}`);
  logger.info(`📊 Health check available at http://localhost:${PORT}/health`);
  logger.info(`🧭 Prometheus metrics available at http://localhost:${PORT}/metrics`);
  logger.info(`📡 WebSocket server ready for real-time connections`);
  
  // Log AI configuration após servidor iniciar
  const { logAiConfiguration } = require('./config/ai');
  logAiConfiguration();

  const mode = getWhatsAppMode();
  logger.info(`💬 WhatsApp transport initialized in ${mode.toUpperCase()} mode`);
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
