import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser } from '../../middleware/auth';

const loadConfigMock = vi.hoisted(() => vi.fn());
const upsertConfigMock = vi.hoisted(() => vi.fn());
const toPublicMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/meta-offline-config', () => ({
  loadMetaOfflineConfig: (...args: unknown[]) => loadConfigMock(...args),
  upsertMetaOfflineConfig: (...args: unknown[]) => upsertConfigMock(...args),
  toPublicMetaOfflineConfig: (...args: unknown[]) => toPublicMock(...args),
}));

const buildApp = async () => {
  const app = express();
  app.use(express.json());

  const user: AuthenticatedUser = {
    id: 'user-1',
    tenantId: 'tenant-123',
    email: 'user@example.com',
    name: 'User Test',
    role: 'ADMIN',
    isActive: true,
    permissions: [],
  };

  app.use((req, _res, next) => {
    req.user = user;
    next();
  });

  const { metaOfflineRouter } = await import('../integrations/meta-offline-router');
  app.use(metaOfflineRouter);

  return app;
};

describe('Meta offline conversions router', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    loadConfigMock.mockReset();
    upsertConfigMock.mockReset();
    toPublicMock.mockReset();
  });

  it('returns current configuration without exposing secrets', async () => {
    loadConfigMock.mockResolvedValueOnce({ config: true });
    toPublicMock.mockReturnValueOnce({
      offlineEventSetId: 'set-1',
      pixelId: 'pixel-1',
      businessId: 'biz-1',
      appId: 'app-1',
      actionSource: 'PHONE_CALL',
      eventName: 'Lead',
      reprocessUnmatched: false,
      reprocessUnsent: true,
      reprocessWindowDays: 14,
      connected: true,
      lastValidatedAt: '2024-10-02T12:00:00.000Z',
      lastValidationError: null,
      accessTokenConfigured: true,
      appSecretConfigured: false,
    });

    const app = await buildApp();

    const response = await request(app).get('/config');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: expect.objectContaining({
        offlineEventSetId: 'set-1',
        accessTokenConfigured: true,
        appSecretConfigured: false,
      }),
    });
    expect(loadConfigMock).toHaveBeenCalledWith('tenant-123');
    expect(response.body.data).not.toHaveProperty('accessToken');
  });

  it('persists configuration updates and returns sanitized payload', async () => {
    upsertConfigMock.mockResolvedValueOnce({ persisted: true });
    toPublicMock.mockReturnValueOnce({
      offlineEventSetId: 'set-9',
      pixelId: null,
      businessId: null,
      appId: 'app-9',
      actionSource: 'OTHER',
      eventName: 'Lead',
      reprocessUnmatched: true,
      reprocessUnsent: false,
      reprocessWindowDays: 30,
      connected: false,
      lastValidatedAt: null,
      lastValidationError: null,
      accessTokenConfigured: true,
      appSecretConfigured: true,
    });

    const app = await buildApp();

    const response = await request(app)
      .put('/config')
      .send({
        offlineEventSetId: 'set-9',
        appId: 'app-9',
        accessToken: 'token-xyz',
        appSecret: 'secret-123',
        reprocessUnmatched: true,
        reprocessWindowDays: 30,
      });

    expect(response.status).toBe(200);
    expect(upsertConfigMock).toHaveBeenCalledWith('tenant-123', {
      offlineEventSetId: 'set-9',
      pixelId: undefined,
      businessId: undefined,
      appId: 'app-9',
      actionSource: undefined,
      eventName: undefined,
      reprocessUnmatched: true,
      reprocessUnsent: undefined,
      reprocessWindowDays: 30,
      accessToken: 'token-xyz',
      appSecret: 'secret-123',
    });
    expect(response.body.data).toMatchObject({ accessTokenConfigured: true });
  });

  it('rejects invalid payloads', async () => {
    const app = await buildApp();

    const response = await request(app)
      .put('/config')
      .send({ reprocessWindowDays: 'invalid-number' });

    expect(response.status).toBe(400);
    expect(upsertConfigMock).not.toHaveBeenCalled();
  });
});
