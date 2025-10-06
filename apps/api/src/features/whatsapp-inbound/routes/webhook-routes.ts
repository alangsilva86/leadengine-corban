import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response } from 'express';

import { asyncHandler } from '../../../middleware/error-handler';
import { logger } from '../../../config/logger';
import { maskDocument, maskPhone } from '../../../lib/pii';
import { enqueueWhatsAppBrokerEvents } from '../queue/event-queue';
import { whatsappWebhookEventsCounter } from '../../../lib/metrics';
import {
  BrokerInboundEvent,
  BrokerWebhookInboundSchema,
} from '../schemas/broker-contracts';

const webhookRouter: Router = Router();
const integrationWebhookRouter: Router = Router();

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

const asRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const normalizeStringArray = (value: unknown): string[] | null => {
  if (!value) {
    return null;
  }

  const items = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const seen = new Set<string>();
  const normalized: string[] = [];

  items.forEach((entry) => {
    if (typeof entry !== 'string') {
      return;
    }
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  });

  return normalized.length > 0 ? normalized : null;
};

const handleWhatsAppWebhook = async (req: Request, res: Response) => {
  const providedApiKeyHeader = req.header('x-api-key');
  const providedApiKey = typeof providedApiKeyHeader === 'string' ? providedApiKeyHeader.trim() : '';
  const expectedApiKey = getWebhookApiKey();

  if (!expectedApiKey || !safeCompare(providedApiKey, expectedApiKey)) {
    logger.warn('WhatsApp webhook rejected due to invalid API key');
    whatsappWebhookEventsCounter.inc({ result: 'rejected', reason: 'invalid_api_key' });
    res.status(401).json({ ok: false });
    return;
  }

  const signatureHeader = req.header('x-signature-sha256');
  if (!verifyWebhookSignature(signatureHeader ?? null, req.rawBody)) {
    logger.warn('WhatsApp webhook rejected due to invalid signature');
    whatsappWebhookEventsCounter.inc({ result: 'rejected', reason: 'invalid_signature' });
    res.status(401).json({ ok: false });
    return;
  }

  const payload = req.body ?? {};

  const asArray = (input: unknown): Record<string, unknown>[] => {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
    }
    if (typeof input === 'object') {
      const candidate = input as Record<string, unknown>;
      if (Array.isArray(candidate.events)) {
        return candidate.events.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
      }
      return [candidate];
    }
    return [];
  };

  const rawEvents = asArray(payload);

  const normalizedEvents: BrokerInboundEvent[] = rawEvents
    .map((entry, index) => {
      const parsed = BrokerWebhookInboundSchema.safeParse(entry);
      if (!parsed.success) {
        logger.warn('🛑 [Webhook] Evento ignorado: payload inválido', {
          index,
          issues: parsed.error.issues,
        });
        return null;
      }

      const { instanceId, timestamp, message, from, metadata } = parsed.data;
      const rawMessage = asRecord(message);
      const rawMetadata = asRecord(metadata);

      const messageId =
        (typeof rawMessage.id === 'string' && rawMessage.id.trim().length > 0
          ? rawMessage.id.trim()
          : null) ?? randomUUID();

      const rawName = typeof from.name === 'string' ? from.name.trim() : null;
      const rawPushName = typeof from.pushName === 'string' ? from.pushName.trim() : null;
      const displayName = rawName && rawName.length > 0 ? rawName : rawPushName && rawPushName.length > 0 ? rawPushName : null;

      const contact = {
        phone: typeof from.phone === 'string' ? from.phone : null,
        name: displayName,
        document: typeof from.document === 'string' ? from.document : null,
        registrations: normalizeStringArray(from.registrations),
        avatarUrl: typeof from.avatarUrl === 'string' ? from.avatarUrl : null,
        pushName: rawPushName,
      };

      const normalizedTimestamp = (() => {
        if (timestamp) {
          return timestamp;
        }
        const numericTs = typeof rawMetadata.timestamp === 'number' ? rawMetadata.timestamp : null;
        if (numericTs && Number.isFinite(numericTs)) {
          const ms = numericTs > 1_000_000_000_000 ? numericTs : numericTs * 1000;
          try {
            return new Date(ms).toISOString();
          } catch (error) {
            logger.debug('⚠️ [Webhook] Falha ao normalizar timestamp numérico', { error, numericTs });
          }
        }
        return null;
      })();

      return {
        id: messageId,
        type: 'MESSAGE_INBOUND',
        instanceId,
        timestamp: normalizedTimestamp,
        cursor: null,
        payload: {
          instanceId,
          timestamp: normalizedTimestamp,
          contact,
          message: rawMessage,
          metadata: rawMetadata,
        },
      };
    })
    .filter((event): event is BrokerInboundEvent => event !== null);

  const queued = normalizedEvents.length;

  if (queued === 0) {
    logger.warn('📭 [Webhook] Nenhum evento elegível encontrado', {
      received: rawEvents.length,
    });
    whatsappWebhookEventsCounter.inc({ result: 'ignored', reason: 'no_inbound_event' });
    res.status(422).json({
      ok: false,
      error: {
        code: 'NO_INBOUND_EVENTS',
        message: 'Nenhum evento de mensagem inbound foi encontrado no payload informado.',
      },
    });
    return;
  }

  normalizedEvents.forEach((event) => {
    logger.info('📬 [Webhook] Evento inbound normalizado', {
      eventId: event.id,
      instanceId: event.instanceId,
      hasMessage: Boolean(event.payload.message),
      hasContact: Boolean(event.payload.contact?.phone || event.payload.contact?.name),
    });
  });

  enqueueWhatsAppBrokerEvents(
    normalizedEvents.map((event) => ({
      id: event.id,
      type: event.type,
      instanceId: event.instanceId,
      timestamp: event.timestamp ?? undefined,
      payload: event.payload,
    }))
  );

  whatsappWebhookEventsCounter.inc({ result: 'accepted', reason: 'ok' }, queued);

  logger.info('WhatsApp webhook processed', {
    received: rawEvents.length,
    queued,
    phones: normalizedEvents.map((event) => maskPhone(event.payload.contact.phone)),
    documents: normalizedEvents.map((event) => maskDocument(event.payload.contact.document ?? null)),
  });

  res.status(202).json({ accepted: true, queued });
};

webhookRouter.post('/whatsapp', asyncHandler(handleWhatsAppWebhook));
integrationWebhookRouter.post('/whatsapp/webhook', asyncHandler(handleWhatsAppWebhook));

webhookRouter.get(
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

export { integrationWebhookRouter as whatsappIntegrationWebhookRouter, webhookRouter as whatsappWebhookRouter };
