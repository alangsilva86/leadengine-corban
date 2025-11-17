import { Router, type Request, type Response } from 'express';

import { SendByTicketSchema } from '@ticketz/contracts';
import { asyncHandler } from '../middleware/error-handler';
import { sendOnTicket } from '../services/ticket-service';
import { validateMessageSendRequest } from './messages/shared';

const router: Router = Router();

router.post(
  '/tickets/:ticketId/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const validationResult = await validateMessageSendRequest({
      schema: SendByTicketSchema,
      req,
      res,
      onValid: ({ trimmedHeaderIdempotencyKey, parsed, res }) => {
        const headerIdempotency = trimmedHeaderIdempotencyKey ?? '';
        if (!headerIdempotency) {
          res.locals.errorCode = 'IDEMPOTENCY_KEY_REQUIRED';
          res.status(409).json({
            success: false,
            error: {
              code: 'IDEMPOTENCY_KEY_REQUIRED',
              message: 'Informe o cabeçalho Idempotency-Key para envios via ticket.',
            },
          });
          return false;
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
          return false;
        }

        return true;
      },
    });

    if (!validationResult) {
      return;
    }

    const { parsed, payload, idempotencyKey } = validationResult;
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
