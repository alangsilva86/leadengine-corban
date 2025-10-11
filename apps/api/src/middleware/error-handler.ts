import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  DomainError,
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
} from '@ticketz/core';
import { logger } from '../config/logger';
import { WhatsAppBrokerError } from '../services/whatsapp-broker-client';
import { RateLimitError } from '../utils/rate-limit';
import { PhoneNormalizationError } from '../utils/phone';

const readErrorDetails = (err: unknown): unknown => {
  if (typeof err === 'object' && err !== null && 'details' in err) {
    return (err as { details?: unknown }).details;
  }
  return undefined;
};

const readErrorCode = (err: unknown): string | undefined => {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
};

const hasErrorName = (error: unknown, expected: string): boolean => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === expected
  );
};

type WhatsAppBrokerErrorShape = {
  status?: number;
  code?: string;
  requestId?: string | null;
  brokerStatus?: number;
};

const toWhatsAppBrokerError = (
  error: unknown
): (WhatsAppBrokerError & WhatsAppBrokerErrorShape) | (Error & WhatsAppBrokerErrorShape) | null => {
  if (
    error instanceof WhatsAppBrokerError ||
    hasErrorName(error, 'WhatsAppBrokerError')
  ) {
    return error as WhatsAppBrokerError & WhatsAppBrokerErrorShape;
  }

  return null;
};

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
}

const WHATSAPP_BROKER_ERROR_MESSAGES: Record<string, string> = {
  REQUEST_TIMEOUT: 'WhatsApp broker request timed out',
  RATE_LIMIT_EXCEEDED: 'WhatsApp broker request rate limit exceeded',
  INVALID_SESSION: 'WhatsApp session is invalid or unavailable',
  SESSION_NOT_FOUND: 'WhatsApp session not found',
  MESSAGE_REJECTED: 'WhatsApp message was rejected by the broker',
  BROKER_AUTH: 'WhatsApp broker authentication failed',
  BROKER_ERROR: 'WhatsApp broker request failed',
  INTERNAL_ERROR: 'WhatsApp broker encountered an internal error',
};

const getWhatsAppBrokerMessage = (code: string | undefined): { code: string; message: string } => {
  const normalizedCode = (code || 'BROKER_ERROR').toUpperCase();
  const message =
    WHATSAPP_BROKER_ERROR_MESSAGES[normalizedCode] ||
    WHATSAPP_BROKER_ERROR_MESSAGES.BROKER_ERROR ||
    'WhatsApp broker request failed';

  return { code: normalizedCode, message };
};

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Se a resposta já foi enviada, delegar para o handler padrão do Express
  if (res.headersSent) {
    return next(error);
  }

  let apiError: ApiError;
  const brokerError = toWhatsAppBrokerError(error);
  const requestId = req.rid ?? null;

  // Tratar diferentes tipos de erro
  if (error instanceof ValidationError || hasErrorName(error, 'ValidationError')) {
    apiError = {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: error.message,
      details: readErrorDetails(error),
    };
  } else if (error instanceof NotFoundError || hasErrorName(error, 'NotFoundError')) {
    apiError = {
      status: 404,
      code: 'NOT_FOUND',
      message: error.message,
      details: readErrorDetails(error),
    };
  } else if (error instanceof ConflictError || hasErrorName(error, 'ConflictError')) {
    apiError = {
      status: 409,
      code: 'CONFLICT',
      message: error.message,
      details: readErrorDetails(error),
    };
  } else if (error instanceof UnauthorizedError || hasErrorName(error, 'UnauthorizedError')) {
    apiError = {
      status: 401,
      code: 'UNAUTHORIZED',
      message: error.message,
    };
  } else if (error instanceof ForbiddenError || hasErrorName(error, 'ForbiddenError')) {
    apiError = {
      status: 403,
      code: 'FORBIDDEN',
      message: error.message,
    };
  } else if (error instanceof DomainError || hasErrorName(error, 'DomainError')) {
    apiError = {
      status: 400,
      code: readErrorCode(error) ?? 'DOMAIN_ERROR',
      message: error.message,
      details: readErrorDetails(error),
    };
  } else if (error instanceof RateLimitError) {
    apiError = {
      status: 429,
      code: 'RATE_LIMITED',
      message: error.message,
      details: { retryAfterMs: error.retryAfterMs },
    };
  } else if (error instanceof PhoneNormalizationError) {
    apiError = {
      status: 400,
      code: 'INVALID_PHONE',
      message: error.message,
    };
  } else if (brokerError) {
    const { code, message } = getWhatsAppBrokerMessage(brokerError.code);
    const status = Number.isInteger(brokerError.brokerStatus)
      ? (brokerError.brokerStatus as number)
      : 502;

    apiError = {
      status: status >= 400 && status < 600 ? status : 502,
      code,
      message,
      details: brokerError.requestId ? { requestId: brokerError.requestId } : undefined,
    };
  } else if (error instanceof ZodError) {
    apiError = {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
    };
  } else if (error.name === 'JsonWebTokenError') {
    apiError = {
      status: 401,
      code: 'INVALID_TOKEN',
      message: 'Invalid authentication token',
    };
  } else if (error.name === 'TokenExpiredError') {
    apiError = {
      status: 401,
      code: 'TOKEN_EXPIRED',
      message: 'Authentication token has expired',
    };
  } else if (error.name === 'MulterError') {
    apiError = {
      status: 400,
      code: 'FILE_UPLOAD_ERROR',
      message: error.message,
    };
  } else {
    // Erro interno do servidor
    apiError = {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : error.message,
    };
  }

  // Incluir stack trace apenas em desenvolvimento
  if (process.env.NODE_ENV !== 'production' && apiError.status >= 500) {
    apiError.stack = error.stack;
  }

  // Log do erro
  const logLevel = apiError.status >= 500 ? 'error' : 'warn';
  const logPayload = (() => {
    if (brokerError) {
      return {
        error: {
          status: apiError.status,
          code: apiError.code,
          requestId: brokerError.requestId ?? null,
        },
      };
    }

    return {
      error: {
        status: apiError.status,
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
        stack: error.stack,
      },
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        params: req.params,
        query: req.query,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
    };
  })();

  logger[logLevel]('API Error', { requestId, ...logPayload });

  const consolePayload = {
    level: logLevel,
    msg: 'api_error',
    requestId,
    status: apiError.status,
    code: apiError.code,
    method: req.method,
    path: req.originalUrl ?? req.path,
    details: apiError.details,
    stack: apiError.status >= 500 ? error.stack : undefined,
  };

  try {
    if (apiError.status >= 500) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify(consolePayload));
    } else {
      // eslint-disable-next-line no-console
      console.warn(JSON.stringify(consolePayload));
    }
  } catch {
    // Falha ao serializar? ignora — resposta já será enviada.
  }

  // Enviar resposta de erro
  if (requestId) {
    res.setHeader('X-Request-Id', requestId);
  }

  res.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      details: apiError.details,
      stack: apiError.stack,
      requestId,
    },
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  });
};

// Middleware para capturar erros assíncronos
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
