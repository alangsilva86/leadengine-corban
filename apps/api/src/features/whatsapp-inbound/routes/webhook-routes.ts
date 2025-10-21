import type { Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';

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
  applyBrokerAck,
  findMessageByExternalId as storageFindMessageByExternalId,
} from '@ticketz/storage';
import {
  normalizeUpsertEvent,
  type NormalizedRawUpsertMessage,
  type RawBaileysUpsertEvent,
} from '../services/baileys-raw-normalizer';
import { enqueueInboundWebhookJob } from '../services/inbound-queue';
import { logBaileysDebugEvent } from '../utils/baileys-event-logger';
import { prisma } from '../../../lib/prisma';
import { emitWhatsAppDebugPhase } from '../../debug/services/whatsapp-debug-emitter';
import { emitMessageUpdatedEvents } from '../../../services/ticket-service';
import { normalizeBaileysMessageStatus } from '../services/baileys-status-normalizer';
import {
  BrokerInboundEventSchema,
  type BrokerInboundContact,
  type BrokerInboundEvent,
} from '../schemas/broker-contracts';

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

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

const unwrapWebhookEvent = (
  entry: unknown
): { event: RawBaileysUpsertEvent; envelope: Record<string, unknown> } | null => {
  const envelope = asRecord(entry);
  if (!envelope) {
    return null;
  }

  const bodyRecord = asRecord(envelope.body);
  if (!bodyRecord) {
    return { event: envelope as RawBaileysUpsertEvent, envelope };
  }

  const merged: Record<string, unknown> = { ...bodyRecord };

  for (const [key, value] of Object.entries(envelope)) {
    if (key === 'body') {
      continue;
    }
    if (!(key in merged)) {
      merged[key] = value;
    }
  }

  return { event: merged as RawBaileysUpsertEvent, envelope };
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

const normalizeApiKey = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const bearerMatch = /^bearer\s+(.+)$/i.exec(value);
  const normalized = (bearerMatch?.[1] ?? value).trim();

  return normalized.length > 0 ? normalized : null;
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

const sanitizeMetadataValue = (value: unknown): unknown => {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return undefined;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return (value as Buffer).toString('base64');
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeMetadataValue(entry));
  }

  if (typeof value === 'object') {
    const record: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (nested === undefined) {
        continue;
      }
      record[key] = sanitizeMetadataValue(nested);
    }
    return record;
  }

  return value;
};

const parseTimestampToDate = (value: unknown): Date | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value > 1_000_000_000_000 ? value : value * 1000);
  }

  if (typeof value === 'bigint') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return new Date(numeric > 1_000_000_000_000 ? numeric : numeric * 1000);
    }
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return new Date(numeric > 1_000_000_000_000 ? numeric : numeric * 1000);
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  }

  return null;
};

interface NormalizeContractEventOptions {
  requestId: string;
  instanceOverride?: string | null;
  tenantOverride?: string | null;
  brokerOverride?: string | null;
}

