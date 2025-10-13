import type { Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'node:crypto';

import {
  findOrCreateOpenTicketByChat,
  upsertMessageByExternalId,
  type PassthroughMessage,
} from '@ticketz/storage';

import { asyncHandler } from '../../../middleware/error-handler';
import { logger } from '../../../config/logger';
import { getSocketServer } from '../../../lib/socket-registry';
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

const resolveMedia = (
  message: Record<string, unknown> | null | undefined
): { mediaType: string; caption?: string; mimeType?: string; fileName?: string; size?: number } | null => {
  if (!message) {
    return null;
  }

  const media = message.media as Record<string, unknown> | null | undefined;
  if (!media) {
    return null;
  }

  const mediaType = readString(media.mediaType) ?? 'file';
  const caption = readString(media.caption) ?? undefined;
  const mimeType = readString(media.mimetype ?? media.mimeType) ?? undefined;
  const fileName = readString(media.fileName ?? media.filename) ?? undefined;
  const sizeCandidate = media.fileLength ?? media.size;
  const size = typeof sizeCandidate === 'number' && Number.isFinite(sizeCandidate)
    ? sizeCandidate
    : undefined;

  return {
    mediaType,
    caption,
    mimeType,
    fileName,
    size,
  };
};

const emitRealtime = (tenantId: string, ticketId: string, message: PassthroughMessage) => {
  const socket = getSocketServer();
  if (!socket) {
    return;
  }

  socket.to(`tenant:${tenantId}`).emit('messages.new', message);
  socket.to(`ticket:${ticketId}`).emit('messages.new', message);
};

const persistInboundMessage = async (
  tenantId: string,
  chatId: string,
  instanceId: string | null,
  rawEvent: RawBaileysUpsertEvent,
  payload: ReturnType<typeof normalizeUpsertEvent>['normalized'][number]
): Promise<PassthroughMessage | null> => {
  const data = payload.data;
  const messageRecord = (data.message ?? {}) as Record<string, unknown>;
  const messageKey = (messageRecord.key ?? {}) as Record<string, unknown>;

  const externalId =
    readString(messageRecord.id, messageKey.id, payload.messageId) ?? `IN-${Date.now()}-${Math.random()}`;
  const direction = payload.data.direction === 'outbound' ? 'outbound' : 'inbound';
  const typeRaw = readString(messageRecord.type);
  const messageType: 'text' | 'media' | 'unknown' =
    typeRaw === 'text' ? 'text' : typeRaw === 'media' ? 'media' : 'unknown';
  const text = readString(messageRecord.text, messageRecord.conversation, messageRecord.caption);
  const media = resolveMedia(messageRecord);
  const timestamp = readString(data.timestamp) ?? undefined;

  const remoteJid =
    normalizeChatId(
      messageKey.remoteJid ??
        data.metadata?.contact?.jid ??
        data.metadata?.contact?.remoteJid ??
        (rawEvent as { payload?: { messages?: Array<{ key?: { remoteJid?: string } }> } })?.payload?.messages?.[
          payload.messageIndex
        ]?.key?.remoteJid
    ) ?? chatId;

  const ticketContext = await findOrCreateOpenTicketByChat({
    tenantId,
    chatId: remoteJid,
    displayName: readString(data.from?.name, data.from?.pushName, data.from?.phone, remoteJid) ?? remoteJid,
    phone: readString(data.from?.phone, remoteJid) ?? remoteJid,
    instanceId,
  });

  const metadata: Record<string, unknown> = {
    source: 'baileys',
    raw: toRawPreview(rawEvent),
    broker: {
      instanceId,
      sessionId: payload.sessionId ?? null,
      brokerId: payload.brokerId ?? null,
    },
    remoteJid,
  };

  if (data.metadata) {
    metadata.normalized = data.metadata;
  }

  const upserted = await upsertMessageByExternalId({
    tenantId,
    ticketId: ticketContext.ticket.id,
    chatId: remoteJid,
    direction,
    externalId,
    type: media ? 'media' : messageType,
    text: text ?? null,
    media: media
      ? {
          mediaType: media.mediaType,
          caption: media.caption,
          mimeType: media.mimeType ?? null,
          fileName: media.fileName ?? null,
          size: media.size ?? null,
          url: null,
        }
      : null,
    metadata,
    timestamp,
  });

  emitRealtime(tenantId, ticketContext.ticket.id, upserted.message);

  return upserted.message;
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
        const message = await persistInboundMessage(tenantId, chatId, instanceId ?? null, eventRecord, normalized);
        if (message) {
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
