import { EventEmitter } from 'node:events';

import { logger } from '../../../config/logger';
import { BrokerInboundEventSchema } from '../schemas/broker-contracts';

export type WhatsAppBrokerEventType = 'MESSAGE_INBOUND' | 'MESSAGE_OUTBOUND' | 'POLL_CHOICE';

export interface WhatsAppBrokerEvent {
  id: string;
  type: WhatsAppBrokerEventType;
  payload: unknown;
  tenantId?: string;
  sessionId?: string;
  instanceId?: string;
  timestamp?: string;
  cursor?: string | null;
}

export interface NormalizedEventInput {
  id?: unknown;
  type?: unknown;
  payload?: unknown;
  tenantId?: unknown;
  sessionId?: unknown;
  instanceId?: unknown;
  timestamp?: unknown;
  cursor?: unknown;
}

const eventEmitter = new EventEmitter();
const listeners = new Map<WhatsAppBrokerEventType | '*', Set<(event: WhatsAppBrokerEvent) => unknown>>();

let pendingEvents = 0;
let tail = Promise.resolve();

const VALID_EVENT_TYPES: WhatsAppBrokerEventType[] = [
  'MESSAGE_INBOUND',
  'MESSAGE_OUTBOUND',
  'POLL_CHOICE',
];

const ensureListenerBucket = (type: WhatsAppBrokerEventType | '*') => {
  let bucket = listeners.get(type);
  if (!bucket) {
    bucket = new Set();
    listeners.set(type, bucket);
  }
  return bucket;
};

const dispatchEvent = async (event: WhatsAppBrokerEvent) => {
  const handlers = [
    ...ensureListenerBucket(event.type),
    ...ensureListenerBucket('*'),
  ];

  if (!handlers.length) {
    eventEmitter.emit('event', event);
    return;
  }

  for (const handler of handlers) {
    try {
      await handler(event);
    } catch (error) {
      logger.error('Failed to process WhatsApp event handler', { error, event, handler });
    }
  }
};

export const normalizeWhatsAppBrokerEvent = (input: NormalizedEventInput): WhatsAppBrokerEvent | null => {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const id = typeof input.id === 'string' && input.id.trim().length > 0 ? input.id.trim() : null;
  if (!id) {
    return null;
  }

  const rawType = typeof input.type === 'string' ? input.type.trim().toUpperCase() : '';
  if (!VALID_EVENT_TYPES.includes(rawType as WhatsAppBrokerEventType)) {
    return null;
  }

  const payload = 'payload' in input ? input.payload : null;
  const tenantId = typeof input.tenantId === 'string' && input.tenantId.trim().length > 0 ? input.tenantId.trim() : undefined;
  const sessionId = typeof input.sessionId === 'string' && input.sessionId.trim().length > 0 ? input.sessionId.trim() : undefined;
  const instanceId =
    typeof input.instanceId === 'string' && input.instanceId.trim().length > 0
      ? input.instanceId.trim()
      : undefined;
  const timestamp = typeof input.timestamp === 'string' && input.timestamp.trim().length > 0 ? input.timestamp.trim() : undefined;
  const cursor = typeof input.cursor === 'string' && input.cursor.trim().length > 0 ? input.cursor.trim() : null;

  if (rawType === 'MESSAGE_INBOUND') {
    const parsed = BrokerInboundEventSchema.safeParse({
      id,
      type: 'MESSAGE_INBOUND',
      tenantId,
      sessionId,
      instanceId: instanceId ?? '',
      timestamp: timestamp ?? null,
      cursor,
      payload: payload ?? {},
    });

    if (parsed.success) {
      const { timestamp: parsedTimestamp, ...rest } = parsed.data;
      return {
        ...rest,
        timestamp: parsedTimestamp ?? undefined,
      };
    }

    logger.warn('Failed to normalize inbound broker event with schema; falling back to raw payload', {
      eventId: id,
      issues: parsed.error.issues,
    });
  }

  return {
    id,
    type: rawType as WhatsAppBrokerEventType,
    payload,
    tenantId,
    sessionId,
    instanceId,
    timestamp,
    cursor,
  };
};

export const enqueueWhatsAppBrokerEvents = (events: WhatsAppBrokerEvent[]): void => {
  events.forEach((event) => {
    logger.info('📥 [Queue] Evento enfileirado', {
      eventId: event.id,
      type: event.type,
      tenantId: event.tenantId ?? null,
      instanceId: event.instanceId ?? null,
    });
    pendingEvents += 1;
    tail = tail
      .then(async () => {
        try {
          await dispatchEvent(event);
          eventEmitter.emit('processed', event);
        } catch (error) {
          logger.error('Unexpected WhatsApp event queue failure', { error, event });
        }
      })
      .finally(() => {
        pendingEvents = Math.max(0, pendingEvents - 1);
      });
  });
};

export const onWhatsAppBrokerEvent = (
  type: WhatsAppBrokerEventType | '*',
  handler: (event: WhatsAppBrokerEvent) => unknown
): (() => void) => {
  const bucket = ensureListenerBucket(type);
  bucket.add(handler);

  return () => {
    bucket.delete(handler);
  };
};

export const getWhatsAppEventQueueStats = () => ({
  pending: pendingEvents,
});

export { eventEmitter as whatsappEventQueueEmitter };
