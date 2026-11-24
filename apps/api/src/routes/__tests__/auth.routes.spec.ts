import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prisma } = vi.hoisted(() => ({
  prisma: {
    tenant: { findUnique: vi.fn() },
    user: { findFirst: vi.fn() },
    authSession: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('../../lib/prisma', () => ({ prisma }));
vi.mock('../../config/auth', () => ({ getJwtSecret: () => 'test-session-signing-key' }));

import { authRouter } from '../auth';

const tenant = { id: 'tenant-1', slug: 'tenant-1', name: 'Tenant 1', isActive: true, settings: {} };
const user = { id: 'user-1', tenantId: tenant.id, email: 'agent@example.com', name: 'Agente', role: 'AGENT', isActive: true, settings: {}, tenant };
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

beforeEach(() => {
  vi.resetAllMocks();
  prisma.$transaction.mockImplementation(callback => callback(prisma));
});

describe('auth routes', () => {
  it('opens a server-owned session and caps the access lifetime', async () => {
    prisma.tenant.findUnique.mockResolvedValue(tenant);
    prisma.user.findFirst.mockResolvedValue({ ...user, passwordHash: await bcrypt.hash('secret', 4) });
    prisma.authSession.create.mockImplementation(({ data }) => Promise.resolve(data));
    const response = await request(app).post('/api/auth/login').send({
      email: user.email, password: 'secret', tenantSlug: tenant.slug, accessTtl: '365d',
    });
    expect(response.status).toBe(200);
    const { token, user: profile } = response.body.data;
    expect(token.expiresIn).toBeLessThanOrEqual(3600);
    expect(profile.role).toBe('AGENT');
    expect(jwt.decode(token.accessToken)).toMatchObject({ sub: user.id, type: 'access', sid: expect.any(String) });
    expect(prisma.authSession.create).toHaveBeenCalledTimes(1);
  });

  it('rejects public registration', async () => {
    const response = await request(app).post('/api/auth/register').send({ tenantSlug: tenant.slug, role: 'ADMIN' });
    expect(response.status).toBe(403);
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('rotates the nonce and derives permissions from the current role', async () => {
    const token = jwt.sign({ sub: user.id, tenantId: tenant.id, sid: 'session-1', jti: 'nonce-1', type: 'refresh',
      permissions: ['users:write'] }, 'test-session-signing-key', { expiresIn: '1h' });
    const session = { id: 'session-1', refreshNonce: 'nonce-1', expiresAt: new Date(Date.now() + 3_600_000), user };
    prisma.authSession.findFirst.mockResolvedValueOnce(session).mockResolvedValueOnce({ ...session, refreshNonce: 'rotated' });
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });
    const first = await request(app).post('/api/auth/token/refresh').send({ refreshToken: token });
    expect(first.status).toBe(200);
    expect(first.body.data.user.permissions).not.toContain('users:write');
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: session.id, refreshNonce: 'nonce-1' }),
    }));
    const second = await request(app).post('/api/auth/token/refresh').send({ refreshToken: token });
    expect(second.status).toBe(401);
  });
});
