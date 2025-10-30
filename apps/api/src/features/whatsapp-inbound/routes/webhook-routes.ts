import { Router } from 'express';

import { asyncHandler } from '../../../middleware/error-handler';
import {
  handleWhatsAppWebhook,
  handleVerification,
  verifyWhatsAppWebhookRequest,
  webhookRateLimiter,
} from './webhook-controller';

const webhookRouter: Router = Router();
const integrationWebhookRouter: Router = Router();

webhookRouter.post(
  '/whatsapp',
  webhookRateLimiter,
  asyncHandler(verifyWhatsAppWebhookRequest),
  asyncHandler(handleWhatsAppWebhook)
);
integrationWebhookRouter.post(
  '/whatsapp/webhook',
  webhookRateLimiter,
  asyncHandler(verifyWhatsAppWebhookRequest),
  asyncHandler(handleWhatsAppWebhook)
);

webhookRouter.get('/whatsapp', handleVerification);

export { integrationWebhookRouter as whatsappIntegrationWebhookRouter, webhookRouter as whatsappWebhookRouter };
