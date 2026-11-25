import { Router, type Request, type Response } from 'express';

import { SendByContactSchema } from '@ticketz/contracts';
import { requireTenant } from '../middleware/auth';
import { asyncHandler } from '../middleware/error-handler';
import { sendToContact } from '../services/ticket-service';
import { validateMessageSendRequest } from './messages/shared';
import { respondWithSendFailure } from './messages/send-errors';

const router: Router = Router();

router.post(
  '/contacts/:contactId/messages',
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const { contactId } = req.params;
    const validationResult = await validateMessageSendRequest({
      schema: SendByContactSchema,
      req,
      res,
    });

    if (!validationResult) {
      return;
    }

    const { parsed, payload, idempotencyKey } = validationResult;

    let response: Awaited<ReturnType<typeof sendToContact>>;
    try {
      response = await sendToContact({
        tenantId: req.user!.tenantId,
        operatorId: req.user!.id,
        contactId,
        instanceId: parsed.instanceId,
        to: parsed.to,
        payload,
        idempotencyKey,
      });
    } catch (error) {
      const context = { tenantId: req.user!.tenantId, contactId, instanceId: parsed.instanceId ?? null };
      if (respondWithSendFailure(req, res, error, context)) {
        return;
      }
      throw error;
    }

    res.status(202).json(response);
  })
);

export { router as contactMessagesRouter };
