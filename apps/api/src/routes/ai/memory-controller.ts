import { body } from 'express-validator';
import type { Prisma } from '@prisma/client';

import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { upsertAiMemory } from '@ticketz/storage';
import { logger } from '../../config/logger';
import type { Request, Response } from 'express';

const memoryUpsertValidators = [
  body('contactId').isString().notEmpty(),
  body('topic').isString().notEmpty(),
  body('content').isString().notEmpty(),
  body('metadata').optional({ nullable: true }).isObject(),
  body('expiresAt').optional({ nullable: true }).isISO8601(),
];

export const memoryUpsertMiddlewares = [
  requireTenant,
  ...memoryUpsertValidators,
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId!;
    const { contactId, topic, content, metadata = null, expiresAt } = req.body as {
      contactId: string;
      topic: string;
      content: string;
      metadata?: Record<string, unknown> | null;
      expiresAt?: string | null;
    };

    const record = await upsertAiMemory({
      tenantId,
      contactId,
      topic,
      content,
      metadata: (metadata ?? null) as Prisma.JsonValue | null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    logger.info('crm.ai.memory.upserted', {
      tenantId,
      contactId,
      topic,
    });

    return res.json({
      success: true,
      data: {
        id: record.id,
        contactId: record.contactId,
        topic: record.topic,
        content: record.content,
        metadata: record.metadata,
        expiresAt: record.expiresAt,
        updatedAt: record.updatedAt,
      },
    });
  }),
];
