import express from 'express';
import request from 'supertest';
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

describe('auth middleware demo mode', () => {
  beforeEach(() => {
    vi.resetModules();
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    loggerMock.debug.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const loadAuthModule = () => import('../auth');

  it('anexa o usuário demo em rotas protegidas', async () => {
    const { authMiddleware, resolveDemoUser } = await loadAuthModule();

    const app = express();
    app.get('/protected', authMiddleware, (req, res) => {
      res.status(200).json({
        ok: true,
        user: req.user,
      });
    });

    const response = await request(app).get('/protected');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true });
    expect(response.body.user).toMatchObject(resolveDemoUser());
  });

  it('mantém o fluxo mesmo sem permissões explícitas', async () => {
    const { authMiddleware, requirePermission, resolveDemoUser } = await loadAuthModule();

    const app = express();
    app.get(
      '/tickets',
      authMiddleware,
      requirePermission('tickets:write'),
      (req, res) => {
        res.status(200).json({ ok: true, userId: req.user?.id });
      }
    );

    const response = await request(app).get('/tickets');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.userId).toBe(resolveDemoUser().id);
  });

  it('garante tenant padrão via requireTenant', async () => {
    const { authMiddleware, requireTenant, resolveDemoUser } = await loadAuthModule();

    const app = express();
    app.get(
      '/lead-engine',
      authMiddleware,
      requireTenant,
      (req, res) => {
        res.status(200).json({ tenantId: req.user?.tenantId });
      }
    );

    const response = await request(app).get('/lead-engine');

    expect(response.status).toBe(200);
    expect(response.body.tenantId).toBe(resolveDemoUser().tenantId);
  });
});
