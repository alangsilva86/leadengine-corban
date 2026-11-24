import './config/load-env';

import { configureSecurityMiddleware } from './app/security';
import { createHttpServer } from './app/http-server';
import { buildDebugMessagesRouter, registerRouters } from './app/routers';
import { registerSocketServer } from './app/sockets';
import { startInboundWebhookWorker } from './features/whatsapp-inbound/services/inbound-queue';
import { isDatabaseEnabled } from './lib/prisma';
import { isWhatsappDebugFeatureEnabled } from './config/feature-flags';
import { getPollEncryptionConfig } from './config/poll-encryption';
import { logger } from './config/logger';
import { buildRateLimitConfigFromEnv } from './middleware/rate-limit';
import { requestLogger } from './middleware/request-logger';
import { getBrokerCircuitBreakerMetrics, initializeBrokerCircuitBreaker } from './services/whatsapp-broker-client-protected';
import {
  getReadinessState,
  logRuntimeLifecycle,
  markApplicationNotReady,
  markApplicationReady,
  registerGracefulShutdown,
} from './app/readiness';

const NODE_ENV = process.env.NODE_ENV || 'development';
const fallbackPort = NODE_ENV !== 'production' ? '4000' : undefined;
const resolvedPort = process.env.PORT ?? fallbackPort;

if (!resolvedPort) {
  throw new Error('PORT environment variable must be defined in production environments.');
}

const PORT = Number(resolvedPort);
const HOST = process.env.HOST || (NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
const pollEncryptionConfig = getPollEncryptionConfig();
const rateLimitConfig = buildRateLimitConfigFromEnv();

const shouldRegisterWhatsappDebugRoutes = isWhatsappDebugFeatureEnabled();
const debugMessagesRouter = buildDebugMessagesRouter(shouldRegisterWhatsappDebugRoutes);

markApplicationNotReady('booting API process', {
  nodeEnv: NODE_ENV,
  port: PORT,
});

const { app, server, io, corsOptions } = createHttpServer();

logger.info('Poll runtime encryption key carregada', {
  source: pollEncryptionConfig.source,
});

configureSecurityMiddleware(app, {
  corsOptions,
  nodeEnv: NODE_ENV,
  requestLogger,
  logger,
  rateLimitConfig,
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

server.listen(PORT, HOST, () => {
  logger.info(`✅ Server successfully bound to port ${PORT}`);
  logger.info(`📊 Health check available at http://localhost:${PORT}/health`);
  logger.info(`🧭 Prometheus metrics available at http://localhost:${PORT}/metrics`);
  logger.info(`📡 WebSocket server ready for real-time connections`);
  if (isDatabaseEnabled) server.once('close', startInboundWebhookWorker());
  markApplicationReady('http listener bound', {
    port: PORT,
    nodeEnv: NODE_ENV,
    pid: process.pid,
  });
});

registerGracefulShutdown({ logger, server });
logRuntimeLifecycle(logger);

logger.info('Readiness probe initialized', getReadinessState());

export { app, io };