const normalizeContractEvent = (
  eventRecord: Record<string, unknown>,
  options: NormalizeContractEventOptions
): NormalizedRawUpsertMessage | null => {
  const parsed = BrokerInboundEventSchema.safeParse(eventRecord);
  if (!parsed.success) {
    logger.warn('Received invalid broker WhatsApp contract event', {
      requestId: options.requestId,
      issues: parsed.error.issues,
      preview: toRawPreview(eventRecord),
    });
    return null;
  }

  const event = parsed.data as BrokerInboundEvent;
  const contactRecord = asRecord(event.payload.contact) ?? {};
  const messageRecord = asRecord(event.payload.message) ?? {};
  const metadataInput = asRecord(event.payload.metadata) ?? {};

  const sanitizedMetadata = sanitizeMetadataValue({
    ...metadataInput,
  }) as Record<string, unknown>;

  if (!asRecord(sanitizedMetadata.contact) && Object.keys(contactRecord).length > 0) {
    sanitizedMetadata.contact = contactRecord;
  }

  const metadataContactRecord = asRecord(sanitizedMetadata.contact);
  const resolvedInstanceId =
    readString(
      options.instanceOverride,
      event.payload.instanceId,
      event.instanceId
    ) ?? event.payload.instanceId;

  const messageId =
    readString(
      (messageRecord as { id?: unknown }).id,
      (messageRecord as { key?: { id?: unknown } }).key?.id,
      (sanitizedMetadata as { messageId?: unknown }).messageId,
      event.id
    ) ?? event.id;

  const messageType =
    readString(
      (sanitizedMetadata as { messageType?: unknown }).messageType,
      (messageRecord as { type?: unknown }).type
    ) ?? 'contract';

  const isGroup = Boolean(
    (metadataContactRecord as { isGroup?: unknown })?.isGroup ??
      (sanitizedMetadata as { isGroup?: unknown }).isGroup ??
      false
  );

  const rawDirection =
    readString(event.payload.direction, event.type) ??
    (event.type === 'MESSAGE_OUTBOUND' ? 'OUTBOUND' : 'INBOUND');
  const direction = rawDirection.toLowerCase().includes('outbound') ? 'outbound' : 'inbound';

  const tenantCandidate = options.tenantOverride ?? event.tenantId ?? null;
  const sessionCandidate = event.sessionId ?? null;
  const brokerCandidate = options.brokerOverride ?? event.instanceId ?? null;

  const normalized: NormalizedRawUpsertMessage = {
    data: {
      direction,
      instanceId: resolvedInstanceId,
      timestamp: event.payload.timestamp,
      message: messageRecord,
      metadata: sanitizedMetadata,
      from: contactRecord as BrokerInboundContact,
    },
    messageIndex: 0,
    ...(tenantCandidate ? { tenantId: tenantCandidate } : {}),
    ...(sessionCandidate ? { sessionId: sessionCandidate } : {}),
    ...(brokerCandidate !== undefined ? { brokerId: brokerCandidate } : {}),
    messageId,
    messageType,
    isGroup,
  };

  return normalized;
};

interface ProcessNormalizedMessageOptions {
  normalized: NormalizedRawUpsertMessage;
  eventRecord: Record<string, unknown>;
  envelopeRecord: Record<string, unknown>;
  rawPreview: string;
  requestId: string;
  tenantOverride?: string | null;
  instanceOverride?: string | null;
}

const processNormalizedMessage = async (
  options: ProcessNormalizedMessageOptions
): Promise<boolean> => {
  const { normalized, eventRecord, envelopeRecord, rawPreview, requestId } = options;

  const tenantId =
    options.tenantOverride ??
    normalized.tenantId ??
    readString((eventRecord as { tenantId?: unknown }).tenantId, envelopeRecord.tenantId) ??
    getDefaultTenantId();

  const instanceId =
    readString(
      options.instanceOverride,
      normalized.data.instanceId,
      (eventRecord as { instanceId?: unknown }).instanceId,
      envelopeRecord.instanceId
    ) ?? getDefaultInstanceId();

  const metadataContactRecord = asRecord(normalized.data.metadata?.contact);
  const messageRecord = (normalized.data.message ?? {}) as Record<string, unknown>;
  const messageKeyRecord = asRecord(messageRecord.key);
  const fromRecord = asRecord(normalized.data.from);

  const chatIdCandidate =
    normalizeChatId(
      readString(metadataContactRecord?.remoteJid) ??
        readString(metadataContactRecord?.jid) ??
        readString(messageKeyRecord?.remoteJid) ??
        readString(fromRecord?.phone) ??
        readString(messageKeyRecord?.id)
    ) ?? normalizeChatId(readString(fromRecord?.phone));

  const chatId = chatIdCandidate ?? `${tenantId}@baileys`;

  try {
    const data = normalized.data;
    const metadataBase =
      data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
        ? { ...(data.metadata as Record<string, unknown>) }
        : ({} as Record<string, unknown>);
    const metadataContact = asRecord(metadataBase.contact);
    const messageKey = messageKeyRecord ?? {};
    const contactRecord = asRecord(data.from) ?? {};

    const remoteJid =
      normalizeChatId(
        readString(messageKey.remoteJid) ??
          readString(metadataContact?.jid) ??
          readString(metadataContact?.remoteJid) ??
          readString(
            (eventRecord as {
              payload?: { messages?: Array<{ key?: { remoteJid?: string } }> };
            })?.payload?.messages?.[normalized.messageIndex ?? 0]?.key?.remoteJid
          )
      ) ?? chatId;

    const direction =
      (data.direction ?? 'inbound').toString().toUpperCase() === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND';
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
      raw: metadataBase.raw ?? rawPreview,
      broker: brokerMetadata,
    };

    emitWhatsAppDebugPhase({
      phase: 'webhook:normalized',
      correlationId: normalized.messageId ?? externalId ?? requestId ?? null,
      tenantId: tenantId ?? null,
      instanceId: instanceId ?? null,
      chatId,
      tags: ['webhook'],
      context: {
        requestId,
        normalizedIndex: normalized.messageIndex,
        direction,
        source: 'webhook',
      },
      payload: {
        contact: contactRecord,
        message: messageRecord,
        metadata,
      },
    });

    const metadataSource = readString(metadata.source);
    const debugSource =
      metadataSource && metadataSource.toLowerCase().includes('baileys')
        ? metadataSource
        : 'baileys:webhook';

    if (debugSource) {
      await logBaileysDebugEvent(debugSource, {
        tenantId: tenantId ?? null,
        instanceId: instanceId ?? null,
        chatId,
        messageId: normalized.messageId ?? externalId ?? null,
        direction,
        timestamp,
        metadata,
        contact: contactRecord,
        message: messageRecord,
        rawPayload: toRawPreview(eventRecord),
        rawEnvelope: toRawPreview(envelopeRecord),
        normalizedIndex: normalized.messageIndex,
      });
    }

    enqueueInboundWebhookJob({
      requestId,
      tenantId,
      instanceId,
      chatId,
      normalizedIndex: normalized.messageIndex ?? null,
      envelope: {
        origin: 'webhook',
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
      },
    });

    return true;
  } catch (error) {
    logger.error('Failed to persist inbound WhatsApp message', {
      requestId,
      tenantId,
      chatId,
      error,
    });
    whatsappWebhookEventsCounter.inc({
      origin: 'webhook',
      tenantId: tenantId ?? 'unknown',
      instanceId: instanceId ?? 'unknown',
      result: 'failed',
      reason: 'persist_error',
    });
    return false;
  }
};

