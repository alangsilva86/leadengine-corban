import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { OnboardingInvite, Prisma } from '@prisma/client';
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { ConflictError, NotFoundError } from '@ticketz/core';
import { createLogger } from '@ticketz/shared';

import { prisma } from '../lib/prisma';
import { asyncHandler } from '../middleware/error-handler';
import { validateRequest } from '../middleware/validation';
import { requireRoles } from '../middleware/policies';
import type { UserRole } from '../middleware/auth';
import { recordUserMutation } from '../metrics/user-metrics';
import { getInviteStatus } from '../services/onboarding-invites-service';

const router = Router();
const auditLogger = createLogger();

const INVITE_TOKEN_BYTES = 16;
const DEFAULT_INVITE_EXPIRATION_DAYS = 7;

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const formatUserResponse = (user: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
  lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
});

const formatInviteResponse = (invite: OnboardingInvite) => ({
  id: invite.id,
  token: invite.token,
  email: invite.email,
  expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
  createdAt: invite.createdAt.toISOString(),
  updatedAt: invite.updatedAt.toISOString(),
  status: getInviteStatus(invite),
});

const computeInviteExpiration = (days?: number | null): Date => {
  const effectiveDays = typeof days === 'number' && days > 0 ? Math.min(days, 30) : DEFAULT_INVITE_EXPIRATION_DAYS;
  return new Date(Date.now() + effectiveDays * 24 * 60 * 60 * 1000);
};

const generateInviteToken = async (): Promise<string> => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = randomBytes(INVITE_TOKEN_BYTES).toString('hex');
    const existing = await prisma.onboardingInvite.findUnique({ where: { token } });
    if (!existing) {
      return token;
    }
  }

  throw new Error('Não foi possível gerar um token único para o convite.');
};

const buildInviteMetadata = (context: {
  tenantId: string;
  role: UserRole;
  requestedBy: { id: string; email: string };
}): Prisma.JsonObject => ({
  type: 'tenant-user-invite',
  tenantId: context.tenantId,
  role: context.role,
  createdBy: context.requestedBy.id,
  createdByEmail: context.requestedBy.email,
});

router.use(requireRoles('ADMIN', 'SUPERVISOR'));

router.get(
  '/',
  query('status').optional().isIn(['all', 'active', 'inactive']),
  validateRequest,
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const status = (req.query.status as string | undefined) ?? 'active';

    const where: Prisma.UserWhereInput = { tenantId };
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: { users: users.map(formatUserResponse) },
    });
  })
);

router.post(
  '/',
  body('name').isString().trim().isLength({ min: 3 }),
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['ADMIN', 'SUPERVISOR', 'AGENT']),
  body('password').isString().isLength({ min: 8 }),
  validateRequest,
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const normalizedEmail = normalizeEmail(req.body.email);

    const existingUser = await prisma.user.findFirst({
      where: { tenantId, email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictError('Usuário com este e-mail já existe.');
    }

    const passwordHash = await bcrypt.hash(req.body.password, 10);

    const user = await prisma.user.create({
      data: {
        tenantId,
        email: normalizedEmail,
        name: req.body.name.trim(),
        role: req.body.role,
        passwordHash,
        isActive: true,
        settings: {},
      },
    });

    recordUserMutation('create_user', {
      tenantId,
      actorRole: req.user!.role,
    });

    auditLogger.info('[Users] Usuário criado', {
      operation: 'create_user',
      tenantId,
      actorId: req.user!.id,
      targetUserId: user.id,
    });

    res.status(201).json({
      success: true,
      data: formatUserResponse(user),
    });
  })
);

router.post(
  '/invites',
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['ADMIN', 'SUPERVISOR', 'AGENT']),
  body('expiresInDays').optional().isInt({ min: 1, max: 30 }).toInt(),
  validateRequest,
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const normalizedEmail = normalizeEmail(req.body.email);
    const expiresAt = computeInviteExpiration(req.body.expiresInDays ? Number(req.body.expiresInDays) : undefined);

    const existingUser = await prisma.user.findFirst({
      where: { tenantId, email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictError('Usuário com este e-mail já existe.');
    }

    const actor = { id: req.user!.id, email: req.user!.email };
    const metadata = buildInviteMetadata({ tenantId, role: req.body.role, requestedBy: actor });

    const invite = await prisma.onboardingInvite.create({
      data: {
        token: await generateInviteToken(),
        email: normalizedEmail,
        channel: 'email',
        organization: req.user?.tenant?.name ?? null,
        tenantSlugHint: req.user?.tenant?.slug ?? null,
        expiresAt,
        metadata,
      },
    });

    recordUserMutation('invite_user', {
      tenantId,
      actorRole: req.user!.role,
    });

    auditLogger.info('[Users] Convite criado', {
      operation: 'invite_user',
      tenantId,
      actorId: req.user!.id,
      inviteId: invite.id,
    });

    res.status(201).json({
      success: true,
      data: formatInviteResponse(invite),
    });
  })
);

router.patch(
  '/:userId',
  param('userId').isString().trim().isLength({ min: 10 }),
  body('role').optional().isIn(['ADMIN', 'SUPERVISOR', 'AGENT']),
  body('isActive').optional().isBoolean(),
  body().custom((_value, { req }) => {
    if (req.body.role === undefined && req.body.isActive === undefined) {
      throw new Error('Informe role ou isActive para atualizar.');
    }
    return true;
  }),
  validateRequest,
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const { userId } = req.params;

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new NotFoundError('Usuário não encontrado.');
    }

    const data: Prisma.UserUpdateInput = {};
    if (req.body.role) {
      data.role = req.body.role;
    }
    if (typeof req.body.isActive === 'boolean') {
      data.isActive = req.body.isActive;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
    });

    recordUserMutation('update_user', {
      tenantId,
      actorRole: req.user!.role,
    });

    auditLogger.info('[Users] Usuário atualizado', {
      operation: 'update_user',
      tenantId,
      actorId: req.user!.id,
      targetUserId: updated.id,
    });

    res.json({
      success: true,
      data: formatUserResponse(updated),
    });
  })
);

router.delete(
  '/:userId',
  param('userId').isString().trim().isLength({ min: 10 }),
  validateRequest,
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const { userId } = req.params;

    if (req.user!.id === userId) {
      throw new ConflictError('Você não pode desativar sua própria conta.');
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new NotFoundError('Usuário não encontrado.');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    recordUserMutation('deactivate_user', {
      tenantId,
      actorRole: req.user!.role,
    });

    auditLogger.info('[Users] Usuário desativado', {
      operation: 'deactivate_user',
      tenantId,
      actorId: req.user!.id,
      targetUserId: updated.id,
    });

    res.json({
      success: true,
      data: formatUserResponse(updated),
    });
  })
);

export const usersRouter = router;
