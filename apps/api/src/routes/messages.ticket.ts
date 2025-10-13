import { Router, type Request, type Response } from 'express';
import { ZodError } from 'zod';

import { SendByTicketSchema, normalizePayload } from '@ticketz/contracts';
import { asyncHandler } from '../middleware/error-handler';
import { sendOnTicket } from '../services/ticket-service';

const router: Router = Router();

router.post(
  '/tickets/:ticketId/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    let parsed;

    try {
      parsed = SendByTicketSchema.parse(req.body ?? {});
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

    const headerIdempotency = (req.get('Idempotency-Key') || '').trim();
    if (!headerIdempotency) {
      res.locals.errorCode = 'IDEMPOTENCY_KEY_REQUIRED';
      res.status(409).json({
        success: false,
        error: {
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          message: 'Informe o cabeçalho Idempotency-Key para envios via ticket.',
        },
      });
      return;
    }

    if (headerIdempotency !== parsed.idempotencyKey) {
      res.locals.errorCode = 'IDEMPOTENCY_KEY_MISMATCH';
      res.status(409).json({
        success: false,
        error: {
          code: 'IDEMPOTENCY_KEY_MISMATCH',
          message: 'O Idempotency-Key do cabeçalho deve coincidir com o corpo da requisição.',
        },
      });
      return;
    }

    const idempotencyKey = parsed.idempotencyKey;
    const payload = normalizePayload(parsed.payload);
    const result = await sendOnTicket({
      operatorId: req.user?.id,
      ticketId,
      payload,
      instanceId: parsed.instanceId,
      idempotencyKey,
    });

    res.status(202).json(result);
  })
);

export { router as ticketMessagesRouter };
