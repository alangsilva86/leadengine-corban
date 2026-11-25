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

// Piloto Corban (adae3c03): o access token carrega `sid` e o middleware valida a sessão ativa no banco.
const prismaMock = {
  authSession: {
    findFirst: vi.fn(),
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
    prismaMock.authSession.findFirst.mockReset();
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

  const signAccessToken = (claims: Record<string, unknown>) =>
    jwt.sign({ type: 'access', ...claims }, 'test-secret', { expiresIn: '15m' });

  const buildApp = (authMiddleware: express.RequestHandler) => {
    const app = express();
    app.get('/protected', authMiddleware, (req, res) => {
      res.status(200).json({ ok: true, user: req.user });
    });
    return app;
  };

  it('attaches a user when the token is valid and the session is active', async () => {
    const { authMiddleware } = await loadAuthModule();

    prismaMock.authSession.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      user: {
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
      },
    });

    const token = signAccessToken({ sub: 'user-1', tenantId: 'tenant-1', sid: 'session-1' });

    const response = await request(buildApp(authMiddleware))
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      id: 'user-1',
      tenantId: 'tenant-1',
      role: 'ADMIN',
      tenant: { id: 'tenant-1', slug: 'tenant-1' },
    });
    expect(response.body.user.permissions).toContain('users:write');
    expect(prismaMock.authSession.findFirst).toHaveBeenCalledTimes(1);
    expect(prismaMock.authSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'session-1',
          userId: 'user-1',
          user: { tenantId: 'tenant-1', isActive: true, tenant: { isActive: true } },
        }),
      })
    );
  });

  it('rejects tokens whose session was revoked or expired', async () => {
    const { authMiddleware } = await loadAuthModule();
    prismaMock.authSession.findFirst.mockResolvedValue(null);

    const token = signAccessToken({ sub: 'user-1', tenantId: 'tenant-1', sid: 'revoked-session' });

    const response = await request(buildApp(authMiddleware))
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, error: { code: 'UNAUTHORIZED' } });
  });

  it('rejects access tokens without a session id', async () => {
    const { authMiddleware } = await loadAuthModule();

    const token = signAccessToken({ sub: 'user-1', tenantId: 'tenant-1' });

    const response = await request(buildApp(authMiddleware))
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, error: { code: 'TOKEN_INVALID' } });
    expect(prismaMock.authSession.findFirst).not.toHaveBeenCalled();
  });

  it('rejects refresh tokens used as access tokens', async () => {
    const { authMiddleware } = await loadAuthModule();

    const token = jwt.sign(
      { type: 'refresh', sub: 'user-1', tenantId: 'tenant-1', sid: 'session-1' },
      'test-secret',
      { expiresIn: '15m' }
    );

    const response = await request(buildApp(authMiddleware))
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, error: { code: 'TOKEN_INVALID' } });
    expect(prismaMock.authSession.findFirst).not.toHaveBeenCalled();
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
    expect(prismaMock.authSession.findFirst).not.toHaveBeenCalled();
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
