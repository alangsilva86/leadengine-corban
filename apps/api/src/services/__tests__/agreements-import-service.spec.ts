import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgreementsService, ActorContext, AgreementImportJobDto } from '../../modules/agreements/service';
import { AgreementsImportService } from '../agreements-import-service';

describe('AgreementsImportService', () => {
  const logger = {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };

  const buildJob = (): AgreementImportJobDto => ({
    id: 'job-1',
    agreementId: 'agreement-1',
    status: 'pending',
    checksum: 'checksum',
    fileName: 'import.csv',
    totalRows: 0,
    processedRows: 0,
    errorCount: 0,
    createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    startedAt: null,
    finishedAt: null,
    errorMessage: null,
  });

  let agreementsService: { requestImport: ReturnType<typeof vi.fn> };
  let fs: { mkdir: ReturnType<typeof vi.fn>; writeFile: ReturnType<typeof vi.fn> };
  let incrementAgreementImportEnqueued: ReturnType<typeof vi.fn>;
  let processAgreementImportJobs: ReturnType<typeof vi.fn>;
  let scheduler: ReturnType<typeof vi.fn>;
  let service: AgreementsImportService;

  beforeEach(() => {
    agreementsService = {
      requestImport: vi.fn(),
    };
    fs = {
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
    };
    incrementAgreementImportEnqueued = vi.fn();
    processAgreementImportJobs = vi.fn().mockResolvedValue(undefined);
    scheduler = vi.fn((callback: () => void) => callback());

    service = new AgreementsImportService({
      agreementsService: agreementsService as unknown as AgreementsService,
      fs: fs as unknown as typeof import('node:fs').promises,
      metrics: { incrementAgreementImportEnqueued },
      worker: { processAgreementImportJobs },
      scheduler,
      logger: logger as never,
      tmpDir: '/tmp/agreements-test',
    });

    vi.clearAllMocks();
  });

  it('persists file, enqueues job and schedules worker', async () => {
    const fileBuffer = Buffer.from('first\nsecond');
    const checksum = createHash('sha256').update(fileBuffer).digest('hex');
    const actor: ActorContext = { id: 'user-1', name: 'User 1', type: 'user' };
    const job = buildJob();
    agreementsService.requestImport.mockResolvedValue(job);

    const result = await service.enqueueImport({
      tenantId: 'tenant-1',
      agreementId: 'agreement-1',
      actor,
      origin: 'agreements-api',
      file: {
        buffer: fileBuffer,
        originalName: 'rates.csv',
        mimeType: 'text/csv',
        size: fileBuffer.length,
      },
    });

    expect(fs.mkdir).toHaveBeenCalledWith('/tmp/agreements-test', { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);

    expect(agreementsService.requestImport).toHaveBeenCalledWith(
      'tenant-1',
      'agreement-1',
      expect.objectContaining({
        checksum,
        fileName: 'rates.csv',
        size: fileBuffer.length,
        mimeType: 'text/csv',
        tempFilePath: expect.stringContaining('/tmp/agreements-test/'),
      }),
      actor
    );

    const writtenPath = fs.writeFile.mock.calls[0][0];
    expect(agreementsService.requestImport.mock.calls[0][2].tempFilePath).toBe(writtenPath);

    expect(incrementAgreementImportEnqueued).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      agreementId: 'agreement-1',
      origin: 'agreements-api',
    });
    expect(processAgreementImportJobs).toHaveBeenCalledWith({ limit: 1 });
    expect(scheduler).toHaveBeenCalledTimes(1);
    expect(result).toEqual(job);
  });

  it('propagates storage errors before creating jobs', async () => {
    const fileBuffer = Buffer.from('content');
    fs.writeFile.mockRejectedValueOnce(new Error('disk-full'));

    await expect(
      service.enqueueImport({
        tenantId: 'tenant-1',
        agreementId: 'agreement-1',
        actor: null,
        file: {
          buffer: fileBuffer,
        },
      })
    ).rejects.toThrow('disk-full');

    expect(agreementsService.requestImport).not.toHaveBeenCalled();
    expect(incrementAgreementImportEnqueued).not.toHaveBeenCalled();
    expect(processAgreementImportJobs).not.toHaveBeenCalled();
  });

  it('logs worker failures without interrupting request', async () => {
    const job = buildJob();
    agreementsService.requestImport.mockResolvedValue(job);
    processAgreementImportJobs.mockRejectedValueOnce(new Error('worker-down'));

    await service.enqueueImport({
      tenantId: 'tenant-1',
      agreementId: 'agreement-1',
      actor: null,
      file: { buffer: Buffer.from('data') },
    });

    await Promise.resolve();

    expect(logger.error).toHaveBeenCalledWith('[/agreements] import worker failed', {
      tenantId: 'tenant-1',
      agreementId: 'agreement-1',
      jobId: job.id,
      error: expect.any(Error),
    });
  });
});
