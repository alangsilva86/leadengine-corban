import dotenv from 'dotenv';

import { configureSecurityMiddleware } from './app/security';
import { createHttpServer } from './app/http-server';
import { buildDebugMessagesRouter, registerRouters } from './app/routers';
import { registerSocketServer } from './app/sockets';
import { isWhatsappDebugFeatureEnabled } from './config/feature-flags';
import { logger } from './config/logger';
import { buildRateLimitConfigFromEnv } from './middleware/rate-limit';
import { requestLogger } from './middleware/request-logger';
import { getBrokerCircuitBreakerMetrics, initializeBrokerCircuitBreaker } from './services/whatsapp-broker-client-protected';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const fallbackPort = NODE_ENV !== 'production' ? '4000' : undefined;
const resolvedPort = process.env.PORT ?? fallbackPort;

if (!resolvedPort) {
  throw new Error('PORT environment variable must be defined in production environments.');
}

const PORT = Number(resolvedPort);
const rateLimitConfig = buildRateLimitConfigFromEnv();

const shouldRegisterWhatsappDebugRoutes = isWhatsappDebugFeatureEnabled();
const debugMessagesRouter = buildDebugMessagesRouter(shouldRegisterWhatsappDebugRoutes);

const { app, server, io, corsOptions } = createHttpServer();

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
