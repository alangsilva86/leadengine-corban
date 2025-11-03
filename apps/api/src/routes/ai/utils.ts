import type { Request } from 'express';

export const readQueueParam = (req: Request): string | null => {
  const queueId = (req.query.queueId ?? req.body?.queueId) as string | undefined;
  return queueId?.trim() ? queueId.trim() : null;
};

export const ensureTenantId = (req: Request): string => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    const error = new Error('Tenant não autenticado.');
    (error as Error & { status?: number }).status = 401;
    throw error;
  }
  return tenantId;
};
