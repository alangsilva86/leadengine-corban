import { logger } from '../../../config/logger';
import { getWhatsAppEventQueueStats } from '../queue/event-queue';

export interface WhatsAppEventPollerMetrics {
  running: boolean;
  cursor: string | null;
  pendingQueue: number;
  lastFetchAt: string | null;
  lastFetchCount: number;
  lastAckAt: string | null;
  lastAckCursor: string | null;
  lastAckCount: number;
  consecutiveFailures: number;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  backoffMs: number;
}

const defaultMetrics: WhatsAppEventPollerMetrics = {
  running: false,
  cursor: null,
  pendingQueue: 0,
  lastFetchAt: null,
  lastFetchCount: 0,
  lastAckAt: null,
  lastAckCursor: null,
  lastAckCount: 0,
  consecutiveFailures: 0,
  lastErrorAt: null,
  lastErrorMessage: null,
  backoffMs: 0,
};

class WhatsAppEventPoller {
  private metrics: WhatsAppEventPollerMetrics = { ...defaultMetrics };
  private started = false;

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;
    this.metrics = {
      ...this.metrics,
      running: true,
      pendingQueue: getWhatsAppEventQueueStats().pending,
      backoffMs: 0,
    };

    logger.info(
      'WhatsApp broker event poller disabled: relying on inbound webhook delivery; no background polling will run.'
    );
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    this.started = false;
    this.metrics = {
      ...defaultMetrics,
      pendingQueue: getWhatsAppEventQueueStats().pending,
    };

    logger.info('WhatsApp broker event poller stopped.');
  }

  getMetrics(): WhatsAppEventPollerMetrics {
    return { ...this.metrics };
  }
}

export const whatsappEventPoller = new WhatsAppEventPoller();

export const getWhatsAppEventPollerMetrics = (): WhatsAppEventPollerMetrics =>
  whatsappEventPoller.getMetrics();
