import { onWhatsAppBrokerEvent } from '../queue/event-queue';
import { ingestInboundWhatsAppMessage } from '../services/inbound-lead-service';
import { logger } from '../../../config/logger';

onWhatsAppBrokerEvent('MESSAGE_INBOUND', async (event) => {
  try {
    if (!event.payload || typeof event.payload !== 'object') {
      logger.warn('Skipping inbound event without payload', { eventId: event.id });
      return;
    }

    const payload = event.payload as Record<string, unknown>;
    const instanceId = event.instanceId || (typeof payload.instanceId === 'string' ? payload.instanceId : undefined);

    if (!instanceId) {
      logger.warn('Skipping inbound event without instanceId', { eventId: event.id });
      return;
    }

    await ingestInboundWhatsAppMessage({
      id: event.id,
      instanceId,
      timestamp: event.timestamp ?? (typeof payload.timestamp === 'string' ? payload.timestamp : null),
      contact: (payload.contact as Record<string, unknown>) || {},
      message: (payload.message as Record<string, unknown>) || {},
      metadata: (payload.metadata as Record<string, unknown>) || {},
    });
  } catch (error) {
    logger.error('Failed to process inbound WhatsApp event', { error, eventId: event.id });
  }
});
