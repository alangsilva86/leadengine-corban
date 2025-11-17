import { Router } from 'express';
import { body } from 'express-validator';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { asyncHandler } from '../middleware/error-handler';
import { validateRequest } from '../middleware/validation';
import { getPermissionsByRole, type UserRole } from '../middleware/auth';
import { buildSessionPayload } from './auth';
import { getOnboardingConfig } from '../config/onboarding';
import { toSlug } from '../lib/slug';
import { logger } from '../config/logger';
import { formatPublicInviteResponse, normalizeInviteEmail } from '../services/onboarding-invites-service';

const router = Router();

const onboardingConfig = getOnboardingConfig();

const normalizeToken = (value: string): string => value.trim();

const inviteValidation = [
  body('token').isString().trim().isLength({ min: 8 }).withMessage('Token inválido.'),
];

const setupValidation = [
  body('token').isString().trim().isLength({ min: 8 }).withMessage('Token inválido.'),
  body('tenant.name').isString().trim().isLength({ min: 3 }).withMessage('Nome do time é obrigatório.'),
  body('tenant.slug')
    .optional()
    .isString()
    .trim()
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug deve conter apenas letras minúsculas, números e hífens.'),
  body('operator.name').isString().trim().isLength({ min: 3 }).withMessage('Informe o nome do operador.'),
  body('operator.email').isEmail().withMessage('E-mail do operador inválido.'),
  body('operator.password').isString().isLength({ min: 8 }).withMessage('Senha deve ter ao menos 8 caracteres.'),
];

router.post(
  '/invites/validate',
  inviteValidation,
  validateRequest,
  asyncHandler(async (req, res) => {
    const token = normalizeToken(req.body.token);

    const invite = await prisma.onboardingInvite.findUnique({
      where: { token },
    });

    if (!invite) {
      res.status(404).json({
        success: false,
        error: { code: 'INVITE_NOT_FOUND', message: 'Convite inexistente ou expirado.' },
      });
      return;
    }

    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      res.status(410).json({
        success: false,
        error: { code: 'INVITE_EXPIRED', message: 'O convite expirou. Solicite um novo link ao time de suporte.' },
      });
      return;
    }

    res.json({ success: true, data: formatPublicInviteResponse(invite) });
  })
);

router.post(
  '/setup',
  setupValidation,
  validateRequest,
  asyncHandler(async (req, res) => {
    const token = normalizeToken(req.body.token);
    const tenantName = req.body.tenant.name.trim();
    const requestedSlug = req.body.tenant.slug ? req.body.tenant.slug.trim() : null;
    const operatorName = req.body.operator.name.trim();
    const operatorEmail = normalizeInviteEmail(req.body.operator.email);
    const operatorPassword: string = req.body.operator.password;

    const invite = await prisma.onboardingInvite.findUnique({ where: { token } });

    if (!invite) {
      res.status(404).json({
        success: false,
        error: { code: 'INVITE_NOT_FOUND', message: 'Convite inexistente ou expirado.' },
      });
      return;
    }

    if (invite.acceptedAt) {
      res.status(409).json({
        success: false,
        error: { code: 'INVITE_ALREADY_USED', message: 'Este convite já foi utilizado.' },
      });
      return;
    }

    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      res.status(410).json({
        success: false,
        error: { code: 'INVITE_EXPIRED', message: 'O convite expirou. Solicite um novo link ao time de suporte.' },
      });
      return;
    }

    if (normalizeInviteEmail(invite.email) !== operatorEmail) {
      res.status(409).json({
        success: false,
        error: { code: 'INVITE_EMAIL_MISMATCH', message: 'O e-mail informado não corresponde ao convite recebido.' },
      });
      return;
    }

    const slugFallback = requestedSlug ?? toSlug(tenantName, tenantName);
    const tenantSlug = toSlug(slugFallback, slugFallback);

    const existingTenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (existingTenant) {
      res.status(409).json({
        success: false,
        error: { code: 'TENANT_EXISTS', message: 'Já existe um workspace com este identificador.' },
      });
      return;
    }

    const passwordHash = await bcrypt.hash(operatorPassword, 10);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            id: tenantSlug,
            name: tenantName,
            slug: tenantSlug,
            settings: { source: 'onboarding', inviteId: invite.id },
          },
        });

        const agreementSlugBase = `${tenant.slug}-base`;
        const agreement = await tx.agreement.create({
          data: {
            tenantId: tenant.id,
            name: `${tenant.name} • Base`,
            slug: toSlug(agreementSlugBase, agreementSlugBase),
            status: 'active',
            metadata: { source: 'onboarding' },
          },
        });

        const queue = await tx.queue.create({
          data: {
            tenantId: tenant.id,
            name: 'Atendimento Principal',
            description: 'Fila criada automaticamente pelo onboarding.',
            settings: { source: 'onboarding' },
          },
        });

        const campaign = await tx.campaign.create({
          data: {
            tenantId: tenant.id,
            name: 'Campanha inicial',
            agreementId: agreement.id,
            agreementName: agreement.name,
            status: 'draft',
            metadata: { source: 'onboarding' },
          },
        });

        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            email: operatorEmail,
            name: operatorName,
            role: 'ADMIN',
            isActive: true,
            passwordHash,
            settings: { source: 'onboarding' },
          },
        });

        await tx.userQueue.create({
          data: {
            userId: user.id,
            queueId: queue.id,
          },
        });

        const previousMetadata =
          invite.metadata && typeof invite.metadata === 'object' && !Array.isArray(invite.metadata)
            ? (invite.metadata as Record<string, unknown>)
            : {};

        await tx.onboardingInvite.update({
          where: { id: invite.id },
          data: {
            acceptedAt: new Date(),
            acceptedTenantId: tenant.id,
            acceptedUserId: user.id,
            metadata: { ...previousMetadata, lastSetupAt: new Date().toISOString() },
          },
        });

        return { tenant, queue, campaign, agreement, user };
      });

      const permissions = getPermissionsByRole(result.user.role as UserRole);
      const session = buildSessionPayload(result.user, result.tenant, permissions);

      logger.info('[Onboarding] Workspace provisionado com sucesso', {
        tenantId: result.tenant.id,
        inviteId: invite.id,
      });

      res.status(201).json({
        success: true,
        data: {
          tenant: { id: result.tenant.id, name: result.tenant.name, slug: result.tenant.slug },
          operator: { id: result.user.id, email: result.user.email, name: result.user.name },
          queue: { id: result.queue.id, name: result.queue.name },
          campaign: { id: result.campaign.id, name: result.campaign.name },
          agreement: { id: result.agreement.id, name: result.agreement.name },
          session,
          portal: onboardingConfig.portalBaseUrl,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        res.status(409).json({
          success: false,
          error: { code: 'TENANT_CONFLICT', message: 'Já existe um workspace com estes dados.' },
        });
        return;
      }

      logger.error('[Onboarding] Falha ao provisionar workspace', { error });
      res.status(500).json({
        success: false,
        error: { code: 'ONBOARDING_SETUP_FAILED', message: 'Não foi possível finalizar o onboarding agora.' },
      });
    }
  })
);

export const onboardingRouter = router;
