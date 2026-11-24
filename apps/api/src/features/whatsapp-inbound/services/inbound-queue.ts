import { createHash } from 'node:crypto';
import { Prisma, type InboundWebhookJob } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
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
}

const MAX_ATTEMPTS = 5;

const resolveMessageIdentity = (envelope: InboundQueueJob['envelope']) => {
  const message = envelope.message;
  return message?.kind === 'message'
    ? { externalId: message.externalId ?? message.id, direction: message.direction }
    : { externalId: message?.id, direction: undefined };
};

export const enqueueInboundWebhookJob = async (job: InboundQueueJob): Promise<void> => {
  const { tenantId, instanceId, chatId, envelope } = job;
  if (!tenantId || !instanceId || !chatId) throw new Error('Webhook scope incomplete');
  const { externalId: messageId } = resolveMessageIdentity(envelope);
  if (!messageId) throw new Error('Webhook message identifier missing');
  const eventKey = createHash('sha256').update(JSON.stringify([tenantId, instanceId, messageId])).digest('hex');
  const payload = JSON.parse(JSON.stringify(job)) as Prisma.InputJsonValue;

  await prisma.inboundWebhookJob.createMany({
    data: [{ tenantId, instanceId, conversationId: chatId, eventKey, payload }],
    skipDuplicates: true,
  });
};

export const processInboundWebhookJobs = async (limit = 20): Promise<void> => {
  for (let index = 0; index < limit; index += 1) {
    const [claimed] = await prisma.$queryRaw<InboundWebhookJob[]>`
      WITH candidate AS (
        SELECT j."sequence" FROM "inbound_webhook_jobs" j
        WHERE j."completedAt" IS NULL AND j."failedAt" IS NULL
          AND j."nextAttemptAt" <= CURRENT_TIMESTAMP
          AND (j."leaseUntil" IS NULL OR j."leaseUntil" <= CURRENT_TIMESTAMP)
          AND NOT EXISTS (
            SELECT 1 FROM "inbound_webhook_jobs" p
            WHERE p."tenantId" = j."tenantId" AND p."instanceId" = j."instanceId"
              AND p."conversationId" = j."conversationId" AND p."sequence" < j."sequence"
              AND p."completedAt" IS NULL AND p."failedAt" IS NULL
          )
        ORDER BY j."sequence"
        LIMIT 1 FOR UPDATE SKIP LOCKED
      )
      UPDATE "inbound_webhook_jobs" j SET
        "attempts" = j."attempts" + 1, "leaseUntil" = CURRENT_TIMESTAMP + INTERVAL '2 minutes'
      FROM candidate WHERE j."sequence" = candidate."sequence" RETURNING j.*
    `;
    if (!claimed) return;

    const scope = { sequence: claimed.sequence, attempts: claimed.attempts };
    const tags = { origin: 'webhook', tenantId: claimed.tenantId, instanceId: claimed.instanceId };
    try {
      const job = claimed.payload as unknown as InboundQueueJob;
      if (!job) throw new Error('Missing webhook job payload');
      const accepted = await ingestInboundWhatsAppMessage(job.envelope);
      if (!accepted) {
        const { externalId, direction } = resolveMessageIdentity(job.envelope);
        const existing = externalId && (direction === 'INBOUND' || direction === 'OUTBOUND') && await prisma.message.findFirst({
          where: { tenantId: claimed.tenantId, instanceId: claimed.instanceId, externalId, direction },
          select: { id: true },
        });
        if (!existing) throw new Error('Inbound message could not be persisted');
      }
      await prisma.inboundWebhookJob.updateMany({
        where: scope, data: { completedAt: new Date(), leaseUntil: null, payload: Prisma.DbNull },
      });
      whatsappWebhookEventsCounter.inc({ ...tags, result: 'accepted', reason: 'processed' });
    } catch {
      const exhausted = claimed.attempts >= MAX_ATTEMPTS;
      await prisma.inboundWebhookJob.updateMany({
        where: scope,
        data: {
          leaseUntil: null,
          failedAt: exhausted ? new Date() : null,
          nextAttemptAt: new Date(Date.now() + 5000 * 2 ** (claimed.attempts - 1)),
        },
      });
      whatsappWebhookEventsCounter.inc({ ...tags, result: 'failed', reason: exhausted ? 'exhausted' : 'retry' });
      logger.warn('Falha ao processar evento WhatsApp', { eventKey: claimed.eventKey, attempt: claimed.attempts, exhausted });
    }
  }
};

export const startInboundWebhookWorker = () => {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    void processInboundWebhookJobs().catch(() => {
      logger.warn('Fila de entrada WhatsApp indisponível.');
    }).finally(() => { running = false; });
  }, 1000);
  timer.unref();
  return () => clearInterval(timer);
};
