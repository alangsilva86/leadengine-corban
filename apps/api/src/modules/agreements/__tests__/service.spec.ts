import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgreementImportJobRecord, AgreementsRepository, AgreementRecord } from '../repository';
import { AgreementsService } from '../service';

const buildLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

describe('AgreementsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const slugConflictError = {
    name: 'PrismaClientKnownRequestError',
    code: 'P2002',
    meta: {
      target: ['agreements_tenantId_slug_key'],
    },
  };

  it('rejects updates when agreement does not belong to tenant', async () => {
    const repository: Partial<AgreementsRepository> = {
      findAgreementById: vi.fn().mockResolvedValue(null),
      updateAgreement: vi.fn(),
    };

    const service = new AgreementsService({
      repository: repository as AgreementsRepository,
      logger: buildLogger(),
      emitAgreementEvent: vi.fn(),
      emitTenantEvent: vi.fn(),
    });

    await expect(
      service.updateAgreement('tenant-1', 'agreement-1', { name: 'Novo', slug: 'novo' }, { id: 'actor', name: 'Actor' })
    ).rejects.toMatchObject({ code: 'AGREEMENT_NOT_FOUND' });

    expect(repository.findAgreementById).toHaveBeenCalledWith('tenant-1', 'agreement-1');
    expect(repository.updateAgreement).not.toHaveBeenCalled();
  });

  it('returns a friendly error when slug already exists during creation', async () => {
    const repository: Partial<AgreementsRepository> = {
      createAgreement: vi.fn().mockRejectedValue(slugConflictError),
    };

    const logger = buildLogger();
    const service = new AgreementsService({
      repository: repository as AgreementsRepository,
      logger,
    });

    await expect(
      service.createAgreement('tenant-1', { name: 'Novo Convênio', slug: 'novo-convenio' }, { id: 'actor', name: 'Actor' })
    ).rejects.toMatchObject({ code: 'AGREEMENT_SLUG_CONFLICT', status: 409 });

    expect(repository.createAgreement).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      '[/agreements] slug conflict on create',
      expect.objectContaining({ tenantId: 'tenant-1', slug: 'novo-convenio' })
    );
  });

  it('returns a friendly error when slug already exists during update', async () => {
    const existing: AgreementRecord = {
      id: 'agreement-1',
      tenantId: 'tenant-1',
      name: 'Convênio existente',
      slug: 'existing',
      status: 'draft',
      type: null,
      segment: null,
      description: null,
      tags: [],
      products: {},
      metadata: {},
      archived: false,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      tables: [],
      windows: [],
      rates: [],
      history: [],
    };

    const repository: Partial<AgreementsRepository> = {
      findAgreementById: vi.fn().mockResolvedValue(existing),
      updateAgreement: vi.fn().mockRejectedValue(slugConflictError),
    };

    const logger = buildLogger();
    const service = new AgreementsService({
      repository: repository as AgreementsRepository,
      logger,
    });

    await expect(
      service.updateAgreement('tenant-1', 'agreement-1', { slug: 'novo-convenio' }, { id: 'actor', name: 'Actor' })
    ).rejects.toMatchObject({ code: 'AGREEMENT_SLUG_CONFLICT', status: 409 });

    expect(logger.warn).toHaveBeenCalledWith(
      '[/agreements] slug conflict on update',
      expect.objectContaining({ tenantId: 'tenant-1', agreementId: 'agreement-1', slug: 'novo-convenio' })
    );
  });

  it('returns existing import job when checksum was already processed', async () => {
    const job: AgreementImportJobRecord = {
      id: 'job-1',
      tenantId: 'tenant-1',
      agreementId: 'agreement-1',
      source: 'api',
      fileKey: null,
      fileName: 'import.csv',
      checksum: 'abc123',
      status: 'completed',
      totalRows: 10,
      processedRows: 10,
      errorCount: 0,
      startedAt: new Date('2024-01-01T00:00:00.000Z'),
      finishedAt: new Date('2024-01-01T00:05:00.000Z'),
      errorMessage: null,
      metadata: {},
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:05:00.000Z'),
    };

    const repository: Partial<AgreementsRepository> = {
      findImportJobByChecksum: vi.fn().mockResolvedValue(job),
      createImportJob: vi.fn(),
    };

    const service = new AgreementsService({
      repository: repository as AgreementsRepository,
      logger: buildLogger(),
    });

    const result = await service.requestImport('tenant-1', 'agreement-1', {
      agreementId: 'agreement-1',
      checksum: 'abc123',
      fileName: 'import.csv',
      mimeType: 'text/csv',
      size: 1024,
      tempFilePath: '/tmp/file.csv',
    });

    expect(result.id).toBe('job-1');
    expect(repository.createImportJob).not.toHaveBeenCalled();
  });

  it('records history entries when import completes', async () => {
    const appendHistoryEntry = vi.fn();
    const repository: Partial<AgreementsRepository> = {
      updateImportJob: vi.fn().mockImplementation(async (_tenantId, _jobId, updates) => ({
        id: 'job-2',
        tenantId: 'tenant-2',
        agreementId: 'agreement-2',
        source: 'api',
        fileKey: null,
        fileName: 'import.csv',
        checksum: 'checksum',
        status: updates.status ?? 'completed',
        totalRows: updates.totalRows ?? 4,
        processedRows: updates.processedRows ?? 4,
        errorCount: updates.errorCount ?? 0,
        startedAt: updates.startedAt ?? new Date('2024-01-02T00:00:00.000Z'),
        finishedAt: updates.finishedAt ?? new Date('2024-01-02T00:05:00.000Z'),
        errorMessage: updates.errorMessage ?? null,
        metadata: {},
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:05:00.000Z'),
      } as AgreementImportJobRecord)),
      appendHistoryEntry,
    };

    const service = new AgreementsService({
      repository: repository as AgreementsRepository,
      logger: buildLogger(),
    });

    await service.completeImport('tenant-2', 'job-2', {
      status: 'completed',
      processedRows: 4,
      totalRows: 4,
      finishedAt: new Date('2024-01-02T00:05:00.000Z'),
    });

    expect(appendHistoryEntry).toHaveBeenCalledWith('tenant-2', 'agreement-2', expect.objectContaining({
      action: 'import.completed',
      metadata: expect.objectContaining({ jobId: 'job-2', status: 'completed' }),
    }));
  });
});
