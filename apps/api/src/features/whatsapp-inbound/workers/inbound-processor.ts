import { onWhatsAppBrokerEvent, type WhatsAppBrokerEvent } from '../queue/event-queue';
import { ingestInboundWhatsAppMessage } from '../services/inbound-lead-service';
import { logger } from '../../../config/logger';
import { BrokerInboundEventSchema } from '../schemas/broker-contracts';
import { isWhatsappPassthroughModeEnabled } from '../../../config/feature-flags';

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

    const normalized = parsed.data;
    const payload = normalized.payload;
    const messageRecord = asRecord(payload.message) ? { ...(payload.message as Record<string, unknown>) } : {};
    const keyRecord = asRecord(messageRecord.key);

    const chatId =
      readString(messageRecord.chatId) ??
      readString(keyRecord?.remoteJid) ??
      readString(keyRecord?.jid) ??
      null;
    const externalId = readString(messageRecord.id) ?? readString(keyRecord?.id) ?? normalized.id;
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

    const passthroughMode = isWhatsappPassthroughModeEnabled();
    const fallbackTenant = passthroughMode ? PASSTHROUGH_TENANT_FALLBACK : null;
    const effectiveTenantId = normalized.tenantId ?? event.tenantId ?? fallbackTenant;
    if (effectiveTenantId && !metadata.tenantId) {
      metadata.tenantId = effectiveTenantId;
    }

    await ingestInboundWhatsAppMessage({
      id: normalized.id,
      instanceId: normalized.instanceId,
      direction,
      chatId,
      externalId,
      timestamp: payload.timestamp ?? null,
      contact: payload.contact ? { ...(payload.contact as Record<string, unknown>) } : {},
      message: messageRecord,
      metadata,
      tenantId: effectiveTenantId,
      sessionId: normalized.sessionId ?? event.sessionId ?? null,
    });
  } catch (error) {
    logger.error('Failed to process WhatsApp message event', {
      error,
      eventId: event.id,
      type: event.type,
    });
  }
};

onWhatsAppBrokerEvent('MESSAGE_INBOUND', handleMessageEvent);
onWhatsAppBrokerEvent('MESSAGE_OUTBOUND', handleMessageEvent);
