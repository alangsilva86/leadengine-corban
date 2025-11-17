import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const bcryptMock = vi.hoisted(() => ({ hash: vi.fn().mockResolvedValue('hashed-password') }));

vi.mock('bcryptjs', () => ({
  __esModule: true,
  default: bcryptMock,
}));

const prismaMock = vi.hoisted(() => ({
  onboardingInvite: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  tenant: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  agreement: {
    create: vi.fn(),
  },
  queue: {
    create: vi.fn(),
  },
  campaign: {
    create: vi.fn(),
  },
  user: {
    create: vi.fn(),
  },
  userQueue: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: prismaMock,
}));

const authMocks = vi.hoisted(() => ({
  getPermissionsByRole: vi.fn().mockReturnValue(['tickets:read']),
}));

vi.mock('../../middleware/auth', async () => {
  const actual = await vi.importActual<typeof import('../../middleware/auth')>(
    '../../middleware/auth'
  );
  return {
    ...actual,
    getPermissionsByRole: authMocks.getPermissionsByRole,
  };
});

import { onboardingRouter } from '../onboarding';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/onboarding', onboardingRouter);
  return app;
};

type InviteRecord = {
  id: string;
  token: string;
  email: string;
  channel: string;
  organization: string;
  tenantSlugHint: string;
  expiresAt: Date | null;
  acceptedAt: Date | null;
  metadata: Record<string, unknown>;
};

const buildInvite = (overrides: Partial<InviteRecord> = {}): InviteRecord => ({
  id: 'invite-1',
  token: 'token-abc',
  email: 'owner@example.com',
  channel: 'email',
  organization: 'Ticketz',
  tenantSlugHint: 'ticketz',
  expiresAt: null,
  acceptedAt: null,
  metadata: {},
  ...overrides,
});

describe('onboardingRouter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    bcryptMock.hash.mockResolvedValue('hashed-password');
    authMocks.getPermissionsByRole.mockReturnValue(['tickets:read']);
    prismaMock.onboardingInvite.findUnique.mockResolvedValue(buildInvite());
    prismaMock.tenant.findUnique.mockResolvedValue(null);
    prismaMock.tenant.create.mockResolvedValue({ id: 'tenant-slug', name: 'Tenant', slug: 'tenant-slug' });
    prismaMock.agreement.create.mockResolvedValue({ id: 'agreement-1', name: 'Tenant • Base' });
    prismaMock.queue.create.mockResolvedValue({ id: 'queue-1', name: 'Atendimento Principal' });
    prismaMock.campaign.create.mockResolvedValue({ id: 'campaign-1', name: 'Campanha inicial' });
    prismaMock.user.create.mockResolvedValue({
      id: 'user-1',
      name: 'Owner',
      email: 'owner@example.com',
      role: 'ADMIN',
      tenantId: 'tenant-slug',
    });
    prismaMock.userQueue.create.mockResolvedValue({ id: 'uq-1' } as never);
    prismaMock.onboardingInvite.update.mockResolvedValue({ id: 'invite-1' });
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback({
        tenant: prismaMock.tenant,
        agreement: prismaMock.agreement,
        queue: prismaMock.queue,
        campaign: prismaMock.campaign,
        user: prismaMock.user,
        userQueue: prismaMock.userQueue,
        onboardingInvite: prismaMock.onboardingInvite,
      })
    );
  });

  it('validates invite tokens', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/onboarding/invites/validate')
      .send({ token: 'token-abc' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(prismaMock.onboardingInvite.findUnique).toHaveBeenCalledWith({ where: { token: 'token-abc' } });
  });

  it('rejects expired invites', async () => {
    prismaMock.onboardingInvite.findUnique.mockResolvedValueOnce(buildInvite({ expiresAt: new Date('2020-01-01T00:00:00Z') }));
    const app = buildApp();

    const response = await request(app)
      .post('/api/onboarding/invites/validate')
      .send({ token: 'token-abc' })
      .expect(410);

    expect(response.body.error.code).toBe('INVITE_EXPIRED');
  });

  it('provisions tenant, queue, campaign and operator', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/onboarding/setup')
      .send({
        token: 'token-abc',
        tenant: { name: 'Ticketz', slug: 'ticketz' },
        operator: { name: 'Owner', email: 'owner@example.com', password: 'secret123' },
      })
      .expect(201);

    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.tenant.create).toHaveBeenCalled();
    expect(prismaMock.agreement.create).toHaveBeenCalled();
    expect(prismaMock.queue.create).toHaveBeenCalled();
    expect(prismaMock.campaign.create).toHaveBeenCalled();
    expect(prismaMock.user.create).toHaveBeenCalled();
    expect(prismaMock.userQueue.create).toHaveBeenCalled();
    expect(prismaMock.onboardingInvite.update).toHaveBeenCalledWith({
      where: { id: 'invite-1' },
      data: expect.objectContaining({ acceptedTenantId: 'tenant-slug' }),
    });
    expect(response.body.data.session).toBeDefined();
  });

  it('fails when invite email does not match payload', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/onboarding/setup')
      .send({
        token: 'token-abc',
        tenant: { name: 'Ticketz' },
        operator: { name: 'Owner', email: 'wrong@example.com', password: 'secret123' },
      })
      .expect(409);

    expect(response.body.error.code).toBe('INVITE_EMAIL_MISMATCH');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
