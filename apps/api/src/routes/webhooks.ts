import { Router } from 'express';

import { asyncHandler } from '../middleware/error-handler';
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

router.post('/email', (_req, res) => res.sendStatus(501));

export { router as webhooksRouter, integrationWebhooksRouter };
