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

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
}

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

  // Tratar diferentes tipos de erro
  if (error instanceof ValidationError || error.name === 'ValidationError') {
    apiError = {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: error.message,
      details: readErrorDetails(error),
    };
  } else if (error instanceof NotFoundError) {
    apiError = {
      status: 404,
      code: 'NOT_FOUND',
      message: error.message,
      details: readErrorDetails(error),
    };
  } else if (error instanceof ConflictError) {
    apiError = {
      status: 409,
      code: 'CONFLICT',
      message: error.message,
      details: readErrorDetails(error),
    };
  } else if (error instanceof UnauthorizedError) {
    apiError = {
      status: 401,
      code: 'UNAUTHORIZED',
      message: error.message,
    };
  } else if (error instanceof ForbiddenError) {
    apiError = {
      status: 403,
      code: 'FORBIDDEN',
      message: error.message,
    };
  } else if (error instanceof DomainError) {
    apiError = {
      status: 400,
      code: readErrorCode(error) ?? 'DOMAIN_ERROR',
      message: error.message,
      details: readErrorDetails(error),
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
  logger[logLevel]('API Error', {
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
  });

  // Enviar resposta de erro
  res.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      details: apiError.details,
      stack: apiError.stack,
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
