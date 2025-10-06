import { onWhatsAppBrokerEvent } from '../queue/event-queue';
import { ingestInboundWhatsAppMessage } from '../services/inbound-lead-service';
import { logger } from '../../../config/logger';
import { BrokerInboundEventSchema } from '../schemas/broker-contracts';

onWhatsAppBrokerEvent('MESSAGE_INBOUND', async (event) => {
  try {
    const parsed = BrokerInboundEventSchema.safeParse({
      ...event,
      instanceId: event.instanceId ?? '',
      payload: event.payload ?? {},
    });

    if (!parsed.success) {
      logger.warn('Skipping inbound event due to invalid schema', {
        eventId: event.id,
        issues: parsed.error.issues,
      });
      return;
    }

    const normalized = parsed.data;
    const payload = normalized.payload;

    await ingestInboundWhatsAppMessage({
      id: normalized.id,
      instanceId: normalized.instanceId,
      timestamp: payload.timestamp ?? null,
      contact: payload.contact ? { ...(payload.contact as Record<string, unknown>) } : {},
      message: (payload.message as Record<string, unknown>) || {},
      metadata: (payload.metadata as Record<string, unknown>) || {},
    });
  } catch (error) {
    logger.error('Failed to process inbound WhatsApp event', { error, eventId: event.id });
  }
});
