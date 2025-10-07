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
  type BrokerWebhookInbound,
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

const readRawBodyParseError = (req: Request): SyntaxError | null => {
  const candidate = (req as Request & { rawBodyParseError?: SyntaxError | null }).rawBodyParseError;
  return candidate ?? null;
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

const compactObject = <T extends Record<string, unknown>>(value: T): T => {
  return Object.fromEntries(
    Object.entries(value).filter(([, candidate]) => candidate !== undefined)
  ) as T;
};

const readString = (...candidates: unknown[]): string | null => {
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
};

const normalizeRemoteJid = (input: unknown): string | null => {
  if (typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const withoutDomain = trimmed.replace(/@.+$/u, '');
  const digitsOnly = withoutDomain.replace(/\D+/gu, '');

  if (digitsOnly.length >= 8) {
    return digitsOnly;
  }

  return withoutDomain || null;
};

const normalizeLegacyMessagesUpsert = (
  entry: Record<string, unknown>,
  context: { index: number }
): Array<{ data: BrokerWebhookInbound; messageIndex: number }> => {
  const eventName = readString(entry.event);
  if (!eventName || eventName.toUpperCase() !== 'WHATSAPP_MESSAGES_UPSERT') {
    return [];
  }

  const payload = asRecord(entry.payload);
  const messages = Array.isArray(payload.messages)
    ? payload.messages.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    : [];

  if (messages.length === 0) {
    logger.warn('📭 [Webhook] Legacy payload ignorado: nenhum item em messages', {
      index: context.index,
    });
    return [];
  }

  const instanceId = readString(entry.instanceId, payload.instanceId, payload.iid);
  if (!instanceId) {
    logger.warn('🛑 [Webhook] Legacy payload ignorado: instanceId ausente', {
      index: context.index,
    });
    return [];
  }

  const baseTimestamp = entry.timestamp ?? payload.timestamp ?? payload.ts ?? null;

  return messages.flatMap((raw, messageIndex) => {
    const record = raw as Record<string, unknown>;
    const key = { ...asRecord(record.key) };
    const fromMeValue = key.fromMe;
    const isFromMe =
      fromMeValue === true ||
      fromMeValue === 'true' ||
      fromMeValue === 1 ||
      fromMeValue === '1';

    if (isFromMe) {
      logger.debug('🔁 [Webhook] Mensagem legacy ignorada por ser outbound', {
        index: context.index,
        messageIndex,
        instanceId,
      });
      return [];
    }

    const remoteJid =
      readString(key.participant) ?? readString(key.remoteJid) ?? readString(record.participant);
    const phone = normalizeRemoteJid(remoteJid);
    const pushName = readString(record.pushName, record.notifyName, record.displayName);

    const messageTimestamp =
      record.messageTimestamp ??
      record.timestamp ??
      payload.timestamp ??
      baseTimestamp;

    const messagePayload = { ...asRecord(record.message) };
    const keyId = readString(key.id, key.keyId, record.id);
    if (keyId && typeof messagePayload.id !== 'string') {
      messagePayload.id = keyId;
    }

    const metadata = compactObject({
      ...asRecord(record.metadata),
      ...asRecord(payload.metadata),
      legacyEvent: eventName,
      key,
      remoteJid: remoteJid ?? null,
      messageTimestamp,
      timestamp: messageTimestamp ?? baseTimestamp ?? null,
      type: readString(payload.type, payload.messageType, payload.notifyType),
      messageIndex,
    });

    const parsed = BrokerWebhookInboundSchema.safeParse({
      event: 'message',
      direction: 'inbound',
      instanceId,
      timestamp: messageTimestamp ?? baseTimestamp ?? null,
      from: compactObject({
        phone: phone ?? undefined,
        name: pushName ?? undefined,
        pushName: pushName ?? undefined,
      }),
      message: messagePayload,
      metadata,
    });

    if (!parsed.success) {
      logger.warn('🛑 [Webhook] Legacy mensagem ignorada: payload inválido', {
        index: context.index,
        messageIndex,
        issues: parsed.error.issues,
      });
      return [];
    }

    return [
      {
        data: parsed.data,
        messageIndex,
      },
    ];
  });
};

const buildInboundEvent = (
  parsed: BrokerWebhookInbound,
  context: { index: number; origin: 'modern' | 'legacy'; messageIndex?: number }
): BrokerInboundEvent => {
  const { instanceId, timestamp, message, from, metadata } = parsed;
  const rawMessage = { ...asRecord(message) };
  const rawMetadata = asRecord(metadata);

  const messageId =
    (typeof rawMessage.id === 'string' && rawMessage.id.trim().length > 0
      ? rawMessage.id.trim()
      : null) ?? randomUUID();

  const rawName = typeof from.name === 'string' ? from.name.trim() : null;
  const rawPushName = typeof from.pushName === 'string' ? from.pushName.trim() : null;
  const displayName =
    rawName && rawName.length > 0
      ? rawName
      : rawPushName && rawPushName.length > 0
      ? rawPushName
      : null;

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
        logger.debug('⚠️ [Webhook] Falha ao normalizar timestamp numérico', {
          error,
          numericTs,
          index: context.index,
          origin: context.origin,
          messageIndex: context.messageIndex ?? null,
        });
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

  const parseError = readRawBodyParseError(req);
  if (parseError) {
    logger.warn('WhatsApp webhook rejected due to invalid JSON payload', { error: parseError.message });
    whatsappWebhookEventsCounter.inc({ result: 'rejected', reason: 'invalid_json' });
    res.status(400).json({
      ok: false,
      error: {
        code: 'INVALID_WEBHOOK_JSON',
        message: 'Body is not valid JSON.',
      },
    });
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
    .flatMap((entry, index) => {
      const parsed = BrokerWebhookInboundSchema.safeParse(entry);
      if (parsed.success) {
        return [
          {
            data: parsed.data,
            origin: 'modern' as const,
            sourceIndex: index,
          },
        ];
      }

      const legacy = normalizeLegacyMessagesUpsert(entry, { index });
      if (legacy.length > 0) {
        return legacy.map((item) => ({
          data: item.data,
          origin: 'legacy' as const,
          messageIndex: item.messageIndex,
          sourceIndex: index,
        }));
      }

      logger.warn('🛑 [Webhook] Evento ignorado: payload inválido', {
        index,
        issues: parsed.error.issues,
      });
      return [];
    })
    .map((candidate) =>
      buildInboundEvent(candidate.data, {
        index: candidate.sourceIndex,
        origin: candidate.origin,
        messageIndex: candidate.messageIndex,
      })
    );

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

export const __testing = {
  normalizeLegacyMessagesUpsert,
  normalizeRemoteJid,
  buildInboundEvent,
};
