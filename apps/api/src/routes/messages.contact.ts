import { Router, type Request, type Response } from 'express';

import { SendByContactSchema } from '@ticketz/contracts';
import { asyncHandler } from '../middleware/error-handler';
import { sendToContact } from '../services/ticket-service';
import { validateMessageSendRequest } from './messages/shared';

const router: Router = Router();

router.post(
  '/contacts/:contactId/messages',
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

    const response = await sendToContact({
      operatorId: req.user?.id,
      contactId,
      instanceId: parsed.instanceId,
      to: parsed.to,
      payload,
      idempotencyKey,
    });

    res.status(202).json(response);
  })
);

export { router as contactMessagesRouter };
