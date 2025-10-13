import type { Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'node:crypto';

import { asyncHandler } from '../../../middleware/error-handler';
import { logger } from '../../../config/logger';
import {
  getDefaultInstanceId,
  getDefaultTenantId,
  getWebhookApiKey,
  getWebhookSignatureSecret,
  getWebhookVerifyToken,
  isWebhookSignatureRequired,
} from '../../../config/whatsapp';
import { whatsappWebhookEventsCounter } from '../../../lib/metrics';
import {
  normalizeUpsertEvent,
  type RawBaileysUpsertEvent,
} from '../services/baileys-raw-normalizer';
import { ingestInboundWhatsAppMessage } from '../services/inbound-lead-service';

const webhookRouter: Router = Router();
const integrationWebhookRouter: Router = Router();

const MAX_RAW_PREVIEW_LENGTH = 2_000;
const DEFAULT_VERIFY_RESPONSE = 'LeadEngine WhatsApp webhook';

const asArray = (value: unknown): unknown[] => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.events)) {
      return record.events;
    }
    return [record];
  }
  return [];
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

const normalizeChatId = (value: unknown): string | null => {
  const text = readString(value);
  if (!text) {
    return null;
  }

  if (text.includes('@')) {
    return text;
  }

  const digits = text.replace(/[^0-9]/g, '');
  if (!digits) {
    return text;
  }

  return `${digits}@s.whatsapp.net`;
};

const toRawPreview = (value: unknown): string => {
  try {
    const json = JSON.stringify(value);
    if (!json) {
      return '';
    }
    return json.length > MAX_RAW_PREVIEW_LENGTH ? json.slice(0, MAX_RAW_PREVIEW_LENGTH) : json;
  } catch (error) {
    const fallback = String(value);
    logger.debug('Failed to serialize raw Baileys payload; using fallback string', { error });
    return fallback.length > MAX_RAW_PREVIEW_LENGTH
      ? fallback.slice(0, MAX_RAW_PREVIEW_LENGTH)
      : fallback;
  }
};

