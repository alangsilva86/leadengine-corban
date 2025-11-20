import dotenv from 'dotenv';

import { configureSecurityMiddleware } from './app/security';
import { createHttpServer } from './app/http-server';
import { buildDebugMessagesRouter, registerRouters } from './app/routers';
import { registerSocketServer } from './app/sockets';
import { logger } from './config/logger';
import { requestLogger } from './middleware/request-logger';
import { isWhatsappDebugFeatureEnabled } from './config/feature-flags';
import {
  initializeBrokerCircuitBreaker,
  getBrokerCircuitBreakerMetrics,
} from './services/whatsapp-broker-client-protected';
  debugMessagesRouter as enabledDebugMessagesRouter,
  buildDisabledDebugMessagesRouter,
} from './features/debug/routes/messages';
import { agreementsProvidersRouter } from './routes/agreements.providers';
import { tenantsRouter } from './routes/tenants';
import { usersRouter } from './routes/users';
import { initializeBrokerCircuitBreaker, getBrokerCircuitBreakerMetrics } from './services/whatsapp-broker-client-protected';
import { tenantAdminRouterFactory } from './modules/tenant-admin/tenants.routes';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const fallbackPort = NODE_ENV !== 'production' ? '4000' : undefined;
const resolvedPort = process.env.PORT ?? fallbackPort;
const app: Application = express();
const server = createServer(app);

const shouldRegisterWhatsappDebugRoutes = isWhatsappDebugFeatureEnabled();
const debugMessagesRouter: Router = shouldRegisterWhatsappDebugRoutes
  ? enabledDebugMessagesRouter
  : buildDisabledDebugMessagesRouter();
const tenantAdminRouter = tenantAdminRouterFactory();

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

if (!resolvedPort) {
  throw new Error('PORT environment variable must be defined in production environments.');
}

const PORT = Number(resolvedPort);

const shouldRegisterWhatsappDebugRoutes = isWhatsappDebugFeatureEnabled();
const debugMessagesRouter = buildDebugMessagesRouter(shouldRegisterWhatsappDebugRoutes);

const { app, server, io, corsOptions } = createHttpServer();

configureSecurityMiddleware(app, {
  corsOptions,
  nodeEnv: NODE_ENV,
  requestLogger,
  logger,
});

registerSocketServer(io, { logger });

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

registerRouters(app, {
  logger,
  nodeEnv: NODE_ENV,
  debugMessagesRouter,
});

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

server.listen(PORT, () => {
  logger.info(`✅ Server successfully bound to port ${PORT}`);
  logger.info(`📊 Health check available at http://localhost:${PORT}/health`);
  logger.info(`🧭 Prometheus metrics available at http://localhost:${PORT}/metrics`);
  logger.info(`📡 WebSocket server ready for real-time connections`);
});

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

export { app, io };
