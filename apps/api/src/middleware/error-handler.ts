import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  DomainError,
  ValidationError,
  NotFoundError,
  ConflictError,
  ServiceUnavailableError,
  UnauthorizedError,
  ForbiddenError,
} from '@ticketz/core';
import { logger } from '../config/logger';
import { WhatsAppBrokerError } from '../services/whatsapp-broker-client';
import { RateLimitError } from '../utils/rate-limit';
import { CircuitBreakerOpenError } from '../utils/circuit-breaker';
import { PhoneNormalizationError } from '../utils/phone';
import { DatabaseDisabledError } from '../lib/prisma';
import { HandledError } from '../utils/http-validation';

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

/**
 * Erros do body-parser (JSON malformado, corpo grande demais…) chegam com `type` e `status` 4xx.
 * Sem este tratamento caíam no ramo genérico e viravam 500.
 */
const BODY_PARSER_ERRORS: Record<string, { status: number; code: string; message: string }> = {
  'entity.parse.failed': { status: 400, code: 'INVALID_JSON', message: 'O corpo da requisição não é um JSON válido.' },
  'entity.too.large': { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'O corpo da requisição é grande demais.' },
  'encoding.unsupported': { status: 415, code: 'UNSUPPORTED_ENCODING', message: 'Codificação do corpo não suportada.' },
  'charset.unsupported': { status: 415, code: 'UNSUPPORTED_CHARSET', message: 'Charset do corpo não suportado.' },
  'request.aborted': { status: 400, code: 'REQUEST_ABORTED', message: 'A requisição foi interrompida.' },
};

const readBodyParserError = (error: unknown): ApiError | null => {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { type?: unknown; status?: unknown; statusCode?: unknown; expose?: unknown };
  const type = typeof candidate.type === 'string' ? candidate.type : null;
  if (!type) return null;
  const known = BODY_PARSER_ERRORS[type];
  if (known) return { ...known };
  const status = typeof candidate.status === 'number' ? candidate.status : candidate.statusCode;
  if (candidate.expose === true && typeof status === 'number' && status >= 400 && status < 500) {
    return { status, code: 'BAD_REQUEST', message: 'Requisição inválida.' };
  }
  return null;
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

  const bodyParserError = readBodyParserError(error);

  // Tratar diferentes tipos de erro
  if (bodyParserError) {
    apiError = bodyParserError;
  } else if (error instanceof HandledError || hasErrorName(error, 'HandledError')) {
    const handled = error as unknown as HandledError & {
      status?: number;
      code?: string;
      details?: unknown;
    };
    apiError = {
      status: handled.status ?? 400,
      code: handled.code ?? 'HANDLED_ERROR',
      message: error.message,
      details: readErrorDetails(error) ?? handled.details,
    };
  } else if (error instanceof ValidationError || hasErrorName(error, 'ValidationError')) {
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
  } else if (
    error instanceof ForbiddenError ||
    hasErrorName(error, 'ForbiddenError') ||
    // TenantAccessError (@ticketz/storage) é um DomainError com code FORBIDDEN; sem este ramo caía no
    // fallback de DomainError e respondia 400 a tentativas de acesso a outro tenant.
    hasErrorName(error, 'TenantAccessError')
  ) {
    apiError = {
      status: 403,
      code: 'FORBIDDEN',
      message: error.message,
    };
  } else if (
    error instanceof ServiceUnavailableError ||
    hasErrorName(error, 'ServiceUnavailableError')
  ) {
    apiError = {
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: error.message,
      details: readErrorDetails(error),
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
  } else if (error instanceof CircuitBreakerOpenError) {
    apiError = {
      status: 423,
      code: 'WHATSAPP_CIRCUIT_OPEN',
      message: 'Envios temporariamente bloqueados para esta instância.',
      details: error.retryAt ? { retryAt: error.retryAt } : undefined,
    };
  } else if (error instanceof DatabaseDisabledError || hasErrorName(error, 'DatabaseDisabledError')) {
    const context = error instanceof DatabaseDisabledError ? error.context : {};
    apiError = {
      status: 503,
      code: 'DATABASE_DISABLED',
      message: 'Database access is disabled in this environment.',
      details: context && Object.keys(context).length > 0 ? context : undefined,
    };
  } else if (readErrorCode(error) === 'STORAGE_DATABASE_DISABLED') {
    apiError = {
      status: 503,
      code: 'DATABASE_DISABLED',
      message: 'Database access is disabled in this environment.',
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
      details: error.issues.map(err => ({
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
  if (process.env.NODE_ENV !== 'production' && apiError.status >= 500 && error.stack) {
    apiError.stack = error.stack;
  }

  // Log do erro
  res.locals.errorCode = apiError.code;

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
        name: error.name,
      },
      request: {
        method: req.method,
        route: req.route?.path,
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
    route: req.route?.path,
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
