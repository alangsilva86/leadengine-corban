import { Buffer } from 'node:buffer';

import {
  completeInboundMediaJob,
  failInboundMediaJob,
  findPendingInboundMediaJobs,
  markInboundMediaJobProcessing,
  rescheduleInboundMediaJob,
  updateMessage as storageUpdateMessage,
  type InboundMediaJob,
} from '@ticketz/storage';

import { logger } from '../config/logger';
import { downloadInboundMediaFromBroker } from '../features/whatsapp-inbound/services/media-downloader';
import { inboundMediaRetryAttemptsCounter, inboundMediaRetryDlqCounter, inboundMediaRetrySuccessCounter } from '../lib/metrics';
import { saveWhatsAppMedia } from '../services/whatsapp-media-service';

const DEFAULT_BATCH_SIZE = 10;
const MAX_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 60_000;
const MAX_RETRY_DELAY_MS = 30 * 60_000;

const computeBackoffDelay = (attempts: number): number => {
  const exponent = Math.max(attempts - 1, 0);
  const delay = BASE_RETRY_DELAY_MS * 2 ** exponent;
  return Math.min(delay, MAX_RETRY_DELAY_MS);
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const readNullableString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

const readNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeErrorMessage = (error: unknown): string => {
  if (error instanceof Error && typeof error.message === 'string') {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
};

const buildLabels = (job: InboundMediaJob) => ({
  origin: 'media-worker',
  tenantId: job.tenantId,
  instanceId: job.instanceId ?? 'unknown',
});

const shouldPersistMedia = (result: { buffer: Buffer } | null): result is { buffer: Buffer; mimeType?: string | null; fileName?: string | null; size?: number | null } =>
  Boolean(result && Buffer.isBuffer(result.buffer) && result.buffer.length > 0);

export interface MediaRetryWorkerOptions {
  limit?: number;
  now?: Date;
}

export const processInboundMediaRetryJobs = async (options: MediaRetryWorkerOptions = {}): Promise<void> => {
  const limit = Math.max(options.limit ?? DEFAULT_BATCH_SIZE, 1);
  const referenceDate = options.now ?? new Date();

  const pendingJobs = await findPendingInboundMediaJobs(limit, referenceDate);
  if (!pendingJobs.length) {
    return;
  }

  for (const job of pendingJobs) {
    const claimed = await markInboundMediaJobProcessing(job.id);
    if (!claimed) {
      continue;
    }

    const labels = buildLabels(claimed);
    inboundMediaRetryAttemptsCounter.inc(labels);

    try {
      const downloadResult = await downloadInboundMediaFromBroker({
        brokerId: claimed.brokerId,
        instanceId: claimed.instanceId,
        tenantId: claimed.tenantId,
        mediaKey: claimed.mediaKey,
        directPath: claimed.directPath,
        mediaType: claimed.mediaType,
        messageId: claimed.messageExternalId ?? claimed.messageId,
      });

      if (!shouldPersistMedia(downloadResult)) {
        throw new Error('Inbound media download returned empty payload');
      }

      const metadataRecord = toRecord(claimed.metadata);
      const descriptor = await saveWhatsAppMedia({
        buffer: downloadResult.buffer,
        tenantId: claimed.tenantId,
        instanceId: claimed.instanceId,
        messageId: claimed.messageExternalId ?? claimed.messageId,
        originalName: readNullableString(metadataRecord.fileName) ?? downloadResult.fileName ?? undefined,
        mimeType: readNullableString(metadataRecord.mimeType) ?? downloadResult.mimeType ?? undefined,
      });

      const resolvedMime = downloadResult.mimeType ?? readNullableString(metadataRecord.mimeType);
      const resolvedSize = downloadResult.size ?? readNullableNumber(metadataRecord.size);

      await storageUpdateMessage(claimed.tenantId, claimed.messageId, {
        mediaUrl: descriptor.mediaUrl,
        mediaFileName: readNullableString(metadataRecord.fileName) ?? downloadResult.fileName ?? null,
        mediaType: resolvedMime ?? null,
        mediaSize: resolvedSize ?? null,
        metadata: {
          media_pending: false,
          media: {
            url: descriptor.mediaUrl,
            urlExpiresInSeconds: descriptor.expiresInSeconds,
            mimetype: resolvedMime ?? undefined,
            size: resolvedSize ?? undefined,
            fileName:
              readNullableString(metadataRecord.fileName) ?? downloadResult.fileName ?? undefined,
          },
        },
      });

      await completeInboundMediaJob(claimed.id);
      inboundMediaRetrySuccessCounter.inc(labels);

      logger.info('🎯 LeadEngine • WhatsApp :: ♻️ Mídia inbound reprocessada com sucesso', {
        tenantId: claimed.tenantId,
        instanceId: claimed.instanceId ?? null,
        messageId: claimed.messageId,
        attempts: claimed.attempts,
      });
    } catch (error) {
      const attempts = claimed.attempts;
      const message = normalizeErrorMessage(error);

      if (attempts >= MAX_ATTEMPTS) {
        await failInboundMediaJob(claimed.id, message);
        inboundMediaRetryDlqCounter.inc(labels);
        logger.error('🎯 LeadEngine • WhatsApp :: ❌ Mídia inbound enviada para DLQ após falhas consecutivas', {
          tenantId: claimed.tenantId,
          instanceId: claimed.instanceId ?? null,
          messageId: claimed.messageId,
          attempts,
          error: message,
        });
        continue;
      }

      const delayMs = computeBackoffDelay(attempts);
      const nextRetryAt = new Date(Date.now() + delayMs);
      await rescheduleInboundMediaJob(claimed.id, nextRetryAt, message);

      logger.warn('🎯 LeadEngine • WhatsApp :: 🔁 Falha ao reprocessar mídia inbound — reagendando', {
        tenantId: claimed.tenantId,
        instanceId: claimed.instanceId ?? null,
        messageId: claimed.messageId,
        attempts,
        nextRetryAt: nextRetryAt.toISOString(),
        error: message,
      });
    }
  }
};

export const __testing = {
  computeBackoffDelay,
  normalizeErrorMessage,
};
