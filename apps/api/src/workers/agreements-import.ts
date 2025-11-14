import { promises as fs } from 'node:fs';

import { logger } from '../config/logger';
import { incrementAgreementImportFailure, incrementAgreementImportSuccess } from '../lib/metrics';
import { AgreementsRepository } from '../modules/agreements/repository';
import { AgreementsService } from '../modules/agreements/service';

const DEFAULT_BATCH_SIZE = 5;

type UnknownRecord = Record<string, unknown>;

const toRecord = (value: unknown): UnknownRecord => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as UnknownRecord;
  }
  return {};
};

const normalizeTempFilePath = (metadata: UnknownRecord): string | null => {
  const raw = metadata.tempFilePath;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : null;
};

const countRows = (content: string): number => {
  const trimmed = content.trim();
  if (!trimmed) {
    return 0;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.length;
    }
  } catch {
    // ignore json parse errors and fallback to newline split
  }

  return trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
};

export interface AgreementsImportWorkerOptions {
  limit?: number;
}

export const processAgreementImportJobs = async (
  options: AgreementsImportWorkerOptions = {}
): Promise<void> => {
  const limit = Math.max(options.limit ?? DEFAULT_BATCH_SIZE, 1);
  const repository = new AgreementsRepository();
  const service = new AgreementsService({ repository });

  const pending = await repository.findPendingImportJobs(limit);
  if (!pending.length) {
    return;
  }

  for (const job of pending) {
    const claimed = await repository.markImportJobProcessing(job.id);
    if (!claimed) {
      continue;
    }

    const metadata = toRecord(claimed.metadata);
    const tempFilePath = normalizeTempFilePath(metadata);
    const metricLabels = {
      tenantId: claimed.tenantId,
      agreementId: claimed.agreementId ?? 'bulk',
      origin: 'agreements-import-worker',
    };

    try {
      let processedRows = 0;
      if (tempFilePath) {
        const content = await fs.readFile(tempFilePath, 'utf8');
        processedRows = countRows(content);
        await fs.unlink(tempFilePath).catch(() => undefined);
      }

      await service.completeImport(claimed.tenantId, claimed.id, {
        status: 'completed',
        processedRows,
        totalRows: processedRows,
        finishedAt: new Date(),
        errorCount: 0,
      });

      incrementAgreementImportSuccess(metricLabels);
      logger.info('[agreements-import-worker] job completed', {
        tenantId: claimed.tenantId,
        agreementId: claimed.agreementId ?? null,
        jobId: claimed.id,
        processedRows,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await service.completeImport(claimed.tenantId, claimed.id, {
        status: 'failed',
        errorCount: (claimed.errorCount ?? 0) + 1,
        errorMessage: message,
        finishedAt: new Date(),
      });

      incrementAgreementImportFailure(metricLabels);
      logger.error('[agreements-import-worker] job failed', {
        tenantId: claimed.tenantId,
        agreementId: claimed.agreementId ?? null,
        jobId: claimed.id,
        error: message,
      });
    }
  }
};
