import express, { type Request, type RequestHandler, type Router } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserRole } from '../../middleware/auth';
import { renderMetrics, resetMetrics } from '../../lib/metrics';

type PrismaMock = {
  user: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  onboardingInvite: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

const prismaMock: PrismaMock = {
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

const hashMock = vi.fn().mockResolvedValue('hashed-password');

vi.mock('bcryptjs', () => ({
  default: { hash: hashMock },
  hash: hashMock,
}));

vi.mock('../../lib/prisma', () => ({
  prisma: prismaMock,
}));

const buildUserRecord = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'user-0000001',
  tenantId: 'tenant-1',
  email: 'agent@example.com',
  name: 'Agent',
  role: 'AGENT',
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-02T00:00:00Z'),
  lastLoginAt: null,
  ...overrides,
});

const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('users router', () => {
  let usersRouter: Router;
  let errorHandler: RequestHandler;

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
        tenant: { id: 'tenant-1', name: 'Tenant One', slug: 'tenant-one', settings: {} },
      } as Request['user'];
      next();
    });
    app.use('/api/users', usersRouter);
    app.use(errorHandler);
    return app;
  };

  beforeAll(async () => {
    ({ usersRouter } = await import('../users'));
    ({ errorHandler } = await import('../../middleware/error-handler'));
  });

  beforeEach(() => {
    resetMetrics();
    vi.clearAllMocks();
    infoSpy.mockClear();
    errorSpy.mockClear();
  });

  it('lists users for the tenant', async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([buildUserRecord({ role: 'SUPERVISOR' })]);

    const response = await request(buildApp()).get('/api/users');

    expect(response.status).toBe(200);
    expect(response.body.data.users).toHaveLength(1);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', isActive: true },
      orderBy: { name: 'asc' },
    });
  });

  it('enforces RBAC through requireRoles', async () => {
    const response = await request(buildApp('AGENT')).get('/api/users');

    expect(response.status).toBe(403);
  });

  it('creates users, logs the audit event and exposes metrics', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce(buildUserRecord({ id: 'user-created', role: 'SUPERVISOR' }));

    const response = await request(buildApp())
      .post('/api/users')
      .send({ name: 'Nova Pessoa', email: 'nova@example.com', password: 'strongpass', role: 'SUPERVISOR' });

    expect(response.status).toBe(201);
    const auditEntry = infoSpy.mock.calls.find(([message]) => message === '[Users] Usuário criado');
    expect(auditEntry?.[1]).toMatchObject({
      operation: 'create_user',
      targetUserId: 'user-created',
      metrics: expect.arrayContaining(['user_mutations_total']),
    });

    const metrics = await renderMetrics();
    expect(metrics).toContain('user_mutations_total');
    expect(metrics).toContain('operation="create_user"');
  });

  it('creates onboarding invites with dedicated counters', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    prismaMock.onboardingInvite.findUnique.mockResolvedValue(null);
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

    const response = await request(buildApp())
      .post('/api/users/invites')
      .send({ email: 'guest@example.com', role: 'AGENT', expiresInDays: 5 });

    expect(response.status).toBe(201);
    const auditEntry = infoSpy.mock.calls.find(([message]) => message === '[Users] Convite criado');
    expect(auditEntry?.[1]).toMatchObject({
      operation: 'invite_user',
      metrics: expect.arrayContaining(['user_invite_created_total']),
    });

    const metrics = await renderMetrics();
    expect(metrics).toContain('user_invite_created_total');
  });

  it('updates user role and increases the RBAC-specific counter', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(buildUserRecord({ id: 'user-0000002', role: 'AGENT' }));
    prismaMock.user.update.mockResolvedValueOnce(
      buildUserRecord({ id: 'user-0000002', role: 'SUPERVISOR', updatedAt: new Date('2024-01-03T00:00:00Z') })
    );

    const response = await request(buildApp()).patch('/api/users/user-0000002').send({ role: 'SUPERVISOR' });

    expect(response.status).toBe(200);
    const metrics = await renderMetrics();
    expect(metrics).toContain('user_role_updated_total');

    const auditEntry = infoSpy.mock.calls.find(([message]) => message === '[Users] Usuário atualizado');
    expect(auditEntry?.[1]).toMatchObject({
      roleChanged: true,
      metrics: expect.arrayContaining(['user_role_updated_total']),
    });
  });

  it('deactivates users and publishes audit metadata', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(buildUserRecord({ id: 'user-0000003' }));
    prismaMock.user.update.mockResolvedValueOnce(buildUserRecord({ id: 'user-0000003', isActive: false }));

    const response = await request(buildApp()).delete('/api/users/user-0000003');

    expect(response.status).toBe(200);
    const metrics = await renderMetrics();
    expect(metrics).toContain('user_status_toggled_total');

    const auditEntry = infoSpy.mock.calls.find(([message]) => message === '[Users] Usuário desativado');
    expect(auditEntry?.[1]).toMatchObject({
      operation: 'deactivate_user',
      metrics: expect.arrayContaining(['user_status_toggled_total']),
    });
  });
});
