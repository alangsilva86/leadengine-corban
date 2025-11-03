import type { Request } from 'express';
import createHttpError from 'http-errors';

export const readQueueParam = (req: Request): string | null => {
  const queueId = (req.query.queueId ?? req.body?.queueId) as string | undefined;
  return queueId?.trim() ? queueId.trim() : null;
};

export const ensureTenantId = (req: Request): string => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    throw createHttpError(401, 'Tenant não autenticado.');
  }
  return tenantId;
};
