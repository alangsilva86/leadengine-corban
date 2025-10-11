import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

const toNumericTenant = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    const candidate = value[0];
    return typeof candidate === 'string' ? candidate : null;
  }
  return null;
};

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;

    const requestId = req.rid ?? null;
    const userId = (req as { user?: { id?: string | null } }).user?.id ?? null;
    const tenantId =
      (req as { user?: { tenantId?: string | null } }).user?.tenantId ??
      toNumericTenant(req.headers['x-tenant-id']);

    const payload = {
      level: 'info' as const,
      msg: 'http_request',
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
      referer: req.get('referer') ?? undefined,
      contentLength: res.get('content-length') ?? undefined,
      tenantId,
      userId,
    };

    // Mantém logging centralizado pelo winston
    logger.info('HTTP Request', payload);

    // Em produção, garantir saída direta no stdout para facilitar debugging
    try {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(payload));
    } catch {
      // noop – em caso de falha de serialização, preferimos não quebrar o fluxo
    }
  });

  next();
};
