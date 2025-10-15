import type { IncomingHttpHeaders } from 'http';

import { ForbiddenError, NotFoundError, ValidationError } from '@ticketz/core';
import { mapPassthroughMessage } from '@ticketz/storage';

import { prisma } from '../../../lib/prisma';
import { ingestInboundWhatsAppMessage, type InboundWhatsAppEnvelope } from '../../whatsapp-inbound/services/inbound-lead-service';
import { isWhatsappDebugToolsEnabled } from '../../../config/feature-flags';
import { asRecord, buildWhereClause, normalizeJsonRecord } from '../routes/messages';

const readHeaderValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return readHeaderValue(value[0]);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const cloneRecordOrNull = (value: unknown): Record<string, unknown> | null => {
  const record = asRecord(value);
  return record ? { ...record } : null;
};

const normalizeContactRecord = (value: unknown): Record<string, unknown> => {
  const record = cloneRecordOrNull(value);
  return record ?? {};
};

const normalizePayloadRecord = (value: unknown): Record<string, unknown> => {
  const record = cloneRecordOrNull(value);
  return record ?? {};
};

const normalizeMetadataRecord = (value: unknown): Record<string, unknown> | null => {
  const record = cloneRecordOrNull(value);
  if (!record) {
    return null;
  }

  return Object.keys(record).length > 0 ? record : null;
};

const normalizeDirection = (value: unknown): 'INBOUND' | 'OUTBOUND' => {
  const candidate = readString(value);
  if (candidate && candidate.toUpperCase() === 'OUTBOUND') {
    return 'OUTBOUND';
  }
  return 'INBOUND';
};

const ensureFeatureEnabled = () => {
  if (!isWhatsappDebugToolsEnabled()) {
    throw new ForbiddenError('WhatsApp debug endpoints are disabled');
  }
};

export const resolveWhatsappDebugContext = (
  headers: IncomingHttpHeaders
): { tenantId: string } => {
  ensureFeatureEnabled();

  const tenantId = readHeaderValue(headers['x-tenant-id']);
  if (!tenantId) {
    throw new ValidationError('x-tenant-id header is required', {
      header: 'x-tenant-id',
    });
  }

  return { tenantId };
};

const normalizeInboundEnvelope = (
  payload: unknown,
  tenantId: string,
  fallbackOrigin: string
): InboundWhatsAppEnvelope => {
  const envelopeRecord = cloneRecordOrNull(payload) ?? {};
  const messageRecord = cloneRecordOrNull(envelopeRecord.message) ?? {};
  const contactRecord = normalizeContactRecord(
    envelopeRecord.contact ?? messageRecord.contact
  );
  const metadataRecord = normalizeMetadataRecord(
    envelopeRecord.metadata ?? messageRecord.metadata
  );

  const normalizedPayloadSource =
    (messageRecord.payload ?? envelopeRecord.payload ?? messageRecord.message) ?? {};
  const normalizedPayload = normalizePayloadRecord(normalizedPayloadSource);

  const messageId = readString(messageRecord.id) ?? readString(envelopeRecord.messageId);
  const timestamp =
    readString(messageRecord.timestamp) ?? readString(envelopeRecord.timestamp) ?? null;

  return {
    origin: readString(envelopeRecord.origin) ?? fallbackOrigin,
    instanceId:
      readString(envelopeRecord.instanceId) ??
      readString(messageRecord.instanceId) ??
      readString(metadataRecord?.instanceId) ??
      'debug-instance',
    chatId:
      readString(envelopeRecord.chatId) ??
      readString(messageRecord.chatId) ??
      readString(metadataRecord?.chatId) ??
      null,
    tenantId,
    dedupeTtlMs: typeof envelopeRecord.dedupeTtlMs === 'number' ? envelopeRecord.dedupeTtlMs : undefined,
    message: {
      kind: 'message',
      id: messageId ?? null,
      externalId: readString(messageRecord.externalId) ?? messageId ?? null,
      brokerMessageId: readString(messageRecord.brokerMessageId),
      timestamp,
      direction: normalizeDirection(messageRecord.direction ?? envelopeRecord.direction),
      contact: contactRecord,
      payload: normalizedPayload,
      metadata: metadataRecord,
    },
  } satisfies InboundWhatsAppEnvelope;
};

