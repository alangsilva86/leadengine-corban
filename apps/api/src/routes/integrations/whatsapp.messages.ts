import { Router, type Request, type Response } from 'express';
import { ZodError } from 'zod';

import { asyncHandler } from '../../middleware/error-handler';
import { requireTenant } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';
import { SendByInstanceSchema, normalizePayload } from '../../dtos/message-schemas';
import { sendAdHoc } from '../../services/ticket-service';
import { NotFoundError } from '@ticketz/core';

const router = Router();

router.post(
  '/integrations/whatsapp/instances/:instanceId/messages',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const { instanceId } = req.params;
    const tenantId = req.user!.tenantId;

    const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

    if (!instance || instance.tenantId !== tenantId) {
      throw new NotFoundError('WhatsAppInstance', instanceId);
    }

    const isConnected =
      instance.connected ?? (typeof instance.status === 'string' && instance.status === 'connected');

    if (!isConnected) {
      res.status(409).json({
        success: false,
        error: {
          code: 'INSTANCE_DISCONNECTED',
          message: 'A instância de WhatsApp está desconectada.',
          details: {
            status: instance.status ?? null,
            connected: instance.connected ?? null,
          },
        },
      });
      return;
    }

    let parsed;

    try {
      parsed = SendByInstanceSchema.parse(req.body ?? {});
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Corpo da requisição inválido.',
            details: error.issues,
          },
        });
        return;
      }
      throw error;
    }

    const idempotencyKey = parsed.idempotencyKey ?? req.get('Idempotency-Key') ?? undefined;
    const payload = normalizePayload(parsed.payload);

    const response = await sendAdHoc({
      tenantId,
      operatorId: req.user!.id,
      instanceId: instance.id,
      to: parsed.to,
      payload,
      idempotencyKey,
    });

    res.status(202).json(response);
  })
);

export { router as whatsappMessagesRouter };
