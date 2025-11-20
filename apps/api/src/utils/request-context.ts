import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { logger as defaultLogger } from '../config/logger';

type RequestContextLogger = typeof defaultLogger;

export interface RequestContext<TRequest extends Request = Request, TResponse extends Response = Response> {
  requestId: string;
  req: TRequest;
  res: TResponse;
  logger: RequestContextLogger;
}

export interface WithRequestContextOptions {
  scope?: string;
  logger?: RequestContextLogger;
  logStart?: boolean;
  logFinish?: boolean;
}

const resolveRequestId = (req: Request): string => {
  const headerValue = req.get('x-request-id')?.trim();

  if (typeof req.rid === 'string' && req.rid.trim().length > 0) {
    return req.rid;
  }

  if (headerValue && headerValue.length > 0) {
    return headerValue;
  }

  return randomUUID();
};

const ensureRequestIdentifiers = (req: Request, res: Response): string => {
  const requestId = resolveRequestId(req);

  if (typeof req.rid !== 'string' || req.rid.length === 0) {
    req.rid = requestId;
  }

  if (!res.getHeader('x-request-id')) {
    res.setHeader('x-request-id', requestId);
  }

  if (!res.locals.requestId) {
    res.locals.requestId = requestId;
  }

  return requestId;
};

const buildLogContext = (req: Request, requestId: string, scope: string) => ({
  scope,
  requestId,
  method: req.method,
  path: req.originalUrl ?? req.path,
  tenantId: req.user?.tenantId ?? null,
});

export const withRequestContext = <TRequest extends Request = Request, TResponse extends Response = Response>(
  handler: (context: RequestContext<TRequest, TResponse>) => Promise<void> | void,
  options: WithRequestContextOptions = {}
): RequestHandler => {
  const scope = options.scope ?? 'http';
  const logStart = options.logStart ?? true;
  const logFinish = options.logFinish ?? true;

  return async (req: Request, res: Response, next: NextFunction) => {
    const requestId = ensureRequestIdentifiers(req, res);
    const startedAt = Date.now();
    const scopedLogger = options.logger ?? defaultLogger;
    const logContext = buildLogContext(req, requestId, scope);

    if (logStart) {
      scopedLogger.info(`[${scope}] Request received`, logContext);
    }

    try {
      await handler({ req: req as TRequest, res: res as TResponse, requestId, logger: scopedLogger });
    } catch (error) {
      scopedLogger.error(`[${scope}] Handler failed`, { ...logContext, error });
      next(error);
      return;
    }

    if (logFinish) {
      scopedLogger.info(`[${scope}] Request completed`, {
        ...logContext,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    }
  };
};

