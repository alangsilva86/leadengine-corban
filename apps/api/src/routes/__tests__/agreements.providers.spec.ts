import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser } from '../../middleware/auth';

const runSyncMock = vi.fn();
const listStatusesMock = vi.fn();
const getStatusMock = vi.fn();
const listSettingsMock = vi.fn();
const getSettingsMock = vi.fn();

vi.mock('../../workers/agreements-sync', () => ({
  runAgreementsSync: (...args: unknown[]) => runSyncMock(...args),
  listProviderStatuses: (...args: unknown[]) => listStatusesMock(...args),
  getProviderStatus: (...args: unknown[]) => getStatusMock(...args),
}));

vi.mock('../../services/integrations/banks', () => ({
  listBankIntegrationSettings: (...args: unknown[]) => listSettingsMock(...args),
  getBankIntegrationSettings: (...args: unknown[]) => getSettingsMock(...args),
}));

const buildApp = async () => {
  const app = express();
  app.use(express.json());

  const user: AuthenticatedUser = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'user@example.com',
    name: 'Tester',
    role: 'ADMIN',
    isActive: true,
    permissions: [],
  };

  app.use((req, _res, next) => {
    req.user = user;
    next();
  });

  const { agreementsProvidersRouter } = await import('../agreements.providers');
  app.use('/api/v1/agreements', agreementsProvidersRouter);

  return app;
};

describe('Agreements providers router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listSettingsMock.mockReset();
    getSettingsMock.mockReset();
    listStatusesMock.mockReset();
    runSyncMock.mockReset();
    getStatusMock.mockReset();
  });

  it('lists providers with current status and meta information', async () => {
    listSettingsMock.mockReturnValueOnce([
      {
        id: 'atlas-promotora',
        name: 'Atlas',
        enabled: true,
        deprecated: false,
        sunsetAt: null,
        tags: ['consignado'],
      },
      {
        id: 'zenite-finance',
        name: 'Zênite',
        enabled: true,
        deprecated: true,
        sunsetAt: '2025-01-01T00:00:00.000Z',
        tags: [],
      },
    ]);
    listStatusesMock.mockReturnValueOnce([
      {
        providerId: 'atlas-promotora',
        status: 'succeeded',
        meta: { traceId: 'trace-a', timestamp: '2024-03-01T10:00:00.000Z' },
        stats: { agreements: 10, rates: 5, tables: 2 },
        enabled: true,
        deprecated: false,
        sunsetAt: null,
        lastSuccessAt: '2024-03-01T09:59:00.000Z',
      },
      {
        providerId: 'zenite-finance',
        status: 'failed',
        meta: { traceId: 'trace-b', timestamp: '2024-03-01T10:05:00.000Z' },
        stats: null,
        enabled: true,
        deprecated: true,
        sunsetAt: '2025-01-01T00:00:00.000Z',
        lastSuccessAt: null,
        error: { message: 'Falha', code: 'TIMEOUT' },
      },
    ]);

    const app = await buildApp();

    const response = await request(app).get('/api/v1/agreements/providers');

    expect(response.status).toBe(200);
    expect(response.headers.deprecation).toBeDefined();
    expect(response.body).toMatchObject({
      success: true,
      data: {
        providers: expect.arrayContaining([
          expect.objectContaining({ id: 'atlas-promotora', status: 'succeeded' }),
          expect.objectContaining({ id: 'zenite-finance', deprecated: true }),
        ]),
      },
      meta: {
        traceId: expect.any(String),
        timestamp: expect.any(String),
      },
    });
  });

  it('triggers manual synchronization for a provider', async () => {
    getSettingsMock.mockReturnValueOnce({
      id: 'atlas-promotora',
      name: 'Atlas',
      enabled: true,
      deprecated: false,
      sunsetAt: null,
    });
    getStatusMock.mockReturnValueOnce({
      providerId: 'atlas-promotora',
      status: 'idle',
      meta: { traceId: 'seed', timestamp: '2024-03-01T10:00:00.000Z' },
      enabled: true,
      deprecated: false,
      sunsetAt: null,
    });
    runSyncMock.mockResolvedValueOnce([
      {
        providerId: 'atlas-promotora',
        status: 'succeeded',
        meta: { traceId: 'manual-trace', timestamp: '2024-03-01T10:10:00.000Z' },
        stats: { agreements: 3, rates: 2, tables: 1 },
        enabled: true,
        deprecated: false,
        sunsetAt: null,
      },
    ]);

    const app = await buildApp();

    const response = await request(app).post('/api/v1/agreements/providers/atlas-promotora/sync');

    expect(response.status).toBe(202);
    expect(runSyncMock).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'atlas-promotora', force: true }),
      undefined
    );
    expect(response.body).toMatchObject({
      success: true,
      data: expect.objectContaining({ providerId: 'atlas-promotora', status: 'succeeded' }),
    });
  });

  it('returns error when provider is unknown on status endpoint', async () => {
    getSettingsMock.mockReturnValueOnce(undefined);

    const app = await buildApp();

    const response = await request(app).get('/api/v1/agreements/providers/unknown/status');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'PROVIDER_NOT_FOUND',
      },
      meta: {
        traceId: expect.any(String),
        timestamp: expect.any(String),
      },
    });
  });
});

