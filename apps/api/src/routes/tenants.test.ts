import express, { type Request } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { tenantsRouter } from './tenants';
import { errorHandler } from '../middleware/error-handler';

const findManyMock = vi.fn();
const updateMock = vi.fn();

vi.mock('../lib/prisma', () => ({
  prisma: {
    tenant: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

const buildApp = (permissions: string[] = ['tenants:read', 'tenants:write']) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as Request).user = {
      id: 'user-1',
      tenantId: 'tenant-123',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'ADMIN',
      isActive: true,
      permissions,
    } as Request['user'];
    next();
  });
  app.use('/api/tenants', tenantsRouter);
  app.use(errorHandler);
  return app;
};

describe('tenants routes', () => {
  beforeEach(() => {
    findManyMock.mockReset();
    updateMock.mockReset();
  });

  it('lists tenants available to the authenticated user', async () => {
    findManyMock.mockResolvedValueOnce([
      { id: 'tenant-123', name: 'Demo', slug: 'demo', isActive: true, settings: {}, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const app = buildApp();
    const response = await request(app).get('/api/tenants');

    expect(response.status).toBe(200);
    expect(findManyMock).toHaveBeenCalled();
    expect(response.body.success).toBe(true);
    expect(response.body.data[0]).toMatchObject({ id: 'tenant-123', name: 'Demo' });
  });

  it('updates tenant metadata when user has tenants:write permission', async () => {
    updateMock.mockResolvedValueOnce({
      id: 'tenant-123',
      name: 'Updated',
      slug: 'tenant-123',
      isActive: true,
      settings: { timezone: 'UTC' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const app = buildApp();
    const response = await request(app)
      .patch('/api/tenants/tenant-123')
      .send({ name: 'Updated', settings: { timezone: 'UTC' } });

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'tenant-123' },
      data: { name: 'Updated', settings: { timezone: 'UTC' } },
    });
    expect(response.body.data).toMatchObject({ name: 'Updated' });
  });

  it('rejects tenant updates when user lacks tenants:write permission', async () => {
    const app = buildApp(['tenants:read']);
    const response = await request(app).patch('/api/tenants/tenant-123').send({ name: 'Updated' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(updateMock).not.toHaveBeenCalled();
  });
});
