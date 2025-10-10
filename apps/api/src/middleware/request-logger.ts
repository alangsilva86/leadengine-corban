import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    const userId = (req as any).user?.id ?? null;
    const tenantId = (req as any).user?.tenantId ?? (Array.isArray(req.headers['x-tenant-id'])
      ? req.headers['x-tenant-id'][0]
      : req.headers['x-tenant-id']) ?? null;
    const requestId = req.rid ?? null;

    logger.info('HTTP Request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      ip: req.ip,
      userAgent: req.get('User-Agent') || undefined,
      referer: req.get('Referer') || undefined,
      contentLength: res.get('Content-Length') || undefined,
      userId,
      tenantId,
      requestId,
    });
  });

  next();
};
