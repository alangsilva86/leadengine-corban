import { Router, type Request, type Response } from 'express';

import { asyncHandler } from '../middleware/error-handler';
import { logger } from '../config/logger';
import {
  whatsappIntegrationWebhookRouter,
  whatsappWebhookRouter,
} from '../features/whatsapp-inbound/routes/webhook-routes';

const router: Router = Router();
const integrationWebhooksRouter: Router = Router();

// Delegates WhatsApp traffic to the feature router (signature validation + normalization)
router.use('/', whatsappWebhookRouter);
integrationWebhooksRouter.use('/', whatsappIntegrationWebhookRouter);

// POST /api/webhooks/telephony - Webhook da URA/Telefonia
router.post(
  '/telephony',
  asyncHandler(async (req: Request, res: Response) => {
    const payload = req.body;

    logger.info('Telephony webhook received', { payload });

    // TODO: Processar webhook da URA

    res.json({
      success: true,
      message: 'Webhook processed',
    });
  })
);

// POST /api/webhooks/email - Webhook de email
router.post(
  '/email',
  asyncHandler(async (req: Request, res: Response) => {
    const payload = req.body;

    logger.info('Email webhook received', { payload });

    // TODO: Processar webhook de email

    res.json({
      success: true,
      message: 'Webhook processed',
    });
  })
);

export { router as webhooksRouter, integrationWebhooksRouter };
