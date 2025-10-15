import { onWhatsAppBrokerEvent, type WhatsAppBrokerEvent } from '../queue/event-queue';
import { ingestInboundWhatsAppMessage } from '../services/inbound-lead-service';
import { logger } from '../../../config/logger';
import { BrokerInboundEventSchema } from '../schemas/broker-contracts';
import { logBaileysDebugEvent } from '../utils/baileys-event-logger';
import { emitWhatsAppDebugPhase } from '../../debug/services/whatsapp-debug-emitter';

const PASSTHROUGH_TENANT_FALLBACK = 'demo-tenant';

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const readString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

const handleMessageEvent = async (event: WhatsAppBrokerEvent) => {
  try {
    const parsed = BrokerInboundEventSchema.safeParse({
      ...event,
      type: event.type,
      instanceId: event.instanceId ?? '',
      timestamp: event.timestamp ?? null,
      cursor: event.cursor ?? null,
      payload: event.payload ?? {},
    });

    if (!parsed.success) {
      logger.warn('Skipping WhatsApp message event due to invalid schema', {
        eventId: event.id,
        type: event.type,
        issues: parsed.error.issues,
      });
      return;
    }

    logger.debug('✅ WhatsApp MESSAGE_INBOUND schema validated', {
      eventId: event.id,
      tenantId: event.tenantId ?? null,
      instanceId: event.instanceId ?? null,
    });

    const normalized = parsed.data;
    const payload = normalized.payload;
    const messageRecord = asRecord(payload.message) ? { ...(payload.message as Record<string, unknown>) } : {};
    const keyRecord = asRecord(messageRecord.key);
    const contactRecord = asRecord(payload.contact) ? { ...(payload.contact as Record<string, unknown>) } : {};

    const chatId =
      readString(messageRecord.chatId) ??
      readString(keyRecord?.remoteJid) ??
      readString(keyRecord?.jid) ??
      null;
    const externalId = readString(messageRecord.id) ?? readString(keyRecord?.id) ?? normalized.id;
    const contactRemoteJid = readString(contactRecord.remoteJid) ?? readString(contactRecord.jid);
    const direction =
      payload.direction ?? (normalized.type === 'MESSAGE_OUTBOUND' ? 'OUTBOUND' : 'INBOUND');

    const metadata =
      asRecord(payload.metadata) && payload.metadata
        ? { ...(payload.metadata as Record<string, unknown>) }
        : ({} as Record<string, unknown>);

    metadata.direction = direction;
    if (normalized.tenantId && !metadata.tenantId) {
      metadata.tenantId = normalized.tenantId;
    }
    if (normalized.sessionId && !metadata.sessionId) {
      metadata.sessionId = normalized.sessionId;
    }
    if (event.timestamp && !metadata.eventTimestamp) {
      metadata.eventTimestamp = event.timestamp;
    }
    if (event.cursor && !metadata.cursor) {
      metadata.cursor = event.cursor;
    }

    if (chatId && !metadata.chatId) {
      metadata.chatId = chatId;
    }

    const remoteJidCandidate = readString(metadata.remoteJid) ?? contactRemoteJid ?? chatId;
    if (remoteJidCandidate) {
      metadata.remoteJid = remoteJidCandidate;
    }

    emitWhatsAppDebugPhase({
      phase: 'worker:normalized',
      correlationId: normalized.id ?? event.id ?? null,
      tenantId: normalized.tenantId ?? event.tenantId ?? null,
      instanceId: normalized.instanceId ?? event.instanceId ?? null,
      chatId,
      tags: ['worker'],
      context: {
        eventId: event.id,
        cursor: event.cursor ?? null,
        brokerType: event.type,
        direction,
        origin: 'broker',
      },
      payload: {
        message: messageRecord,
        contact: contactRecord,
        metadata,
      },
    });

    const fallbackTenant = PASSTHROUGH_TENANT_FALLBACK;
    const effectiveTenantId = normalized.tenantId ?? event.tenantId ?? fallbackTenant;
    if (effectiveTenantId && !metadata.tenantId) {
      metadata.tenantId = effectiveTenantId;
    }

    const debugSourceCandidate = readString(metadata.source);
    const metadataConnector = readString(metadata.connector);
    const metadataIntegration = readString(metadata.integration);

    let debugSource: string | null = null;
    if (debugSourceCandidate && debugSourceCandidate.toLowerCase().includes('baileys')) {
      debugSource = debugSourceCandidate;
    } else if (metadataConnector && metadataConnector.toLowerCase().includes('baileys')) {
      debugSource = metadataConnector;
    } else if (metadataIntegration && metadataIntegration.toLowerCase().includes('baileys')) {
      debugSource = metadataIntegration;
    } else if (remoteJidCandidate) {
      debugSource = 'baileys:message_inbound';
    }

    if (debugSource) {
      await logBaileysDebugEvent(debugSource, {
        eventId: normalized.id,
        tenantId: effectiveTenantId ?? null,
        direction,
        instanceId: normalized.instanceId,
        sessionId: normalized.sessionId ?? event.sessionId ?? null,
        chatId,
        remoteJid: metadata.remoteJid ?? null,
        messageId: externalId,
        timestamp: payload.timestamp ?? null,
        metadata,
        contact: contactRecord,
        message: messageRecord,
        rawPayload: payload,
        queueCursor: event.cursor ?? null,
      });
    }

    const persisted = await ingestInboundWhatsAppMessage({
      origin: 'broker',
      instanceId: normalized.instanceId,
      chatId,
      tenantId: effectiveTenantId,
      message: {
        kind: 'message',
        id: normalized.id,
        externalId,
        brokerMessageId: normalized.id,
        timestamp: payload.timestamp ?? null,
        direction: direction === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND',
        contact: payload.contact ? { ...(payload.contact as Record<string, unknown>) } : {},
        payload: messageRecord,
        metadata: {
          ...metadata,
          sessionId: normalized.sessionId ?? event.sessionId ?? null,
        },
      },
      raw: {
        queueCursor: event.cursor ?? null,
        brokerEventId: event.id,
        brokerType: event.type,
      },
    });

    if (!persisted) {
      logger.error('🎯 LeadEngine • WhatsApp :: 🪀 Worker ingestão não confirmou persistência', {
        eventId: event.id,
        tenantId: effectiveTenantId ?? null,
        instanceId: normalized.instanceId ?? null,
        messageId: externalId,
        chatId,
      });
      throw new Error('Inbound WhatsApp message ingestion did not persist the message');
    }

    logger.info('🎯 LeadEngine • WhatsApp :: 🚚 Worker encaminhou mensagem com sucesso', {
      eventId: event.id,
      tenantId: effectiveTenantId ?? null,
      instanceId: normalized.instanceId ?? null,
      messageId: externalId,
      chatId,
    });
  } catch (error) {
    logger.error('Failed to process WhatsApp message event', {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      eventId: event.id,
      type: event.type,
    });
  }
};

onWhatsAppBrokerEvent('MESSAGE_INBOUND', handleMessageEvent);
onWhatsAppBrokerEvent('MESSAGE_OUTBOUND', handleMessageEvent);