type MessageLookupResult = {
  tenantId: string;
  messageId: string;
  ticketId: string;
  metadata: Record<string, unknown>;
  instanceId: string | null;
  externalId: string | null;
};

const findMessageForStatusUpdate = async ({
  tenantId,
  messageId,
  ticketId,
}: {
  tenantId?: string | null;
  messageId: string;
  ticketId?: string | null;
}): Promise<MessageLookupResult | null> => {
  const trimmedId = messageId.trim();
  if (!trimmedId) {
    return null;
  }

  if (tenantId) {
    const message = await storageFindMessageByExternalId(tenantId, trimmedId);
    if (message) {
      const metadataRecord =
        message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
          ? { ...(message.metadata as Record<string, unknown>) }
          : ({} as Record<string, unknown>);

      return {
        tenantId: message.tenantId,
        messageId: message.id,
        ticketId: message.ticketId,
        metadata: metadataRecord,
        instanceId: message.instanceId ?? null,
        externalId: message.externalId ?? null,
      };
    }
  }

  const where: Prisma.MessageWhereInput = {
    OR: [
      { externalId: trimmedId },
      { metadata: { path: ['broker', 'messageId'], equals: trimmedId } },
    ],
  };

  if (tenantId) {
    where.tenantId = tenantId;
  }

  if (ticketId) {
    where.ticketId = ticketId;
  }

  const fallback = await prisma.message.findFirst({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      tenantId: true,
      ticketId: true,
      metadata: true,
      instanceId: true,
      externalId: true,
    },
  });

  if (!fallback) {
    return null;
  }

  const metadataRecord =
    fallback.metadata && typeof fallback.metadata === 'object' && !Array.isArray(fallback.metadata)
      ? { ...(fallback.metadata as Record<string, unknown>) }
      : ({} as Record<string, unknown>);

  return {
    tenantId: fallback.tenantId,
    messageId: fallback.id,
    ticketId: fallback.ticketId,
    metadata: metadataRecord,
    instanceId: fallback.instanceId ?? null,
    externalId: fallback.externalId ?? null,
  };
};