export const listWhatsappDebugMessages = async ({
  tenantId,
  limit,
  chatId,
  direction,
}: {
  tenantId: string;
  limit: number;
  chatId: string | null;
  direction: 'INBOUND' | 'OUTBOUND' | null;
}) => {
  ensureFeatureEnabled();

  const where = buildWhereClause(tenantId, { chatId, direction });
  const records = await prisma.message.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return records.map((record) => mapPassthroughMessage(record));
};

export const processWhatsappDebugSend = async ({
  tenantId,
  payload,
}: {
  tenantId: string;
  payload: unknown;
}) => {
  ensureFeatureEnabled();

  const candidate =
    payload && typeof payload === 'object' && 'envelope' in payload
      ? (payload as { envelope: unknown }).envelope
      : payload;

  const envelope = normalizeInboundEnvelope(candidate, tenantId, 'debug:manual-send');
  const processed = await ingestInboundWhatsAppMessage(envelope);

  return { processed, envelope };
};

const extractStreamEntries = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const candidate =
      record.envelopes ?? record.events ?? record.messages ?? record.items ?? record.payload;
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  throw new ValidationError('Expected an array of envelopes', {
    field: 'envelopes',
  });
};

export const processWhatsappDebugStream = async ({
  tenantId,
  payload,
}: {
  tenantId: string;
  payload: unknown;
}) => {
  ensureFeatureEnabled();

  const entries = extractStreamEntries(payload);
  const results: Array<{ processed: boolean; envelope: InboundWhatsAppEnvelope }> = [];

  for (const entry of entries) {
    const envelope = normalizeInboundEnvelope(entry, tenantId, 'debug:stream');
    const processed = await ingestInboundWhatsAppMessage(envelope);
    results.push({ processed, envelope });
  }

  return { count: results.length, results };
};

const normalizeReplayEnvelope = (
  payload: Record<string, unknown>,
  tenantId: string
): InboundWhatsAppEnvelope => {
  const metadataRecord = normalizeMetadataRecord(payload.metadata);
  const messageRecord = cloneRecordOrNull(payload.message) ?? {};
  const contactRecord = normalizeContactRecord(payload.contact ?? messageRecord.contact);

  const normalizedPayloadSource =
    (messageRecord.payload ?? payload.payload ?? messageRecord.message) ?? {};
  const normalizedPayload = normalizePayloadRecord(normalizedPayloadSource);

  const messageId = readString(payload.messageId) ?? readString(messageRecord.id);
  const timestamp =
    readString(payload.timestamp) ?? readString(messageRecord.timestamp) ?? null;

  return {
    origin: readString(metadataRecord?.source) ?? 'debug:replay',
    instanceId:
      readString(payload.instanceId) ??
      readString(messageRecord.instanceId) ??
      readString(metadataRecord?.instanceId) ??
      'debug-instance',
    chatId:
      readString(payload.chatId) ??
      readString(messageRecord.chatId) ??
      readString(metadataRecord?.chatId) ??
      null,
    tenantId,
    message: {
      kind: 'message',
      id: messageId ?? null,
      externalId: readString(messageRecord.externalId) ?? messageId ?? null,
      brokerMessageId: readString(messageRecord.brokerMessageId),
      timestamp,
      direction: normalizeDirection(payload.direction ?? messageRecord.direction),
      contact: contactRecord,
      payload: normalizedPayload,
      metadata: metadataRecord,
    },
  } satisfies InboundWhatsAppEnvelope;
};

export const processWhatsappDebugReplay = async ({
  tenantId,
  payload,
}: {
  tenantId: string;
  payload: unknown;
}) => {
  ensureFeatureEnabled();

  const record = normalizeJsonRecord(payload);
  const eventId = readString(record.eventId ?? record.id);

  if (!eventId) {
    throw new ValidationError('eventId is required', { field: 'eventId' });
  }

  const event = await prisma.processedIntegrationEvent.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new NotFoundError('ProcessedIntegrationEvent', eventId);
  }

  const payloadRecord = normalizeJsonRecord(event.payload);
  const storedTenant = readString(payloadRecord.tenantId);

  if (storedTenant && storedTenant !== tenantId) {
    throw new ForbiddenError('Event does not belong to the provided tenant');
  }

  const envelope = normalizeReplayEnvelope(payloadRecord, tenantId);
  const processed = await ingestInboundWhatsAppMessage(envelope);

  return {
    processed,
    event: {
      id: event.id,
      source: event.source,
      createdAt: event.createdAt,
    },
    envelope,
  };
};
