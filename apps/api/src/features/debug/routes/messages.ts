import { Router, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';

import { asyncHandler } from '../../../middleware/error-handler';
import { requireTenant } from '../../../middleware/auth';
import { prisma } from '../../../lib/prisma';
import { mapPassthroughMessage } from '@ticketz/storage';

const router: Router = Router();

const normalizeQueryValue = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    return normalizeQueryValue(value[0]);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildWhereClause = (
  tenantId: string,
  { chatId, direction }: { chatId: string | null; direction: 'INBOUND' | 'OUTBOUND' | null }
): Prisma.MessageWhereInput => {
  const where: Prisma.MessageWhereInput = {
    tenantId,
  };

  if (direction) {
    where.direction = direction;
  }

  if (chatId) {
    where.OR = [
      { metadata: { path: ['chatId'], string_contains: chatId } },
      { metadata: { path: ['remoteJid'], string_contains: chatId } },
      { metadata: { path: ['passthrough', 'chatId'], string_contains: chatId } },
    ];
  }

  return where;
};

router.get(
  '/debug/messages',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const rawLimit = normalizeQueryValue(req.query.limit);
    const limitCandidate = rawLimit ? Number(rawLimit) : NaN;
    let limit = Number.isFinite(limitCandidate) && limitCandidate > 0 ? Math.floor(limitCandidate) : 50;
    limit = Math.min(Math.max(limit, 1), 200);

    const normalizedDirection = normalizeQueryValue(req.query.direction);
    const directionFilter =
      normalizedDirection && normalizedDirection.toLowerCase() === 'outbound'
        ? 'OUTBOUND'
        : normalizedDirection && normalizedDirection.toLowerCase() === 'inbound'
          ? 'INBOUND'
          : null;

    const chatId = normalizeQueryValue(req.query.chatId);

    const where = buildWhereClause(tenantId, { chatId, direction: directionFilter });

    const records = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const payload = records.map((record) => mapPassthroughMessage(record));

    res.json({
      success: true,
      data: payload,
    });
  })
);

export { router as debugMessagesRouter };
