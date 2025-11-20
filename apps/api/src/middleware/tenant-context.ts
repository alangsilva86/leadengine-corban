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
  const tenantId = resolveRequestTenantId(req);
  req.tenantContext = { tenantId };
  next();
};

export const resolveTenantContext = (req: Request): { tenantId: string } =>
  req.tenantContext ?? { tenantId: resolveRequestTenantId(req) };