const handleWhatsAppWebhook = async (req: Request, res: Response) => {
  const requestId = readString(req.header('x-request-id')) ?? randomUUID();
  const providedApiKey = readString(req.header('x-api-key'), req.header('authorization'));
  const expectedApiKey = getWebhookApiKey();
  const signatureRequired = isWebhookSignatureRequired();

  if (expectedApiKey && providedApiKey && providedApiKey !== expectedApiKey) {
    logger.warn('WhatsApp webhook API key mismatch', { requestId });
    whatsappWebhookEventsCounter.inc({ result: 'rejected', reason: 'invalid_api_key' });
    res.status(401).json({ ok: false, code: 'INVALID_API_KEY' });
    return;
  }

  if (signatureRequired) {
    const signature = readString(req.header('x-signature-sha256'));
    const secret = getWebhookSignatureSecret();
    if (!signature || !secret) {
      logger.warn('WhatsApp webhook missing signature while required', { requestId });
      whatsappWebhookEventsCounter.inc({ result: 'rejected', reason: 'invalid_signature' });
      res.status(401).json({ ok: false, code: 'INVALID_SIGNATURE' });
      return;
    }
    try {
      const crypto = await import('node:crypto');
      const expectedBuffer = crypto.createHmac('sha256', secret).update(req.rawBody ?? '').digest();
      const providedBuffer = Buffer.from(signature, 'hex');

      const matches =
        providedBuffer.length === expectedBuffer.length &&
        crypto.timingSafeEqual(providedBuffer, expectedBuffer);

      if (!matches) {
        logger.warn('WhatsApp webhook signature mismatch', { requestId });
        whatsappWebhookEventsCounter.inc({ result: 'rejected', reason: 'invalid_signature' });
        res.status(401).json({ ok: false, code: 'INVALID_SIGNATURE' });
        return;
      }
    } catch (error) {
      logger.warn('Failed to verify WhatsApp webhook signature', { requestId, error });
      whatsappWebhookEventsCounter.inc({ result: 'rejected', reason: 'invalid_signature' });
      res.status(401).json({ ok: false, code: 'INVALID_SIGNATURE' });
      return;
    }
  }

  const events = asArray(req.body);
  if (events.length === 0) {
    whatsappWebhookEventsCounter.inc({ result: 'accepted', reason: 'empty' });
    res.status(200).json({ ok: true, received: 0, persisted: 0 });
    return;
  }

  let persisted = 0;
  let failures = 0;

  for (const entry of events) {
    const eventRecord = entry as RawBaileysUpsertEvent;
    const normalization = normalizeUpsertEvent(eventRecord, {
      instanceId: readString((eventRecord as { instanceId?: unknown }).instanceId, (eventRecord as { iid?: unknown }).iid) ??
        getDefaultInstanceId(),
      tenantId: readString((eventRecord as { tenantId?: unknown }).tenantId) ?? undefined,
    });

    if (normalization.normalized.length === 0) {
      continue;
    }

    for (const normalized of normalization.normalized) {
      const tenantId = normalized.tenantId ??
        readString((eventRecord as { tenantId?: unknown }).tenantId) ??
        getDefaultTenantId();
      const instanceId =
        readString(normalized.data.instanceId) ??
        readString((eventRecord as { instanceId?: unknown }).instanceId, (eventRecord as { iid?: unknown }).iid) ??
        getDefaultInstanceId();

      const chatIdCandidate =
        normalizeChatId(
          normalized.data.metadata?.contact?.remoteJid ??
            normalized.data.metadata?.contact?.jid ??
            normalized.data.message?.key?.remoteJid ??
            normalized.data.from?.phone ??
            normalized.data.message?.key?.id
        ) ?? normalizeChatId(normalized.data.from?.phone);

      const chatId = chatIdCandidate ?? `${tenantId}@baileys`;

      try {
        const data = normalized.data;
        const messageRecord = (data.message ?? {}) as Record<string, unknown>;
        const messageKey = (messageRecord.key ?? {}) as Record<string, unknown>;
        const contactRecord = (data.contact ?? {}) as Record<string, unknown>;
        const metadataBase =
          data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
            ? { ...(data.metadata as Record<string, unknown>) }
            : ({} as Record<string, unknown>);

        const remoteJid =
          normalizeChatId(
            messageKey.remoteJid ??
              data.metadata?.contact?.jid ??
              data.metadata?.contact?.remoteJid ??
              (eventRecord as { payload?: { messages?: Array<{ key?: { remoteJid?: string } }> } })?.payload?.messages?.[
                normalized.messageIndex
              ]?.key?.remoteJid
          ) ?? chatId;

        const direction = (data.direction ?? 'inbound').toString().toUpperCase() === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND';
        const externalId = readString(messageRecord.id, messageKey.id, normalized.messageId);
        const timestamp = readString(data.timestamp) ?? null;

        const brokerMetadata =
          metadataBase.broker && typeof metadataBase.broker === 'object' && !Array.isArray(metadataBase.broker)
            ? { ...(metadataBase.broker as Record<string, unknown>) }
            : ({} as Record<string, unknown>);

        brokerMetadata.instanceId = brokerMetadata.instanceId ?? instanceId ?? null;
        brokerMetadata.sessionId = brokerMetadata.sessionId ?? normalized.sessionId ?? null;
        brokerMetadata.brokerId = brokerMetadata.brokerId ?? normalized.brokerId ?? null;
        brokerMetadata.origin = brokerMetadata.origin ?? 'webhook';

        const metadata: Record<string, unknown> = {
          ...metadataBase,
          source: metadataBase.source ?? 'baileys:webhook',
          direction,
          remoteJid: metadataBase.remoteJid ?? remoteJid,
          chatId: metadataBase.chatId ?? chatId,
          tenantId: metadataBase.tenantId ?? tenantId,
          instanceId: metadataBase.instanceId ?? instanceId ?? null,
          sessionId: metadataBase.sessionId ?? normalized.sessionId ?? null,
          normalizedIndex: normalized.messageIndex,
          raw: metadataBase.raw ?? toRawPreview(eventRecord),
          broker: brokerMetadata,
        };

        const processed = await ingestInboundWhatsAppMessage({
          origin: 'webhook',
          transport: 'whatsapp',
          instanceId: instanceId ?? 'unknown-instance',
          chatId,
          tenantId,
          message: {
            kind: 'message',
            id: normalized.messageId ?? null,
            externalId,
            brokerMessageId: normalized.messageId,
            timestamp,
            direction,
            contact: contactRecord,
            payload: messageRecord,
            metadata,
          },
          raw: {
            event: eventRecord,
            normalizedIndex: normalized.messageIndex,
          },
        });

        if (processed) {
          persisted += 1;
        }
      } catch (error) {
        failures += 1;
        logger.error('Failed to persist inbound WhatsApp message', {
          requestId,
          tenantId,
          chatId,
          error,
        });
      }
    }
  }

  whatsappWebhookEventsCounter.inc({ result: 'accepted', reason: 'ok' }, persisted);

  res.status(200).json({
    ok: true,
    received: events.length,
    persisted,
    failures,
  });
};

const handleVerification = asyncHandler(async (req: Request, res: Response) => {
  const mode = readString(req.query['hub.mode']);
  const challenge = readString(req.query['hub.challenge']);
  const token = readString(req.query['hub.verify_token']);
  const verifyToken = getWebhookVerifyToken();

  if (mode === 'subscribe' && verifyToken && token === verifyToken) {
    res.status(200).send(challenge ?? DEFAULT_VERIFY_RESPONSE);
    return;
  }

  res.status(200).send(DEFAULT_VERIFY_RESPONSE);
});

webhookRouter.post('/whatsapp', asyncHandler(handleWhatsAppWebhook));
integrationWebhookRouter.post('/whatsapp/webhook', asyncHandler(handleWhatsAppWebhook));
webhookRouter.get('/whatsapp', handleVerification);

export { integrationWebhookRouter as whatsappIntegrationWebhookRouter, webhookRouter as whatsappWebhookRouter };
