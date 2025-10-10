import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loggerMock = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock('../../config/logger', () => ({
  logger: loggerMock,
}));

vi.mock('../../config/feature-flags', () => ({
  isMvpAuthBypassEnabled: () => false,
}));

const findUniqueMock = vi.fn();

vi.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: findUniqueMock,
      findFirst: vi.fn(),
    },
  },
}));

describe('auth middleware user activation checks', () => {
  beforeEach(() => {
    vi.resetModules();
    findUniqueMock.mockReset();
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    loggerMock.debug.mockReset();
    process.env.JWT_SECRET = 'test-secret';
    process.env.AUTH_ALLOW_JWT_FALLBACK = 'false';
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.AUTH_ALLOW_JWT_FALLBACK;
  });

  const loadAuthModule = () => import('../auth');

  it('returns null when the user is inactive', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'user-123',
      tenantId: 'tenant-1',
      email: 'user@example.com',
      name: 'Test User',
      role: 'ADMIN',
      isActive: false,
      tenant: { isActive: true },
    });

    const { getUserById } = await loadAuthModule();

    const result = await getUserById('user-123');

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      include: {
        tenant: {
          select: {
            isActive: true,
          },
        },
      },
    });
    expect(result).toBeNull();
  });

  it('denies access through the middleware when the user is inactive', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'user-123',
      tenantId: 'tenant-1',
      email: 'user@example.com',
      name: 'Test User',
      role: 'ADMIN',
      isActive: false,
      tenant: { isActive: true },
    });

    const { authMiddleware } = await loadAuthModule();

    const app = express();
    app.get(
      '/protected',
      authMiddleware,
      (_req, res) => res.status(200).json({ ok: true })
    );

    const token = jwt.sign({ id: 'user-123', tenantId: 'tenant-1' }, 'test-secret');

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'USER_NOT_FOUND' },
    });
  });

  it('allows access when the user and tenant are active', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'user-123',
      tenantId: 'tenant-1',
      email: 'user@example.com',
      name: 'Active User',
      role: 'ADMIN',
      isActive: true,
      tenant: { isActive: true },
    });

    const { authMiddleware } = await loadAuthModule();

    const app = express();
    app.get(
      '/protected',
      authMiddleware,
      (req, res) => res.status(200).json({ ok: true, userId: req.user?.id })
    );

    const token = jwt.sign({ id: 'user-123', tenantId: 'tenant-1' }, 'test-secret');

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, userId: 'user-123' });
  });
});
