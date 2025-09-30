import { createHmac, timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { logger } from '../config/logger';
import {
  enqueueWhatsAppBrokerEvents,
  normalizeWhatsAppBrokerEvent,
  type WhatsAppBrokerEvent,
} from '../workers/whatsapp-event-queue';

const router: Router = Router();
const integrationWebhooksRouter: Router = Router();

const getWebhookApiKey = (): string => {
  const explicitKey = (process.env.WHATSAPP_WEBHOOK_API_KEY || '').trim();
  if (explicitKey.length > 0) {
    return explicitKey;
  }

  return (process.env.WHATSAPP_BROKER_API_KEY || '').trim();
};

const getWebhookSignatureSecret = (): string => {
  const explicitSecret = (process.env.WHATSAPP_WEBHOOK_SIGNATURE_SECRET || '').trim();
  if (explicitSecret.length > 0) {
    return explicitSecret;
  }

  return getWebhookApiKey();
};

const safeCompare = (a: string, b: string): boolean => {
  if (!a || !b) {
    return false;
  }

  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  try {
    return timingSafeEqual(bufferA, bufferB);
  } catch (error) {
    logger.warn('Failed to safely compare secrets', { error });
    return false;
  }
};

const verifyWebhookSignature = (signature: string | null, rawBody: Buffer | undefined): boolean => {
  if (!signature) {
    return true;
  }

  const secret = getWebhookSignatureSecret();
  if (!secret) {
    logger.warn('WhatsApp webhook signature received but no secret configured');
    return true;
  }

  if (!rawBody) {
    logger.warn('WhatsApp webhook signature received but raw body is unavailable');
    return false;
  }

  try {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const provided = signature.trim().toLowerCase();
    const normalizedExpected = expected.toLowerCase();

    const providedBuffer = Buffer.from(provided, 'hex');
    const expectedBuffer = Buffer.from(normalizedExpected, 'hex');

    const providedIsValidHex = providedBuffer.length > 0 && providedBuffer.length * 2 === provided.length;
    const expectedIsValidHex = expectedBuffer.length > 0 && expectedBuffer.length * 2 === normalizedExpected.length;

    if (!providedIsValidHex || !expectedIsValidHex) {
      return false;
    }

    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    try {
      return timingSafeEqual(providedBuffer, expectedBuffer);
    } catch (error) {
      logger.warn('Failed to safely compare webhook signatures', { error });
      return false;
    }
  } catch (error) {
    logger.warn('Failed to verify WhatsApp webhook signature', { error });
    return false;
  }
};

const handleWhatsAppWebhook = async (req: Request, res: Response) => {
  const providedApiKeyHeader = req.header('x-api-key');
  const providedApiKey = typeof providedApiKeyHeader === 'string' ? providedApiKeyHeader.trim() : '';
  const expectedApiKey = getWebhookApiKey();

  if (!expectedApiKey || !safeCompare(providedApiKey, expectedApiKey)) {
    logger.warn('WhatsApp webhook rejected due to invalid API key');
    res.status(401).json({ ok: false });
    return;
  }

  const signatureHeader = req.header('x-signature-sha256');
  if (!verifyWebhookSignature(signatureHeader ?? null, req.rawBody)) {
    logger.warn('WhatsApp webhook rejected due to invalid signature');
    res.status(401).json({ ok: false });
    return;
  }

  const payload = req.body ?? {};

  logger.info('WhatsApp webhook received', { payload });

  const rawEvents = Array.isArray((payload as { events?: unknown[] })?.events)
    ? (payload as { events: unknown[] }).events
    : [];

  if (rawEvents.length > 0) {
    const normalizedEvents = rawEvents
      .map((event) => normalizeWhatsAppBrokerEvent(event as Record<string, unknown>))
      .filter((event): event is WhatsAppBrokerEvent => Boolean(event));

    if (normalizedEvents.length > 0) {
      enqueueWhatsAppBrokerEvents(normalizedEvents);
      logger.info('Queued WhatsApp webhook events', {
        received: rawEvents.length,
        queued: normalizedEvents.length,
      });
    } else {
      logger.warn('WhatsApp webhook payload did not contain supported events', {
        received: rawEvents.length,
      });
    }
  }

  res.json({ ok: true });
};

// POST /api/webhooks/whatsapp - Webhook do WhatsApp
router.post('/whatsapp', asyncHandler(handleWhatsAppWebhook));

integrationWebhooksRouter.post('/whatsapp/webhook', asyncHandler(handleWhatsAppWebhook));

// GET /api/webhooks/whatsapp - Verificação do webhook (Meta)
router.get(
  '/whatsapp',
  asyncHandler(async (req: Request, res: Response) => {
    const mode = typeof req.query['hub.mode'] === 'string' ? req.query['hub.mode'] : undefined;
    const token =
      typeof req.query['hub.verify_token'] === 'string' ? req.query['hub.verify_token'] : undefined;
    const challenge =
      typeof req.query['hub.challenge'] === 'string' ? req.query['hub.challenge'] : undefined;

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'your-verify-token';

    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('WhatsApp webhook verified');
      res.status(200).send(challenge ?? '');
    } else {
      logger.warn('WhatsApp webhook verification failed');
      res.status(403).send('Forbidden');
    }
  })
);

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
