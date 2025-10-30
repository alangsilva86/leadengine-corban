import { logger } from '../../../../config/logger';
import {
  BrokerInboundEventSchema,
  type BrokerInboundContact,
  type BrokerInboundEvent,
} from '../../schemas/broker-contracts';
import type { NormalizedRawUpsertMessage } from '../../services/baileys-raw-normalizer';
import { asRecord, readNumber, readString } from '../../utils/webhook-parsers';
import { sanitizeMetadataValue, toRawPreview } from './helpers';

type NormalizeContractEventOptions = {
  requestId: string;
  instanceOverride?: string | null;
  tenantOverride?: string | null;
  brokerOverride?: string | null;
};

export const normalizeContractEvent = (
  eventRecord: Record<string, unknown>,
  options: NormalizeContractEventOptions
): NormalizedRawUpsertMessage | null => {
  const hasType = readString((eventRecord as { type?: unknown }).type);
  const fallbackEvent = readString((eventRecord as { event?: unknown }).event);
  const recordWithType =
    !hasType && fallbackEvent
      ? ({ ...eventRecord, type: fallbackEvent } as Record<string, unknown>)
      : eventRecord;

  const payloadRecord = asRecord((recordWithType as { payload?: unknown }).payload);
  const envelopeInstanceId =
    readString(options.instanceOverride, (eventRecord as { instanceId?: unknown }).instanceId) ?? null;

  if (payloadRecord) {
    if (!readString((payloadRecord as { instanceId?: unknown }).instanceId) && envelopeInstanceId) {
      payloadRecord.instanceId = envelopeInstanceId;
    }
    (recordWithType as Record<string, unknown>).payload = payloadRecord;
  } else if (envelopeInstanceId) {
    (recordWithType as Record<string, unknown>).payload = {
      instanceId: envelopeInstanceId,
    };
  }

  const parsed = BrokerInboundEventSchema.safeParse(recordWithType);
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
  const metadataBrokerInput = asRecord(metadataInput.broker);
  const messageUpsertType =
    readString(
      (metadataBrokerInput as { messageType?: unknown })?.messageType,
      (asRecord(sanitizedMetadata.broker) as { messageType?: unknown } | null)?.messageType
    ) ?? null;
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
    messageUpsertType,
    isGroup,
  };

  return normalized;
};

export type { NormalizeContractEventOptions };
