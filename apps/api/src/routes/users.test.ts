import express, { type Request } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usersRouter } from './users';
import { errorHandler } from '../middleware/error-handler';
import type { UserRole } from '../middleware/auth';
import { resetMetrics, renderMetrics } from '../lib/metrics';

const prismaMock = {
  user: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  onboardingInvite: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock('../lib/prisma', () => ({
  prisma: prismaMock,
}));

const buildApp = (role: UserRole = 'ADMIN') => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as Request).user = {
      id: 'user-admin',
      tenantId: 'tenant-1',
      email: 'admin@example.com',
      name: 'Admin',
      role,
      isActive: true,
      permissions: [],
      tenant: {
        id: 'tenant-1',
        name: 'Tenant One',
        slug: 'tenant-one',
        settings: {},
      },
    } as Request['user'];
    next();
  });
  app.use('/api/users', usersRouter);
  app.use(errorHandler);
  return app;
};

describe('users routes', () => {
  beforeEach(() => {
    resetMetrics();
    prismaMock.user.findMany.mockReset();
    prismaMock.user.findFirst.mockReset();
    prismaMock.user.create.mockReset();
    prismaMock.user.update.mockReset();
    prismaMock.onboardingInvite.findUnique.mockReset();
    prismaMock.onboardingInvite.create.mockReset();
  });

  it('lists users for the current tenant', async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([
      {
        id: 'user-1',
        email: 'agent@example.com',
        name: 'Agent',
        role: 'AGENT',
        isActive: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
        lastLoginAt: null,
      },
    ]);

    const app = buildApp();
    const response = await request(app).get('/api/users');

    expect(response.status).toBe(200);
    expect(response.body.data.users).toHaveLength(1);
    expect(response.body.data.users[0]).toMatchObject({ email: 'agent@example.com', role: 'AGENT' });
  });

  it('rejects access when role is not allowed', async () => {
    const app = buildApp('AGENT');
    const response = await request(app).get('/api/users');

    expect(response.status).toBe(403);
  });

  it('creates a new user and records metrics', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce({
      id: 'user-2',
      email: 'new@example.com',
      name: 'New User',
      role: 'SUPERVISOR',
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      lastLoginAt: null,
    });

    const app = buildApp();
    const response = await request(app)
      .post('/api/users')
      .send({ name: 'New User', email: 'new@example.com', password: 'strongpass', role: 'SUPERVISOR' });

    expect(response.status).toBe(201);
    expect(prismaMock.user.create).toHaveBeenCalled();

    const metrics = await renderMetrics();
    expect(metrics).toContain('user_mutations_total');
  });

  it('creates invites for prospective users', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    prismaMock.onboardingInvite.findUnique.mockResolvedValueOnce(null);
    prismaMock.onboardingInvite.create.mockResolvedValueOnce({
      id: 'invite-1',
      token: 'token-abc',
      email: 'guest@example.com',
      organization: 'Tenant One',
      channel: 'email',
      tenantSlugHint: 'tenant-one',
      expiresAt: new Date('2024-02-01T00:00:00Z'),
      acceptedAt: null,
      acceptedTenantId: null,
      acceptedUserId: null,
      metadata: {},
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    });

    const app = buildApp();
    const response = await request(app)
      .post('/api/users/invites')
      .send({ email: 'guest@example.com', role: 'AGENT', expiresInDays: 5 });

    expect(response.status).toBe(201);
    expect(prismaMock.onboardingInvite.create).toHaveBeenCalled();
  });

  it('updates user role', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce({ id: 'user-3', tenantId: 'tenant-1' });
    prismaMock.user.update.mockResolvedValueOnce({
      id: 'user-3',
      email: 'agent@example.com',
      name: 'Agent',
      role: 'SUPERVISOR',
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-02T00:00:00Z'),
      lastLoginAt: null,
    });

    const app = buildApp();
    const response = await request(app).patch('/api/users/user-3').send({ role: 'SUPERVISOR' });

    expect(response.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-3' },
      data: { role: 'SUPERVISOR' },
    });
  });

  it('prevents deactivating the own account', async () => {
    const app = buildApp();
    const response = await request(app).delete('/api/users/user-admin');

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });
});
