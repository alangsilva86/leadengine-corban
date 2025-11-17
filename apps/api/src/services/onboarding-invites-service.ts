import { randomBytes } from 'node:crypto';
import { Prisma, type OnboardingInvite } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { toSlug } from '../lib/slug';
import { logger } from '../config/logger';
import { getOnboardingConfig } from '../config/onboarding';

const INVITE_TOKEN_BYTES = 16;
const DEFAULT_EXPIRATION_DAYS = 14;
const MAX_HISTORY_ENTRIES = 20;

export type OnboardingInviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type OnboardingInviteChannel = 'email' | 'sms';

export type InviteMetadata = {
  notes?: string;
  createdBy?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  lastSentAt?: string;
  lastSentBy?: string | null;
  sendCount?: number;
  deliveryLog?: {
    channel: OnboardingInviteChannel;
    sentAt: string;
    by?: string | null;
    action?: string;
  }[];
  revokedAt?: string;
  revokedBy?: string | null;
  revokedReason?: string | null;
};

const parseMetadata = (value: Prisma.JsonValue | null): InviteMetadata => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as InviteMetadata;
};

const toJsonMetadata = (metadata: InviteMetadata): Prisma.JsonObject => {
  const json: Prisma.JsonObject = {};

  for (const [key, rawValue] of Object.entries(metadata)) {
    if (rawValue === undefined) {
      continue;
    }

    json[key] = rawValue as Prisma.JsonValue;
  }

  return json;
};

export const normalizeInviteEmail = (value: string): string => value.trim().toLowerCase();

const resolveChannel = (channel?: string | null): OnboardingInviteChannel =>
  channel?.toLowerCase() === 'sms' ? 'sms' : 'email';

const inferOrganizationFromEmail = (email: string): string | null => {
  const [userPart] = email.split('@');
  if (!userPart) {
    return null;
  }

  const normalized = userPart.replace(/[._-]+/g, ' ').trim();
  return normalized.length >= 3 ? normalized : null;
};

const buildTenantHint = (organization?: string | null, explicit?: string | null): string | null => {
  const trimmed = explicit?.trim();
  if (trimmed) {
    const normalized = toSlug(trimmed, trimmed);
    return normalized || null;
  }

  if (organization) {
    const normalized = toSlug(organization, organization);
    return normalized || null;
  }

  return null;
};

const computeExpiresAt = (days?: number | null): Date => {
  const effectiveDays = typeof days === 'number' && days > 0 ? days : DEFAULT_EXPIRATION_DAYS;
  const expiresAt = new Date(Date.now() + effectiveDays * 24 * 60 * 60 * 1000);
  return expiresAt;
};

export const isInviteRevoked = (invite: OnboardingInvite): boolean => Boolean(parseMetadata(invite.metadata).revokedAt);

export const getInviteStatus = (invite: OnboardingInvite): OnboardingInviteStatus => {
  if (isInviteRevoked(invite)) {
    return 'revoked';
  }

  if (invite.acceptedAt) {
    return 'accepted';
  }

  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    return 'expired';
  }

  return 'pending';
};

export const formatPublicInviteResponse = (invite: OnboardingInvite) => ({
  token: invite.token,
  email: invite.email,
  channel: invite.channel,
  organization: invite.organization,
  tenantSlugHint: invite.tenantSlugHint,
  expiresAt: invite.expiresAt?.toISOString() ?? null,
  acceptedAt: invite.acceptedAt?.toISOString() ?? null,
});

export const formatAdminInviteResponse = (
  invite: OnboardingInvite,
  options: { portalLink?: string } = {}
) => ({
  id: invite.id,
  token: invite.token,
  email: invite.email,
  channel: invite.channel,
  organization: invite.organization,
  tenantSlugHint: invite.tenantSlugHint,
  expiresAt: invite.expiresAt?.toISOString() ?? null,
  acceptedAt: invite.acceptedAt?.toISOString() ?? null,
  createdAt: invite.createdAt.toISOString(),
  updatedAt: invite.updatedAt.toISOString(),
  status: getInviteStatus(invite),
  portalLink: options.portalLink ?? null,
  metadata: parseMetadata(invite.metadata),
});

export class OnboardingInviteNotFoundError extends Error {
  override name = 'OnboardingInviteNotFoundError';
  constructor(message = 'Convite não encontrado.') {
    super(message);
  }
}

export class OnboardingInviteInvalidStateError extends Error {
  override name = 'OnboardingInviteInvalidStateError';
  constructor(message = 'Estado do convite não permite esta ação.') {
    super(message);
  }
}

type ActorContext = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
};

type CreateInviteOptions = {
  email: string;
  organization?: string | null;
  tenantSlugHint?: string | null;
  channel?: string | null;
  expiresInDays?: number | null;
  notes?: string | null;
  requestedBy?: ActorContext;
};

type ListInvitesOptions = {
  search?: string;
  status?: OnboardingInviteStatus;
  limit?: number;
};

type DeliveryContext = {
  actor?: ActorContext;
  action: 'created' | 'resent';
};

type RevokeOptions = {
  requestedBy?: ActorContext;
  reason?: string | null;
};

class OnboardingInvitesService {
  private readonly config = getOnboardingConfig();

  private buildPortalLink(token: string): string {
    try {
      const url = new URL(this.config.portalBaseUrl);
      url.searchParams.set('token', token);
      return url.toString();
    } catch {
      const base = this.config.portalBaseUrl.replace(/\/$/, '');
      const separator = base.includes('?') ? '&' : '?';
      return `${base}${separator}token=${encodeURIComponent(token)}`;
    }
  }

