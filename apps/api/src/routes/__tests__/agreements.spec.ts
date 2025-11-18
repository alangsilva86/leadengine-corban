import express, { type Request, type RequestHandler } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  })),
}));

const importServiceMocks = vi.hoisted(() => ({
  enqueueImportMock: vi.fn(),
}));

const { enqueueImportMock } = importServiceMocks;

vi.mock('../../services/agreements-import-service', () => ({
  AgreementsImportService: vi.fn().mockImplementation(() => ({
    enqueueImport: importServiceMocks.enqueueImportMock,
  })),
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
    enqueueImportMock.mockResolvedValue({
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

  it('accepts PATCH /api/v1/agreements/:agreementId with a valid payload', async () => {
    const app = buildApp();
    const payload = { name: 'Convênio Atualizado', tags: ['venda-direta'] };

    const response = await request(app)
      .patch('/api/v1/agreements/agreement-1')
      .send(payload);

    expect(response.status).toBe(200);
    expect(updateAgreementMock).toHaveBeenCalledWith(
      'tenant-1',
      'agreement-1',
      payload,
      expect.objectContaining({ id: 'user-1', name: 'User' })
    );
  });

  it('rejects PATCH /api/v1/agreements/:agreementId with invalid data', async () => {
    const app = buildApp();

    const response = await request(app)
      .patch('/api/v1/agreements/agreement-1')
      .send({ slug: 'a' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    });
    expect(updateAgreementMock).not.toHaveBeenCalled();
  });

  it('delegates imports to the agreements import service', async () => {
    const app = buildApp();
    const fileBuffer = Buffer.from('first\nsecond');

    const response = await request(app)
      .post('/api/v1/agreements/agreement-1/import')
      .attach('file', fileBuffer, { filename: 'rates.csv', contentType: 'text/csv' });

    expect(response.status).toBe(202);
    expect(enqueueImportMock).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      agreementId: 'agreement-1',
      actor: expect.objectContaining({ id: 'user-1', name: 'User' }),
      origin: 'agreements-api',
      file: {
        buffer: expect.any(Buffer),
        originalName: 'rates.csv',
        size: expect.any(Number),
        mimeType: 'text/csv',
      },
    });
  });
});
