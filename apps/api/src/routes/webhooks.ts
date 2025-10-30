import { Router, type Request, type Response } from 'express';

import { asyncHandler } from '../middleware/error-handler';
import { logger } from '../config/logger';
import {
  handleVerification,
  handleWhatsAppWebhook,
  verifyWhatsAppWebhookRequest,
  webhookRateLimiter,
} from '../features/whatsapp-inbound/routes/webhook-controller';

const router: Router = Router();
const integrationWebhooksRouter: Router = Router();

// Delegates WhatsApp traffic to the feature controller (signature validation + normalization)
router.post(
  '/whatsapp',
  webhookRateLimiter,
  asyncHandler(verifyWhatsAppWebhookRequest),
  asyncHandler(handleWhatsAppWebhook)
);

integrationWebhooksRouter.post(
  '/whatsapp/webhook',
  webhookRateLimiter,
  asyncHandler(verifyWhatsAppWebhookRequest),
  asyncHandler(handleWhatsAppWebhook)
);

router.get('/whatsapp', handleVerification);

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
