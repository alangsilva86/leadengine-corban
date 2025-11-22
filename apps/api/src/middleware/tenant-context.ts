import type { Request, RequestHandler } from 'express';

import { resolveRequestTenantId } from '../services/tenant-service';

declare module 'express-serve-static-core' {
  interface Request {
    tenantContext?: {
      tenantId: string;
    };
  }
}

export const withTenantContext: RequestHandler = (req, _res, next) => {
  const requestedTenantId = (req.body as { tenantId?: unknown } | undefined)?.tenantId;
  const tenantId = resolveRequestTenantId(req, requestedTenantId);
  req.tenantContext = { tenantId };
  next();
};

export const resolveTenantContext = (req: Request): { tenantId: string } =>
  req.tenantContext ?? {
    tenantId: resolveRequestTenantId(
      req,
      (req.body as { tenantId?: unknown } | undefined)?.tenantId ??
        (req.query as { tenantId?: unknown } | undefined)?.tenantId,
    ),
  };
