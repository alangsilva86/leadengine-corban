import { Router, type Request, type Response } from 'express';
import { body, param, query } from 'express-validator';
import { Prisma } from '@prisma/client';

import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { prisma } from '../lib/prisma';

const router = Router();

const normalizeStatus = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (['active', 'paused', 'archived'].includes(normalized)) {
    return normalized;
  }

  return null;
};

const respondNotFound = (res: Response): void => {
  res.status(404).json({
    success: false,
    error: {
      code: 'CAMPAIGN_NOT_FOUND',
      message: 'Campanha não encontrada.',
    },
  });
};

router.post(
  '/',
  body('agreementId').isString().trim().isLength({ min: 1 }),
  body('agreementName').isString().trim().isLength({ min: 1 }),
  body('instanceId').isString().trim().isLength({ min: 1 }),
  body('name').optional().isString().trim().isLength({ min: 1 }),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const { agreementId, agreementName, instanceId } = req.body as {
      agreementId: string;
      agreementName: string;
      instanceId: string;
      name?: string;
    };
    const providedName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

    const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });
    if (!instance || instance.tenantId !== tenantId) {
      res.status(404).json({
        success: false,
        error: {
          code: 'INSTANCE_NOT_FOUND',
          message: 'Instância WhatsApp não encontrada para o tenant.',
        },
      });
      return;
    }

    const normalizedName = providedName || `${agreementName.trim()} • ${instanceId}`;

    const existingActive = await prisma.campaign.findFirst({
      where: {
        tenantId,
        agreementId: agreementId.trim(),
        status: 'active',
      },
    });

    if (existingActive) {
      res.status(409).json({
        success: false,
        error: {
          code: 'CAMPAIGN_ALREADY_ACTIVE',
          message: 'Já existe uma campanha ativa para este convênio.',
        },
      });
      return;
    }

    const campaign = await prisma.campaign.create({
      data: {
        tenantId,
        name: normalizedName,
        agreementId: agreementId.trim(),
        agreementName: agreementName.trim(),
        whatsappInstanceId: instance.id,
        status: 'active',
      },
    });

    res.status(201).json({
      success: true,
      data: campaign,
    });
  })
);

router.get(
  '/',
  query('status').optional(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const rawStatus = req.query.status;

    const statuses = Array.isArray(rawStatus)
      ? rawStatus
      : rawStatus !== undefined
        ? [rawStatus]
        : [];

    const normalizedStatuses = statuses
      .map((status) => normalizeStatus(status))
      .filter((status): status is string => Boolean(status));

    const campaigns = await prisma.campaign.findMany({
      where: {
        tenantId,
        ...(normalizedStatuses.length > 0 ? { status: { in: normalizedStatuses } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: campaigns,
    });
  })
);

router.patch(
  '/:id',
  param('id').isString().trim().isLength({ min: 1 }),
  body('name').optional().isString().trim().isLength({ min: 1 }),
  body('status').optional().isString().trim().isLength({ min: 1 }),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const campaignId = req.params.id;
    const rawStatus = normalizeStatus(req.body?.status);
    const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined;

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
    });

    if (!campaign) {
      respondNotFound(res);
      return;
    }

    const updates: Prisma.CampaignUpdateInput = {};

    if (rawName) {
      updates.name = rawName;
    }

    if (rawStatus) {
      if (rawStatus === 'active') {
        const activeConflict = await prisma.campaign.findFirst({
          where: {
            tenantId,
            agreementId: campaign.agreementId,
            status: 'active',
            NOT: { id: campaign.id },
          },
        });

        if (activeConflict) {
          res.status(409).json({
            success: false,
            error: {
              code: 'CAMPAIGN_ALREADY_ACTIVE',
              message: 'Já existe uma campanha ativa para este convênio.',
            },
          });
          return;
        }
      }

      updates.status = rawStatus;
    }

    if (Object.keys(updates).length === 0) {
      res.json({ success: true, data: campaign });
      return;
    }

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: updates,
    });

    res.json({
      success: true,
      data: updated,
    });
  })
);

export const campaignsRouter = router;