  async listInvites(options: ListInvitesOptions = {}): Promise<OnboardingInvite[]> {
    const { search, status, limit } = options;
    const where: Prisma.OnboardingInviteWhereInput | undefined = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { organization: { contains: search, mode: 'insensitive' } },
            { token: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined;

    const take = limit && limit > 0 ? Math.min(limit, 200) : 50;

    const invites = await prisma.onboardingInvite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    });

    if (!status) {
      return invites;
    }

    return invites.filter((invite) => getInviteStatus(invite) === status);
  }

  async createInvite(options: CreateInviteOptions): Promise<OnboardingInvite> {
    const email = normalizeInviteEmail(options.email);
    const organization = options.organization?.trim() || inferOrganizationFromEmail(email);
    const tenantSlugHint = buildTenantHint(organization, options.tenantSlugHint);
    const channel = resolveChannel(options.channel);
    const expiresAt = computeExpiresAt(options.expiresInDays);

    const metadata: InviteMetadata = {
      notes: options.notes?.trim() || undefined,
      createdBy: options.requestedBy?.id ?? null,
      createdByName: options.requestedBy?.name ?? null,
      createdByEmail: options.requestedBy?.email ?? null,
    };

    const invite = await prisma.onboardingInvite.create({
      data: {
        token: await this.generateUniqueToken(),
        email,
        channel,
        organization,
        tenantSlugHint,
        expiresAt,
        metadata: toJsonMetadata(metadata),
      },
    });

    return this.dispatchAndTrack(invite, { actor: options.requestedBy, action: 'created' });
  }

  async resendInvite(inviteId: string, options: { requestedBy?: ActorContext } = {}) {
    const invite = await this.findInvite(inviteId);

    const status = getInviteStatus(invite);
    if (status === 'accepted') {
      throw new OnboardingInviteInvalidStateError('Convite já aceito. Não é possível reenviar.');
    }

    if (status === 'revoked') {
      throw new OnboardingInviteInvalidStateError('Convite revogado. Gere um novo convite.');
    }

    return this.dispatchAndTrack(invite, { actor: options.requestedBy, action: 'resent' });
  }

  async revokeInvite(inviteId: string, options: RevokeOptions = {}) {
    const invite = await this.findInvite(inviteId);
    const status = getInviteStatus(invite);

    if (status === 'accepted') {
      throw new OnboardingInviteInvalidStateError('Convites aceitos não podem ser revogados.');
    }

    if (status === 'revoked') {
      return invite;
    }

    const metadata = parseMetadata(invite.metadata);
    const revokedAt = new Date().toISOString();
    const updatedMetadata: InviteMetadata = {
      ...metadata,
      revokedAt,
      revokedBy: options.requestedBy?.id ?? null,
      revokedReason: (options.reason?.trim() || metadata.revokedReason) ?? null,
    };

    const updated = await prisma.onboardingInvite.update({
      where: { id: invite.id },
      data: {
        expiresAt: new Date(Date.now() - 1000),
        metadata: toJsonMetadata(updatedMetadata),
      },
    });

    logger.info('[OnboardingInvites] Convite revogado', {
      inviteId,
      revokedBy: options.requestedBy?.id ?? null,
    });

    return updated;
  }

  getPortalLink(token: string): string {
    return this.buildPortalLink(token);
  }

  private async dispatchAndTrack(invite: OnboardingInvite, context: DeliveryContext) {
    const link = this.buildPortalLink(invite.token);
    await this.dispatchInvite(invite, link);
    const updated = await this.appendDeliveryMetadata(invite, context);
    return updated;
  }

  private async appendDeliveryMetadata(invite: OnboardingInvite, context: DeliveryContext) {
    const metadata = parseMetadata(invite.metadata);
    const sentAt = new Date().toISOString();
    const entry = {
      channel: resolveChannel(invite.channel),
      sentAt,
      by: context.actor?.id ?? null,
      action: context.action,
    } satisfies InviteMetadata['deliveryLog'][number];

    const history = Array.isArray(metadata.deliveryLog) ? [...metadata.deliveryLog, entry] : [entry];
    const trimmedHistory = history.slice(-MAX_HISTORY_ENTRIES);

    const updatedMetadata: InviteMetadata = {
      ...metadata,
      deliveryLog: trimmedHistory,
      lastSentAt: sentAt,
      lastSentBy: context.actor?.id ?? null,
      sendCount: (metadata.sendCount ?? 0) + 1,
    };

    const updated = await prisma.onboardingInvite.update({
      where: { id: invite.id },
      data: {
        metadata: toJsonMetadata(updatedMetadata),
      },
    });

    return updated;
  }

  private async dispatchInvite(invite: OnboardingInvite, link: string) {
    const organization = invite.organization ?? 'sua operação';

    if (resolveChannel(invite.channel) === 'sms') {
      logger.info('[OnboardingInvites] Enviando SMS de convite', {
        to: invite.email,
        sender: this.config.inviteSmsSender,
        link,
      });
      return;
    }

    logger.info('[OnboardingInvites] Enviando e-mail de convite', {
      to: invite.email,
      from: this.config.inviteEmailFrom,
      subject: `Acesso liberado para ${organization}`,
      link,
    });
  }

  private async generateUniqueToken(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const token = randomBytes(INVITE_TOKEN_BYTES).toString('hex');
      const existing = await prisma.onboardingInvite.findUnique({ where: { token } });
      if (!existing) {
        return token;
      }
    }

    throw new Error('Não foi possível gerar um token único para o convite.');
  }

  private async findInvite(inviteId: string): Promise<OnboardingInvite> {
    const invite = await prisma.onboardingInvite.findUnique({ where: { id: inviteId } });
    if (!invite) {
      throw new OnboardingInviteNotFoundError();
    }
    return invite;
  }
}

export const onboardingInvitesService = new OnboardingInvitesService();
