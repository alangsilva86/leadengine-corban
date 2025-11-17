import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  tenant: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
};

const loggerMock = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
};

vi.mock('../../lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../../config/logger', () => ({
  logger: loggerMock,
}));

describe('auth routes', () => {
  const ORIGINAL_SECRET = process.env.JWT_SECRET;

  beforeEach(() => {
    vi.resetModules();
    Object.values(prismaMock.tenant).forEach((mock) => mock.mockReset());
    Object.values(prismaMock.user).forEach((mock) => mock.mockReset());
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = ORIGINAL_SECRET;
    }
  });

  const buildApp = async () => {
    const { authRouter } = await import('../auth');
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
    return app;
  };

  it('logs in a user with valid credentials', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      slug: 'tenant-1',
      name: 'Tenant 1',
      isActive: true,
      settings: {},
    });

    const passwordHash = await bcrypt.hash('secret', 4);
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'agent@example.com',
      name: 'Agent Smith',
      role: 'ADMIN',
      isActive: true,
      passwordHash,
      settings: {},
    });

    const app = await buildApp();
    const response = await request(app).post('/api/auth/login').send({
      email: 'agent@example.com',
      password: 'secret',
      tenantSlug: 'tenant-1',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token.accessToken).toBeDefined();
    expect(response.body.data.user.email).toBe('agent@example.com');
  });

  it('registers a new tenant and admin user', async () => {
    prismaMock.tenant.findUnique.mockResolvedValueOnce(null);
    prismaMock.tenant.create.mockResolvedValue({
      id: 'new-tenant',
      name: 'New Tenant',
      slug: 'new-tenant',
      isActive: true,
      settings: {},
    });
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockImplementation(async ({ data }) => ({
      id: 'user-new',
      tenantId: data.tenantId,
      email: data.email,
      name: data.name,
      role: data.role,
      isActive: true,
      passwordHash: data.passwordHash,
      settings: {},
    }));

    const app = await buildApp();
    const response = await request(app).post('/api/auth/register').send({
      name: 'Owner',
      email: 'owner@example.com',
      password: 's3cret',
      tenantName: 'New Tenant',
    });

    expect(response.status).toBe(200);
    expect(prismaMock.tenant.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: expect.any(String),
          role: 'ADMIN',
        }),
      })
    );
    expect(response.body.data.user.role).toBe('ADMIN');
  });

  it('refreshes tokens using a refresh token', async () => {
    const refreshToken = jwt.sign(
      {
        sub: 'user-1',
        tenantId: 'tenant-1',
        permissions: ['tickets:read'],
        type: 'refresh',
      },
      'test-secret',
      { expiresIn: '1h' }
    );

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'agent@example.com',
      name: 'Agent Smith',
      role: 'AGENT',
      isActive: true,
      passwordHash: 'hash',
      settings: {},
      tenant: {
        id: 'tenant-1',
        name: 'Tenant 1',
        slug: 'tenant-1',
        isActive: true,
        settings: {},
      },
    });

    const app = await buildApp();
    const response = await request(app).post('/api/auth/token/refresh').send({ refreshToken });

    expect(response.status).toBe(200);
    expect(response.body.data.token.accessToken).toBeDefined();
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } })
    );
  });
});
