import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const originalEnv = { ...process.env };

type TestResponse = {
  statusCode?: number;
  payload?: unknown;
  status: (code: number) => TestResponse;
  json: (data: unknown) => TestResponse;
};

const createResponse = (): TestResponse => {
  const res: TestResponse = {
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.payload = data;
      return this;
    },
  };

  return res;
};

describe('authMiddleware fallback behaviour', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv } as NodeJS.ProcessEnv;
    process.env.AUTH_DISABLE_FOR_MVP = 'false';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv } as NodeJS.ProcessEnv;
  });

  it('falls back to JWT payload when user lookup rejects and fallback is enabled', async () => {
    process.env.JWT_SECRET = 'primary-secret';
    process.env.DEMO_JWT_SECRET = 'demo-secret';
    process.env.AUTH_ALLOW_JWT_FALLBACK = 'true';

    const authModule = await import('./auth');
    const { prisma } = await import('../lib/prisma');
    const findUniqueSpy = vi
      .spyOn(prisma.user, 'findUnique')
      .mockImplementation(async () => {
        throw new Error('db down');
      });

    const token = jwt.sign(
      {
        id: 'user-1',
        tenantId: 'tenant-42',
        email: 'user@example.com',
        name: 'Fallback User',
        role: 'SUPERVISOR',
      },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    const req = {
      headers: { authorization: `Bearer ${token}` },
    } as unknown as import('express').Request;

    const res = createResponse() as unknown as import('express').Response;
    const next = vi.fn();

    await authModule.authMiddleware(req, res, next);

    expect(findUniqueSpy).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    expect((req as unknown as { user?: unknown }).user).toMatchObject({
      id: 'user-1',
      tenantId: 'tenant-42',
      email: 'user@example.com',
      role: 'SUPERVISOR',
      isActive: true,
    });
    expect((res as unknown as TestResponse).statusCode).toBeUndefined();
  });

  it('allows demo tokens to fallback even when fallback is disabled', async () => {
    process.env.JWT_SECRET = 'primary-secret';
    process.env.DEMO_JWT_SECRET = 'demo-secret';
    process.env.AUTH_ALLOW_JWT_FALLBACK = 'false';

    const authModule = await import('./auth');
    const { prisma } = await import('../lib/prisma');
    const findUniqueSpy = vi
      .spyOn(prisma.user, 'findUnique')
      .mockImplementation(async () => {
        throw new Error('db down');
      });

    const token = jwt.sign(
      {
        id: 'demo-user',
        tenantId: 'demo-tenant',
        email: 'demo@example.com',
        name: 'Demo User',
        role: 'AGENT',
      },
      process.env.DEMO_JWT_SECRET!,
      { expiresIn: '1h' }
    );

    const req = {
      headers: { authorization: `Bearer ${token}` },
    } as unknown as import('express').Request;

    const res = createResponse() as unknown as import('express').Response;
    const next = vi.fn();

    await authModule.authMiddleware(req, res, next);

    expect(findUniqueSpy).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    expect((req as unknown as { user?: unknown }).user).toMatchObject({
      id: 'demo-user',
      tenantId: 'demo-tenant',
      email: 'demo@example.com',
      role: 'AGENT',
      isActive: true,
    });
    expect((res as unknown as TestResponse).statusCode).toBeUndefined();
  });

  it('returns a service unavailable error when lookup fails and fallback is disabled', async () => {
    process.env.JWT_SECRET = 'primary-secret';
    process.env.DEMO_JWT_SECRET = 'demo-secret';
    process.env.AUTH_ALLOW_JWT_FALLBACK = 'false';

    const authModule = await import('./auth');
    const { prisma } = await import('../lib/prisma');
    vi.spyOn(prisma.user, 'findUnique').mockImplementation(async () => {
      throw new Error('db down');
    });

    const token = jwt.sign(
      {
        id: 'user-2',
        tenantId: 'tenant-2',
        email: 'user2@example.com',
      },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    const req = {
      headers: { authorization: `Bearer ${token}` },
    } as unknown as import('express').Request;

    const res = createResponse() as unknown as import('express').Response;
    const next = vi.fn();

    await authModule.authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect((res as unknown as TestResponse).statusCode).toBe(503);
    expect((res as unknown as TestResponse).payload).toMatchObject({
      success: false,
      error: {
        code: 'USER_LOOKUP_FAILED',
      },
    });
  });
});
