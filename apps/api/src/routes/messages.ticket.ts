import { Router, type Request, type Response } from 'express';

import { findTicketById as storageFindTicketById } from '@ticketz/storage';

import { SendByTicketSchema } from '@ticketz/contracts';
import { asyncHandler } from '../middleware/error-handler';
import { sendOnTicket } from '../services/ticket-service';
import { validateMessageSendRequest } from './messages/shared';
import { requireTenant } from '../middleware/auth';
import { resolveRequestTenantId } from '../services/tenant-service';

const router: Router = Router();

router.post(
  '/tickets/:ticketId/messages',
  requireTenant,
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
    const tenantId = resolveRequestTenantId(req);
    const ticket = await storageFindTicketById(tenantId, ticketId);

    if (!ticket) {
      const requestId = req.rid ?? null;
      res.locals.errorCode = 'TICKET_NOT_FOUND';
      res.status(404).json({
        success: false,
        error: {
          code: 'TICKET_NOT_FOUND',
          message: 'Ticket não encontrado ou inacessível.',
          requestId,
        },
      });
      return;
    }

    if (ticket.tenantId !== tenantId) {
      const requestId = req.rid ?? null;
      res.locals.errorCode = 'TICKET_FORBIDDEN';
      res.status(403).json({
        success: false,
        error: {
          code: 'TICKET_FORBIDDEN',
          message: 'Ticket não pertence a este workspace.',
          requestId,
        },
      });
      return;
    }

    const result = await sendOnTicket({
      operatorId: req.user?.id,
      ticketId,
      payload,
      instanceId: parsed.instanceId,
      idempotencyKey,
      tenantId,
    });

    res.status(202).json(result);
  })
);

export { router as ticketMessagesRouter };
