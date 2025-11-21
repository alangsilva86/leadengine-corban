import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../../../middleware/error-handler';
import { createTenantAdminRouter } from '../tenants.routes';
import type { TenantAdminServicePort } from '../tenant.service';

const service: TenantAdminServicePort = {
  createTenant: vi.fn(),
  listTenants: vi.fn(),
  getTenantById: vi.fn(),
  updateTenant: vi.fn(),
  toggleTenantActive: vi.fn(),
};

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/tenant-admin', createTenantAdminRouter(service));
  app.use(errorHandler);
  return app;
};

const expectValidationError = (response: request.Response) => {
  expect(response.status).toBe(400);
  expect(response.body).toMatchObject({
    success: false,
    error: { code: 'VALIDATION_ERROR' },
  });
};

describe('tenant admin routes validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('does not call createTenant when request body is invalid', async () => {
    const app = buildApp();

    const response = await request(app).post('/tenant-admin').send({});

    expectValidationError(response);
    expect(service.createTenant).not.toHaveBeenCalled();
  });

  it('does not call listTenants when query params are invalid', async () => {
    const app = buildApp();

    const response = await request(app).get('/tenant-admin?page=abc');

    expectValidationError(response);
    expect(service.listTenants).not.toHaveBeenCalled();
  });

  it('does not call getTenantById when params are invalid', async () => {
    const app = buildApp();

    const response = await request(app).get('/tenant-admin/%20%20%20');

    expectValidationError(response);
    expect(service.getTenantById).not.toHaveBeenCalled();
  });

  it('does not call updateTenant when body is invalid', async () => {
    const app = buildApp();

    const response = await request(app)
      .patch('/tenant-admin/tenant-1')
      .send({ slug: 'INVALID SLUG' });

    expectValidationError(response);
    expect(service.updateTenant).not.toHaveBeenCalled();
  });

  it('does not call toggleTenantActive when body is invalid', async () => {
    const app = buildApp();

    const response = await request(app)
      .patch('/tenant-admin/tenant-1/toggle-active')
      .send({ isActive: 'yes' });

    expectValidationError(response);
    expect(service.toggleTenantActive).not.toHaveBeenCalled();
  });
});
