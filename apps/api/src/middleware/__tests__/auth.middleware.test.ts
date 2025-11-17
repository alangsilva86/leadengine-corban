import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loggerMock = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const prismaMock = {
  user: {
    findUnique: vi.fn(),
  },
};

vi.mock('../../config/logger', () => ({
  logger: loggerMock,
}));

vi.mock('../../lib/prisma', () => ({
  prisma: prismaMock,
}));

describe('auth middleware (JWT)', () => {
  const ORIGINAL_SECRET = process.env.JWT_SECRET;

  beforeEach(() => {
    vi.resetModules();
    prismaMock.user.findUnique.mockReset();
    loggerMock.error.mockReset();
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = ORIGINAL_SECRET;
    }
  });

  const loadAuthModule = async () => import('../auth');

  it('attaches a user when the token is valid', async () => {
    const { authMiddleware } = await loadAuthModule();

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'user@example.com',
      name: 'Test User',
      role: 'ADMIN',
      isActive: true,
      tenant: {
        id: 'tenant-1',
        name: 'Tenant 1',
        slug: 'tenant-1',
        isActive: true,
        settings: {},
      },
    });

    const token = jwt.sign(
      {
        sub: 'user-1',
        tenantId: 'tenant-1',
        type: 'access',
      },
      'test-secret',
      { expiresIn: '15m' }
    );

    const app = express();
    app.get('/protected', authMiddleware, (req, res) => {
      res.status(200).json({ ok: true, user: req.user });
    });

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      id: 'user-1',
      tenantId: 'tenant-1',
      role: 'ADMIN',
    });
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it('rejects requests without a token', async () => {
    const { authMiddleware } = await loadAuthModule();

    const app = express();
    app.get('/protected', authMiddleware, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get('/protected');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('requireTenant enforces authenticated tenants', async () => {
    const { requireTenant } = await loadAuthModule();

    const app = express();
    app.get(
      '/tenant-only',
      (req, _res, next) => {
        req.user = {
          id: 'user-2',
          tenantId: '',
          email: 'inactive@example.com',
          name: 'Inactive',
          role: 'AGENT',
          isActive: false,
          permissions: [],
        };
        next();
      },
      requireTenant,
      (_req, res) => {
        res.status(200).json({ tenantId: 'tenant-2' });
      }
    );

    const response = await request(app).get('/tenant-only');

    expect(response.status).toBe(403);
  });
});
