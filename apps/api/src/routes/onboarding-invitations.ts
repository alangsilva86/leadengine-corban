import { Router, type RequestHandler, type Response } from 'express';
import { body, param, query } from 'express-validator';

import { asyncHandler } from '../middleware/error-handler';
import { validateRequest } from '../middleware/validation';
import { type AuthenticatedUser } from '../middleware/auth';
import {
  formatAdminInviteResponse,
  onboardingInvitesService,
  OnboardingInviteInvalidStateError,
  OnboardingInviteNotFoundError,
  type OnboardingInviteStatus,
} from '../services/onboarding-invites-service';

const router = Router();

const ensureAdmin: RequestHandler = (req, res, next) => {
  const user = req.user as AuthenticatedUser | undefined;
  if (!user || user.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Apenas administradores podem gerenciar convites.' },
    });
    return;
  }
  next();
};

const handleServiceError = (error: unknown, res: Response): boolean => {
  if (error instanceof OnboardingInviteNotFoundError) {
    res.status(404).json({ success: false, error: { code: 'INVITE_NOT_FOUND', message: error.message } });
    return true;
  }

  if (error instanceof OnboardingInviteInvalidStateError) {
    res.status(409).json({ success: false, error: { code: 'INVITE_INVALID_STATE', message: error.message } });
    return true;
  }

  return false;
};

router.use(ensureAdmin);

router.get(
  '/',
  [
    query('search').optional().isString().trim().isLength({ min: 2 }).withMessage('Informe ao menos 2 caracteres.'),
    query('status').optional().isIn(['pending', 'accepted', 'expired', 'revoked']),
    query('limit').optional().isInt({ min: 1, max: 200 }),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const status = typeof req.query.status === 'string' ? (req.query.status as OnboardingInviteStatus) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const invites = await onboardingInvitesService.listInvites({ search, status, limit });

    res.json({
      success: true,
      data: {
        invites: invites.map((invite) =>
          formatAdminInviteResponse(invite, { portalLink: onboardingInvitesService.getPortalLink(invite.token) })
        ),
        total: invites.length,
      },
    });
  })
);

const createInviteValidation = [
  body('email').isEmail().withMessage('Informe o e-mail do operador.'),
  body('organization').optional().isString().trim().isLength({ min: 3, max: 120 }),
  body('tenantSlugHint').optional().isString().trim().matches(/^[a-z0-9-]+$/i),
  body('channel').optional().isIn(['email', 'sms']),
  body('expiresInDays').optional().isInt({ min: 1, max: 60 }),
  body('notes').optional().isString().trim().isLength({ max: 500 }),
];

router.post(
  '/',
  createInviteValidation,
  validateRequest,
  asyncHandler(async (req, res) => {
    const actor = req.user;

    try {
      const invite = await onboardingInvitesService.createInvite({
        email: req.body.email,
        organization: req.body.organization,
        tenantSlugHint: req.body.tenantSlugHint,
        channel: req.body.channel,
        expiresInDays: req.body.expiresInDays,
        notes: req.body.notes,
        requestedBy: actor,
      });

      res.status(201).json({
        success: true,
        data: formatAdminInviteResponse(invite, { portalLink: onboardingInvitesService.getPortalLink(invite.token) }),
      });
    } catch (error) {
      if (handleServiceError(error, res)) {
        return;
      }
      throw error;
    }
  })
);

const inviteIdValidation = [param('inviteId').isString().trim().isLength({ min: 5 })];

router.post(
  '/:inviteId/resend',
  inviteIdValidation,
  validateRequest,
  asyncHandler(async (req, res) => {
    try {
      const invite = await onboardingInvitesService.resendInvite(req.params.inviteId, { requestedBy: req.user });
      res.json({
        success: true,
        data: formatAdminInviteResponse(invite, { portalLink: onboardingInvitesService.getPortalLink(invite.token) }),
      });
    } catch (error) {
      if (handleServiceError(error, res)) {
        return;
      }
      throw error;
    }
  })
);

router.post(
  '/:inviteId/revoke',
  [
    ...inviteIdValidation,
    body('reason').optional().isString().trim().isLength({ max: 300 }),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    try {
      const invite = await onboardingInvitesService.revokeInvite(req.params.inviteId, {
        requestedBy: req.user,
        reason: req.body.reason,
      });
      res.json({
        success: true,
        data: formatAdminInviteResponse(invite, { portalLink: onboardingInvitesService.getPortalLink(invite.token) }),
      });
    } catch (error) {
      if (handleServiceError(error, res)) {
        return;
      }
      throw error;
    }
  })
);

export const onboardingInvitationsRouter = router;
