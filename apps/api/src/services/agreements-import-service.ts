import { createHash, randomUUID } from 'node:crypto';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';

import type { ActorContext, AgreementImportJobDto, AgreementsService } from '../modules/agreements/service';
import { logger as defaultLogger } from '../config/logger';
import { incrementAgreementImportEnqueued } from '../lib/metrics';
import { processAgreementImportJobs } from '../workers/agreements-import';

const DEFAULT_TMP_DIR = path.join(process.cwd(), 'tmp', 'agreements-import');

type FileSystem = typeof fsPromises;

type AgreementsImportMetrics = typeof incrementAgreementImportEnqueued;
type AgreementsImportWorker = typeof processAgreementImportJobs;
type Scheduler = (callback: () => void) => void;

interface AgreementsImportServiceOptions {
  agreementsService: AgreementsService;
  fs?: FileSystem;
  logger?: typeof defaultLogger;
  metrics?: { incrementAgreementImportEnqueued: AgreementsImportMetrics };
  worker?: { processAgreementImportJobs: AgreementsImportWorker };
  tmpDir?: string;
  scheduler?: Scheduler;
}

interface ImportFilePayload {
  buffer: Buffer;
  originalName?: string | null;
  size?: number | null;
  mimeType?: string | null;
}

interface EnqueueImportOptions {
  tenantId: string;
  agreementId: string;
  actor: ActorContext | null;
  file: ImportFilePayload;
  origin?: string;
}

export class AgreementsImportService {
  private readonly agreementsService: AgreementsService;
  private readonly fs: FileSystem;
  private readonly tmpDir: string;
  private readonly logger: typeof defaultLogger;
  private readonly incrementImportMetric: AgreementsImportMetrics;
  private readonly runWorker: AgreementsImportWorker;
  private readonly scheduler: Scheduler;

  constructor(options: AgreementsImportServiceOptions) {
    this.agreementsService = options.agreementsService;
    this.fs = options.fs ?? fsPromises;
    this.tmpDir = options.tmpDir ?? DEFAULT_TMP_DIR;
    this.logger = options.logger ?? defaultLogger;
    this.incrementImportMetric = options.metrics?.incrementAgreementImportEnqueued ?? incrementAgreementImportEnqueued;
    this.runWorker = options.worker?.processAgreementImportJobs ?? processAgreementImportJobs;
    this.scheduler = options.scheduler ?? ((callback) => setImmediate(callback));
  }

  async enqueueImport({ tenantId, agreementId, actor, file, origin = 'agreements-api' }: EnqueueImportOptions): Promise<AgreementImportJobDto> {
    await this.fs.mkdir(this.tmpDir, { recursive: true });
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const originalName = (file.originalName && file.originalName.trim()) || null;
    const tempFileName = `${Date.now()}-${randomUUID()}-${originalName ?? 'agreements-import.tmp'}`;
    const tempFilePath = path.join(this.tmpDir, tempFileName);
    await this.fs.writeFile(tempFilePath, file.buffer);

    const job = await this.agreementsService.requestImport(
      tenantId,
      agreementId,
      {
        agreementId,
        checksum,
        fileName: originalName ?? 'agreements-import.csv',
        tempFilePath,
        size: typeof file.size === 'number' ? file.size : file.buffer.length,
        mimeType: file.mimeType ?? 'application/octet-stream',
      },
      actor
    );

    this.incrementImportMetric({ tenantId, agreementId, origin });

    this.scheduler(() => {
      this.runWorker({ limit: 1 }).catch((error) => {
        this.logger.error('[/agreements] import worker failed', {
          tenantId,
          agreementId,
          jobId: job.id,
          error,
        });
      });
    });

    return job;
  }
}
