import { setImmediate as scheduleImmediate } from 'node:timers';

import { logger } from '../../../config/logger';
import { whatsappWebhookEventsCounter } from '../../../lib/metrics';
import { ingestInboundWhatsAppMessage } from './inbound-lead-service';

interface InboundQueueJob {
  requestId: string;
  tenantId: string | null;
  instanceId: string | null;
  chatId: string | null;
  normalizedIndex: number | null;
  envelope: Parameters<typeof ingestInboundWhatsAppMessage>[0];
  route?: 'front' | 'server';
  flags?: { skipServerAi?: boolean } | null;
}

const queue: InboundQueueJob[] = [];

let processing = false;

const idleResolvers: Array<() => void> = [];

const notifyIdle = () => {
  if (processing || queue.length > 0) {
    return;
  }

  while (idleResolvers.length > 0) {
    const resolve = idleResolvers.shift();
    resolve?.();
  }
};

const nextTick = (callback: () => void) => {
  scheduleImmediate(callback);
};

const processQueue = async (): Promise<void> => {
  if (processing) {
    logger.warn('📥 INBOUND QUEUE :: ⏸️ Já processando, aguardando...');
    return;
  }

  processing = true;
  
  logger.warn('📥 INBOUND QUEUE :: 🚀 INICIANDO processamento da fila', {
    queueLength: queue.length,
  });

  while (queue.length > 0) {
    const job = queue.shift();
    if (!job) {
      continue;
    }

    const { requestId, tenantId, instanceId, chatId, normalizedIndex, envelope } = job;

    // Enforce route/flags into envelope metadata before ingestion
    try {
      const msg = (envelope as any)?.message ?? ((envelope as any).envelope?.message);
      const metadata = (msg?.metadata ||= {});
      const metaFlags = (metadata.flags ||= {});
      if (job.route === 'front') {
        metaFlags.skipServerAi = true; // hard guard: do not trigger server-side AI
        (metadata.aiRouteMode ||= 'front');
      } else if (job.route === 'server') {
        (metadata.aiRouteMode ||= 'server');
      }
    } catch (_) {
      // best-effort; do not break ingestion if envelope structure differs
    }
    
    logger.warn('📥 INBOUND QUEUE :: ⚙️ PROCESSANDO job', {
      requestId,
      tenantId,
      instanceId,
      chatId,
      remainingInQueue: queue.length,
      route: job.route ?? 'server',
      flags: job.flags ?? null,
    });

    try {
      const startedAt = Date.now();
      const processed = await ingestInboundWhatsAppMessage(envelope);
      const durationMs = Date.now() - startedAt;
      
      logger.warn('📥 INBOUND QUEUE :: 📊 Resultado do ingest', {
        requestId,
        processed,
        tenantId,
        instanceId,
        durationMs,
      });

      if (processed) {
        whatsappWebhookEventsCounter.inc({
          origin: 'webhook',
          tenantId: tenantId ?? 'unknown',
          instanceId: instanceId ?? 'unknown',
          result: 'accepted',
          reason: job.route === 'front' ? 'ok_front' : 'ok_server',
        });

        logger.info('🎯 LeadEngine • WhatsApp :: 🎉 Webhook ingestão concluída', {
          requestId,
          tenantId,
          instanceId,
          chatId,
          normalizedIndex,
        });
      } else {
        whatsappWebhookEventsCounter.inc({
          origin: 'webhook',
          tenantId: tenantId ?? 'unknown',
          instanceId: instanceId ?? 'unknown',
          result: 'failed',
          reason: job.route === 'front' ? 'ingest_failed_front' : 'ingest_failed_server',
        });

        logger.warn('🎯 LeadEngine • WhatsApp :: 🎭 Webhook ingestão não persistiu mensagem', {
          requestId,
          tenantId,
          instanceId,
          chatId,
          normalizedIndex,
        });
      }
    } catch (error) {
      whatsappWebhookEventsCounter.inc({
        origin: 'webhook',
        tenantId: tenantId ?? 'unknown',
        instanceId: instanceId ?? 'unknown',
        result: 'failed',
        reason: 'persist_error',
      });

      logger.error('Failed to persist inbound WhatsApp message', {
        requestId,
        tenantId,
        chatId,
        error,
      });
    }
  }

  processing = false;
  notifyIdle();
};

export const enqueueInboundWebhookJob = (job: InboundQueueJob): void => {
  logger.warn('📥 INBOUND QUEUE :: ➡️ ENFILEIRANDO mensagem', {
    requestId: job.requestId,
    tenantId: job.tenantId,
    instanceId: job.instanceId,
    chatId: job.chatId,
    queueLength: queue.length + 1,
    route: job.route ?? 'server',
    flags: job.flags ?? null,
  });
  
  queue.push(job);
  nextTick(processQueue);
};

const waitForIdle = async (): Promise<void> => {
  if (!processing && queue.length === 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    idleResolvers.push(resolve);
  });
};

const resetQueue = (): void => {
  queue.splice(0, queue.length);
  processing = false;
  notifyIdle();
};

export const __testing = {
  waitForIdle,
  resetQueue,
};

export type { InboundQueueJob };
