import { Router, type Request, type Response } from 'express';
import { ZodError } from 'zod';

import { asyncHandler } from '../middleware/error-handler';
import { SendByContactSchema, normalizePayload } from '../dtos/message-schemas';
import { sendToContact } from '../services/ticket-service';

const router: Router = Router();

router.post(
  '/contacts/:contactId/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const { contactId } = req.params;
    let parsed;

    try {
      parsed = SendByContactSchema.parse(req.body ?? {});
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

    const normalizedPayload = normalizePayload(parsed.payload);
    const idempotencyKey = parsed.idempotencyKey ?? req.get('Idempotency-Key') ?? undefined;

    const response = await sendToContact({
      operatorId: req.user?.id,
      contactId,
      instanceId: parsed.instanceId,
      to: parsed.to,
      payload: normalizedPayload,
      idempotencyKey,
    });

    res.status(202).json(response);
  })
);

export { router as contactMessagesRouter };
