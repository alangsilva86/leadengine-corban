import type { Request } from 'express';

export const readQueueParam = (req: Request): string | null => {
  const queueId = (req.query.queueId ?? req.body?.queueId) as string | undefined;
  return queueId?.trim() ? queueId.trim() : null;
};
