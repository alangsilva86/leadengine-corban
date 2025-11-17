import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMock = vi.hoisted(() => ({
  listInvites: vi.fn(),
  createInvite: vi.fn(),
  resendInvite: vi.fn(),
  revokeInvite: vi.fn(),
  getPortalLink: vi.fn(),
}));

class InviteNotFoundError extends Error {}
class InviteInvalidStateError extends Error {}

vi.mock('../../services/onboarding-invites-service', () => ({
  onboardingInvitesService: serviceMock,
  formatAdminInviteResponse: (invite: any, options?: { portalLink?: string }) => ({
    id: invite.id,
    portalLink: options?.portalLink ?? null,
  }),
  formatPublicInviteResponse: vi.fn(),
  normalizeInviteEmail: vi.fn(),
  OnboardingInviteNotFoundError: InviteNotFoundError,
  OnboardingInviteInvalidStateError: InviteInvalidStateError,
}));

import { onboardingInvitationsRouter } from '../onboarding-invitations';
import {
  OnboardingInviteInvalidStateError,
  OnboardingInviteNotFoundError,
} from '../../services/onboarding-invites-service';

const buildApp = (userOverrides: Record<string, unknown> = {}) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = {
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@example.com',
      role: 'ADMIN',
      tenantId: 'demo',
      permissions: [],
      isActive: true,
      ...userOverrides,
    } as any;
    next();
  });
  app.use('/api/onboarding/invitations', onboardingInvitationsRouter);
  return app;
};

describe('onboardingInvitationsRouter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    serviceMock.getPortalLink.mockImplementation((token: string) => `https://example.com/onboarding?token=${token}`);
  });

  it('lists invites with optional filters', async () => {
    serviceMock.listInvites.mockResolvedValueOnce([{ id: 'invite-1', token: 'abc' }]);

    const app = buildApp();
    const response = await request(app)
      .get('/api/onboarding/invitations?search=lead&status=pending&limit=10')
      .expect(200);

    expect(serviceMock.listInvites).toHaveBeenCalledWith({ search: 'lead', status: 'pending', limit: 10 });
    expect(response.body.data.invites).toEqual([{ id: 'invite-1', portalLink: 'https://example.com/onboarding?token=abc' }]);
  });

  it('creates invites with metadata from the current user', async () => {
    serviceMock.createInvite.mockResolvedValueOnce({ id: 'invite-2', token: 'def' });

    const app = buildApp();
    const response = await request(app)
      .post('/api/onboarding/invitations')
      .send({ email: 'owner@example.com', organization: 'Nova', channel: 'sms', expiresInDays: 21, notes: 'vip' })
      .expect(201);

    expect(serviceMock.createInvite).toHaveBeenCalledWith({
      email: 'owner@example.com',
      organization: 'Nova',
      tenantSlugHint: undefined,
      channel: 'sms',
      expiresInDays: 21,
      notes: 'vip',
      requestedBy: expect.objectContaining({ id: 'admin-1' }),
    });
    expect(response.body.data).toEqual({ id: 'invite-2', portalLink: 'https://example.com/onboarding?token=def' });
  });

  it('rejects non-admins', async () => {
    const app = buildApp({ role: 'AGENT' });

    const response = await request(app).get('/api/onboarding/invitations').expect(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('resends invites and handles invalid state errors', async () => {
    serviceMock.resendInvite.mockRejectedValueOnce(new OnboardingInviteInvalidStateError('Já aceito.'));

    const app = buildApp();
    const response = await request(app).post('/api/onboarding/invitations/invite-1/resend').expect(409);
    expect(response.body.error.code).toBe('INVITE_INVALID_STATE');
  });

  it('revokes invites and reports not found errors', async () => {
    serviceMock.revokeInvite.mockRejectedValueOnce(new OnboardingInviteNotFoundError('missing'));

    const app = buildApp();
    const response = await request(app)
      .post('/api/onboarding/invitations/invite-99/revoke')
      .send({ reason: 'duplicado' })
      .expect(404);
    expect(response.body.error.code).toBe('INVITE_NOT_FOUND');
  });
});