const processMessagesUpdate = async (
  eventRecord: RawBaileysUpsertEvent,
  envelopeRecord: Record<string, unknown>,
  context: {
    requestId: string;
    instanceId?: string | null;
    tenantOverride?: string | null;
  }
): Promise<{ persisted: number; failures: number }> => {
  const payloadRecord = asRecord((eventRecord as { payload?: unknown }).payload);
  const rawRecord = asRecord(payloadRecord?.raw);
  const updates = Array.isArray(rawRecord?.updates) ? rawRecord.updates : [];

  if (!updates.length) {
    return { persisted: 0, failures: 0 };
  }

  const tenantCandidate =
    context.tenantOverride ??
    readString(
      (eventRecord as { tenantId?: unknown }).tenantId,
      payloadRecord?.tenantId,
      rawRecord?.tenantId,
      envelopeRecord.tenantId
    );

  const ticketCandidate = readString(
    payloadRecord?.ticketId,
    rawRecord?.ticketId,
    (payloadRecord?.ticket as { id?: unknown })?.id
  );

  let persisted = 0;
  let failures = 0;

  for (const entry of updates) {
    const updateRecord = asRecord(entry);
    if (!updateRecord) {
      continue;
    }

    const keyRecord = asRecord(updateRecord.key);
    const updateDetails = asRecord(updateRecord.update);
    const messageId = readString(
      updateDetails?.id,
      updateRecord.id,
      keyRecord?.id,
      (updateDetails as { key?: { id?: unknown } })?.key?.id
    );

    if (!messageId) {
      continue;
    }

    const fromMe = Boolean(keyRecord?.fromMe ?? updateRecord.fromMe);
    if (!fromMe) {
      continue;
    }

    const statusValue =
      updateDetails?.status ?? updateRecord.status ?? (updateDetails as { ack?: unknown })?.ack;
    const normalizedStatus = normalizeBaileysMessageStatus(statusValue);
    const numericStatus =
      typeof statusValue === 'number'
        ? statusValue
        : typeof statusValue === 'string'
        ? Number(statusValue)
        : undefined;

    const timestampCandidate =
      updateDetails?.messageTimestamp ?? updateDetails?.timestamp ?? updateRecord.timestamp;
    const ackTimestamp = parseTimestampToDate(timestampCandidate) ?? new Date();
    const participant = readString(updateDetails?.participant, updateRecord.participant);
    const remoteJid =
      normalizeChatId(
        keyRecord?.remoteJid ?? updateRecord.remoteJid ?? participant ?? updateDetails?.jid
      ) ?? null;

    let lookup: MessageLookupResult | null = null;

    try {
      lookup = await findMessageForStatusUpdate({
        tenantId: tenantCandidate,
        messageId,
        ticketId: readString(updateRecord.ticketId, ticketCandidate),
      });

      if (!lookup) {
        whatsappWebhookEventsCounter.inc({
          origin: 'webhook',
          tenantId: tenantCandidate ?? 'unknown',
          instanceId: context.instanceId ?? 'unknown',
          result: 'ignored',
          reason: 'ack_message_not_found',
        });
        logger.debug('WhatsApp status update ignored; message not found', {
          requestId: context.requestId,
          messageId,
          tenantId: tenantCandidate ?? 'unknown',
        });
        continue;
      }

      const metadataRecord = lookup.metadata ?? {};
      const existingBroker =
        metadataRecord.broker && typeof metadataRecord.broker === 'object' && !Array.isArray(metadataRecord.broker)
          ? { ...(metadataRecord.broker as Record<string, unknown>) }
          : ({} as Record<string, unknown>);

      const brokerMetadata: Record<string, unknown> = {
        ...existingBroker,
        provider: 'whatsapp',
        status: normalizedStatus,
        messageId: existingBroker.messageId ?? lookup.externalId ?? messageId,
      };

      if (context.instanceId ?? lookup.instanceId ?? existingBroker.instanceId) {
        brokerMetadata.instanceId = context.instanceId ?? lookup.instanceId ?? existingBroker.instanceId;
      }

      if (remoteJid) {
        brokerMetadata.remoteJid = remoteJid;
      }

      const lastAck: Record<string, unknown> = {
        status: normalizedStatus,
        receivedAt: ackTimestamp.toISOString(),
        raw: sanitizeMetadataValue(updateRecord),
      };

      if (participant) {
        lastAck.participant = participant;
      }

      if (Number.isFinite(numericStatus)) {
        lastAck.numericStatus = Number(numericStatus);
      }

      brokerMetadata.lastAck = lastAck;

      const metadataUpdate: Record<string, unknown> = {
        broker: brokerMetadata,
      };

      const ackInput: Parameters<typeof applyBrokerAck>[2] = {
        status: normalizedStatus,
        metadata: metadataUpdate,
      };

      if (normalizedStatus === 'DELIVERED' || normalizedStatus === 'READ') {
        ackInput.deliveredAt = ackTimestamp;
      }

      if (normalizedStatus === 'READ') {
        ackInput.readAt = ackTimestamp;
      }

      const ackInstanceId = context.instanceId ?? lookup.instanceId;
      const metricsInstanceId = ackInstanceId ?? 'unknown';
      if (ackInstanceId !== undefined && ackInstanceId !== null) {
        ackInput.instanceId = ackInstanceId;
      }

      const updated = await applyBrokerAck(lookup.tenantId, lookup.messageId, ackInput);

      if (updated) {
        persisted += 1;
        await emitMessageUpdatedEvents(lookup.tenantId, updated.ticketId, updated, null);
        whatsappWebhookEventsCounter.inc({
          origin: 'webhook',
          tenantId: lookup.tenantId ?? 'unknown',
          instanceId: metricsInstanceId,
          result: 'accepted',
          reason: 'ack_applied',
        });
      } else {
        whatsappWebhookEventsCounter.inc({
          origin: 'webhook',
          tenantId: lookup.tenantId ?? 'unknown',
          instanceId: metricsInstanceId,
          result: 'ignored',
          reason: 'ack_noop',
        });
      }
    } catch (error) {
      failures += 1;
      whatsappWebhookEventsCounter.inc({
        origin: 'webhook',
        tenantId: lookup?.tenantId ?? tenantCandidate ?? 'unknown',
        instanceId: context.instanceId ?? lookup?.instanceId ?? 'unknown',
        result: 'failed',
        reason: 'ack_error',
      });
      logger.error('Failed to apply WhatsApp status update', {
        requestId: context.requestId,
        messageId,
        tenantId: lookup?.tenantId ?? tenantCandidate ?? 'unknown',
        error,
      });
    }
  }

  return { persisted, failures };
};

