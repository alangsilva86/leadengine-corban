import express, { type Request, type RequestHandler } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';

const serviceMocks = vi.hoisted(() => ({
  listAgreementsMock: vi.fn(),
  createAgreementMock: vi.fn(),
  getAgreementMock: vi.fn(),
  listHistoryMock: vi.fn(),
  updateAgreementMock: vi.fn(),
  archiveAgreementMock: vi.fn(),
  upsertWindowMock: vi.fn(),
  removeWindowMock: vi.fn(),
  upsertRateMock: vi.fn(),
  removeRateMock: vi.fn(),
  requestImportMock: vi.fn(),
}));

const {
  listAgreementsMock,
  createAgreementMock,
  getAgreementMock,
  listHistoryMock,
  updateAgreementMock,
  archiveAgreementMock,
  upsertWindowMock,
  removeWindowMock,
  upsertRateMock,
  removeRateMock,
  requestImportMock,
} = serviceMocks;

vi.mock('../../modules/agreements/service', () => ({
  AgreementsService: vi.fn().mockImplementation(() => ({
    listAgreements: serviceMocks.listAgreementsMock,
    createAgreement: serviceMocks.createAgreementMock,
    getAgreement: serviceMocks.getAgreementMock,
    listHistory: serviceMocks.listHistoryMock,
    updateAgreement: serviceMocks.updateAgreementMock,
    archiveAgreement: serviceMocks.archiveAgreementMock,
    upsertWindow: serviceMocks.upsertWindowMock,
    removeWindow: serviceMocks.removeWindowMock,
    upsertRate: serviceMocks.upsertRateMock,
    removeRate: serviceMocks.removeRateMock,
    requestImport: serviceMocks.requestImportMock,
  })),
}));

const metricsMocks = vi.hoisted(() => ({
  incrementAgreementImportEnqueuedMock: vi.fn(),
}));

const { incrementAgreementImportEnqueuedMock } = metricsMocks;

vi.mock('../../lib/metrics', () => ({
  incrementAgreementImportEnqueued: metricsMocks.incrementAgreementImportEnqueuedMock,
}));

const workerMocks = vi.hoisted(() => ({
  processAgreementImportJobsMock: vi.fn().mockResolvedValue(undefined),
}));

const { processAgreementImportJobsMock } = workerMocks;

vi.mock('../../workers/agreements-import', () => ({
  processAgreementImportJobs: workerMocks.processAgreementImportJobsMock,
}));

import { agreementsRouter } from '../agreements';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(((req, _res, next) => {
    (req as Request).user = {
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'user@example.com',
      name: 'User',
      role: 'ADMIN',
      isActive: true,
      permissions: [],
    };
    next();
  }) as RequestHandler);
  app.use('/api', agreementsRouter);
  return app;
};

describe('agreementsRouter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listAgreementsMock.mockResolvedValue({ items: [], total: 0, page: 1, limit: 25, totalPages: 0 });
    getAgreementMock.mockResolvedValue(null);
    listHistoryMock.mockResolvedValue([]);
    updateAgreementMock.mockResolvedValue({});
    archiveAgreementMock.mockResolvedValue({});
    upsertWindowMock.mockResolvedValue({});
    removeWindowMock.mockResolvedValue(undefined);
    upsertRateMock.mockResolvedValue({});
    removeRateMock.mockResolvedValue(undefined);
    requestImportMock.mockResolvedValue({
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
    processAgreementImportJobsMock.mockResolvedValue(undefined);
  });

  it('validates agreement payload before creation', async () => {
    const app = buildApp();

    const response = await request(app).post('/api/v1/agreements').send({});

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    });
    expect(createAgreementMock).not.toHaveBeenCalled();
  });

  it('stores import file and schedules worker', async () => {
    vi.useFakeTimers();
    const mkdirSpy = vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined as unknown as void);
    const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

    try {
      const app = buildApp();
      const fileBuffer = Buffer.from('first\nsecond');
      const expectedChecksum = createHash('sha256').update(fileBuffer).digest('hex');

      const response = await request(app)
        .post('/api/v1/agreements/agreement-1/import')
        .attach('file', fileBuffer, { filename: 'rates.csv', contentType: 'text/csv' });

      await vi.runAllTimersAsync();

      expect(response.status).toBe(202);
      expect(writeFileSpy).toHaveBeenCalled();
      expect(requestImportMock).toHaveBeenCalledWith('tenant-1', 'agreement-1', expect.objectContaining({
        checksum: expectedChecksum,
        fileName: 'rates.csv',
      }));
      expect(incrementAgreementImportEnqueuedMock).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        agreementId: 'agreement-1',
        origin: 'agreements-api',
      });
      expect(processAgreementImportJobsMock).toHaveBeenCalledWith({ limit: 1 });
    } finally {
      vi.useRealTimers();
      mkdirSpy.mockRestore();
      writeFileSpy.mockRestore();
    }
  });
});
