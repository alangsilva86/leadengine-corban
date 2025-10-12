import { Router, type Request, type Response } from 'express';
import { ZodError } from 'zod';

import { asyncHandler } from '../middleware/error-handler';
import { SendByTicketSchema, normalizePayload } from '../dtos/message-schemas';
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

    const idempotencyKey = parsed.idempotencyKey ?? req.get('Idempotency-Key') ?? undefined;
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
