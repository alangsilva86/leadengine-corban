import compression from 'compression';
import cors, { type CorsOptions } from 'cors';
import express, { type Application, type RequestHandler } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { IncomingMessage } from 'http';

import { attachRateLimitHeaders, buildRateLimitConfigFromEnv, createRateLimitOptionsHandler } from '../middleware/rate-limit';
import type { RateLimitConfig, RateLimitedRequest } from '../middleware/rate-limit';
import { type Logger } from '../types/logger';

type RawBodyIncomingMessage = IncomingMessage & {
  originalUrl?: string;
  rawBody?: Buffer;
  rawBodyParseError?: SyntaxError | null;
};

type ConfigureSecurityMiddlewareDeps = {
  corsOptions: CorsOptions;
  nodeEnv: string;
  requestLogger: RequestHandler;
  logger: Logger;
  rateLimitConfig?: RateLimitConfig;
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

export const configureSecurityMiddleware = (
  app: Application,
  { corsOptions, nodeEnv, requestLogger, logger, rateLimitConfig }: ConfigureSecurityMiddlewareDeps,
) => {
  const resolvedRateLimitConfig = rateLimitConfig ?? buildRateLimitConfigFromEnv();
  const rateLimitWindowMs = resolvedRateLimitConfig.windowMs;
  const rateLimitMaxRequests = resolvedRateLimitConfig.maxRequests;

  const rateLimitOptionsHandler = createRateLimitOptionsHandler(resolvedRateLimitConfig);

  const limiter = rateLimit({
    windowMs: rateLimitWindowMs,
    max: rateLimitMaxRequests,
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

      attachRateLimitHeaders(rateLimitedReq, res, resolvedRateLimitConfig);

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

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  app.use(rateLimitOptionsHandler);

  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
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

  if (nodeEnv === 'production') {
    app.use('/api', limiter);
  }

  app.use('/api', (req, res, next) => {
    attachRateLimitHeaders(req as RateLimitedRequest, res, resolvedRateLimitConfig);
    next();
  });

  logger.info('Security middleware configured', {
    nodeEnv,
    rateLimitWindowMs,
    rateLimitMaxRequests,
  });
};