const handleWhatsAppWebhook = async (req: Request, res: Response) => {
  const requestId = readString(req.header('x-request-id')) ?? randomUUID();
  const providedApiKey = normalizeApiKey(
    readString(req.header('x-api-key'), req.header('authorization'), req.header('x-authorization'))
  );
  const expectedApiKey = getWebhookApiKey();
  const signatureRequired = isWebhookSignatureRequired();

  if (expectedApiKey) {
    if (!providedApiKey) {
      logger.warn('WhatsApp webhook API key missing', { requestId });
      whatsappWebhookEventsCounter.inc({
        origin: 'webhook',
        tenantId: 'unknown',
        instanceId: 'unknown',
        result: 'rejected',
        reason: 'invalid_api_key',
      });
      res.status(401).json({ ok: false, code: 'INVALID_API_KEY' });
      return;
    }

    if (providedApiKey !== expectedApiKey) {
      logger.warn('WhatsApp webhook API key mismatch', { requestId });
      whatsappWebhookEventsCounter.inc({
        origin: 'webhook',
        tenantId: 'unknown',
        instanceId: 'unknown',
        result: 'rejected',
        reason: 'invalid_api_key',
      });
      res.status(401).json({ ok: false, code: 'INVALID_API_KEY' });
      return;
    }
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

  const rawBodyParseError = (req as Request & { rawBodyParseError?: SyntaxError | null }).rawBodyParseError;
  if (rawBodyParseError) {
    logger.warn('WhatsApp webhook received invalid JSON payload', { requestId, error: rawBodyParseError.message });
    whatsappWebhookEventsCounter.inc({
      origin: 'webhook',
      tenantId: 'unknown',
      instanceId: 'unknown',
      result: 'rejected',
      reason: 'invalid_json',
    });
    res.status(400).json({
      ok: false,
      error: { code: 'INVALID_WEBHOOK_JSON', message: 'Invalid JSON payload' },
    });
    return;
  }

  const events = asArray(req.body);
  if (events.length === 0) {
    whatsappWebhookEventsCounter.inc({
      origin: 'webhook',
      tenantId: 'unknown',
      instanceId: 'unknown',
      result: 'accepted',
      reason: 'empty',
    });
    res.status(200).json({ ok: true, received: 0, persisted: 0 });
    return;
  }

  let enqueued = 0;
  let ackPersisted = 0;
  let ackFailures = 0;
  let prepFailures = 0;

  for (const entry of events) {
    const unwrapped = unwrapWebhookEvent(entry);
    if (!unwrapped) {
      continue;
    }

    const eventRecord = unwrapped.event;
    const envelopeRecord = unwrapped.envelope;
    const rawPreview = toRawPreview(entry);
    const eventType = readString(eventRecord.event, (eventRecord as { type?: unknown }).type);

    const rawInstanceId =
      readString(
        (eventRecord as { instanceId?: unknown }).instanceId,
        envelopeRecord.instanceId
      ) ?? getDefaultInstanceId();
    let instanceOverride = rawInstanceId;
    let brokerOverride: string | undefined;
    let tenantOverride = readString(
      (eventRecord as { tenantId?: unknown }).tenantId,
      envelopeRecord.tenantId
    ) ?? undefined;

    if (rawInstanceId) {
      const existingInstance = await prisma.whatsAppInstance.findFirst({
        where: {
          OR: [{ id: rawInstanceId }, { brokerId: rawInstanceId }],
        },
        select: {
          id: true,
          brokerId: true,
          tenantId: true,
        },
      });

      if (existingInstance) {
        instanceOverride = existingInstance.id;
        const storedBrokerId =
          typeof existingInstance.brokerId === 'string' && existingInstance.brokerId.trim().length > 0
            ? existingInstance.brokerId.trim()
            : null;

        if (!storedBrokerId || storedBrokerId !== existingInstance.id) {
          await prisma.whatsAppInstance.update({
            where: { id: existingInstance.id },
            data: { brokerId: existingInstance.id },
          });
        }

        brokerOverride = existingInstance.id;
        if (!tenantOverride && existingInstance.tenantId) {
          tenantOverride = existingInstance.tenantId;
        }
      }
    }

    if (eventType === 'WHATSAPP_MESSAGES_UPDATE') {
      const ackOutcome = await processMessagesUpdate(eventRecord, envelopeRecord, {
        requestId,
        instanceId: instanceOverride ?? brokerOverride ?? rawInstanceId ?? null,
        tenantOverride: tenantOverride ?? null,
      });

      ackPersisted += ackOutcome.persisted;
      ackFailures += ackOutcome.failures;
      continue;
    }

    const normalizedMessages: NormalizedRawUpsertMessage[] = [];

    if (eventType === 'MESSAGE_INBOUND' || eventType === 'MESSAGE_OUTBOUND') {
      const normalizedContract = normalizeContractEvent(eventRecord, {
        requestId,
        instanceOverride: instanceOverride ?? null,
        tenantOverride: tenantOverride ?? null,
        brokerOverride: brokerOverride ?? null,
      });

      if (!normalizedContract) {
        whatsappWebhookEventsCounter.inc({
          origin: 'webhook',
          tenantId: tenantOverride ?? 'unknown',
          instanceId: instanceOverride ?? 'unknown',
          result: 'ignored',
          reason: 'invalid_contract',
          event: eventType,
        });
        continue;
      }

      normalizedMessages.push(normalizedContract);
    } else {
      if (eventType && eventType !== 'WHATSAPP_MESSAGES_UPSERT') {
        whatsappWebhookEventsCounter.inc({
          origin: 'webhook',
          tenantId: tenantOverride ?? 'unknown',
          instanceId: instanceOverride ?? 'unknown',
          result: 'ignored',
          reason: 'unsupported_event',
          event: eventType,
        });
        continue;
      }

      const normalization = normalizeUpsertEvent(eventRecord, {
        instanceId: instanceOverride ?? null,
        tenantId: tenantOverride ?? null,
        brokerId: brokerOverride ?? null,
      });

      if (normalization.normalized.length === 0) {
        continue;
      }

      normalizedMessages.push(...normalization.normalized);
    }

    for (const normalized of normalizedMessages) {
      const processed = await processNormalizedMessage({
        normalized,
        eventRecord,
        envelopeRecord,
        rawPreview,
        requestId,
        tenantOverride: tenantOverride ?? null,
        instanceOverride: instanceOverride ?? null,
      });

      if (processed) {
        enqueued += 1;
      } else {
        prepFailures += 1;
      }
    }
  }

  if (prepFailures > 0) {
    logger.warn('🎯 LeadEngine • WhatsApp :: ⚠️ Webhook encontrou falhas ao preparar ingestão', {
      requestId,
      prepFailures,
    });
  }

  if (ackFailures > 0) {
    logger.warn('🎯 LeadEngine • WhatsApp :: ⚠️ Atualização de status WhatsApp falhou em algumas mensagens', {
      requestId,
      ackFailures,
      ackPersisted,
    });
  }

  logger.debug('🎯 LeadEngine • WhatsApp :: ✅ Eventos enfileirados a partir do webhook', {
    requestId,
    received: events.length,
    enqueued,
    ackPersisted,
    ackFailures,
  });

  res.status(204).send();
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
