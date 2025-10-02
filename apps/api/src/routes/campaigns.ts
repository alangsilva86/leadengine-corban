import { Router, type Request, type Response } from 'express';
import { body, param, query } from 'express-validator';
import { Prisma } from '@prisma/client';

import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { prisma } from '../lib/prisma';
import { toSlug, assertValidSlug } from '../lib/slug';
import { logger } from '../config/logger';

type CampaignMetadata = Record<string, unknown> | null | undefined;

const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'ended'] as const;

type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

const buildCampaignHistoryEntry = (action: string, actorId: string, details?: Record<string, unknown>) => ({
  action,
  by: actorId,
  at: new Date().toISOString(),
  ...(details ?? {}),
});

const appendCampaignHistory = (metadata: CampaignMetadata, entry: ReturnType<typeof buildCampaignHistoryEntry>): Prisma.JsonObject => {
  const base: Record<string, unknown> = metadata && typeof metadata === 'object' ? { ...(metadata as Record<string, unknown>) } : {};
  const history = Array.isArray(base.history) ? [...(base.history as unknown[])] : [];
  history.push(entry);
  base.history = history.slice(-50);
  return base as Prisma.JsonObject;
};

const router = Router();

const normalizeStatus = (value: unknown): CampaignStatus | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if ((CAMPAIGN_STATUSES as readonly string[]).includes(normalized)) {
    return normalized as CampaignStatus;
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

const canTransition = (from: CampaignStatus, to: CampaignStatus): boolean => {
  if (from === to) {
    return true;
  }

  const matrix: Record<CampaignStatus, CampaignStatus[]> = {
    draft: ['active', 'ended'],
    active: ['paused', 'ended'],
    paused: ['active', 'ended'],
    ended: [],
  };

  return matrix[from].includes(to);
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
    const slug = toSlug(normalizedName, '');

    if (!slug) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CAMPAIGN_NAME',
          message: 'Informe um nome válido utilizando letras minúsculas, números ou hífens.',
        },
      });
      return;
    }

    try {
      assertValidSlug(slug, 'nome');
    } catch (validationError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CAMPAIGN_NAME',
          message: validationError instanceof Error ? validationError.message : 'Nome inválido para campanha.',
        },
      });
      return;
    }

    const existingCampaign = await prisma.campaign.findFirst({
      where: {
        tenantId,
        OR: [
          { name: normalizedName },
          {
            metadata: {
              path: ['slug'],
              equals: slug,
            },
          },
        ],
      },
      select: { id: true },
    });

    if (existingCampaign) {
      res.status(409).json({
        success: false,
        error: {
          code: 'CAMPAIGN_NAME_IN_USE',
          message: 'Já existe uma campanha com este nome para o tenant.',
        },
      });
      return;
    }

    const requestedStatus = normalizeStatus(req.body?.status) ?? 'draft';

    const campaign = await prisma.campaign.create({
      data: {
        tenantId,
        name: normalizedName,
        agreementId: agreementId.trim(),
        agreementName: agreementName.trim(),
        whatsappInstanceId: instance.id,
        status: requestedStatus,
        metadata: appendCampaignHistory(
          { slug },
          buildCampaignHistoryEntry('created', req.user?.id ?? 'system', { status: requestedStatus, instanceId: instance.id })
        ),
      },
    });

    logger.info('Campaign created', {
      tenantId,
      campaignId: campaign.id,
      instanceId,
      status: campaign.status,
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

    if (rawName && rawName !== campaign.name) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CAMPAIGN_RENAME_NOT_ALLOWED',
          message: 'Renomear campanhas não é permitido.',
        },
      });
      return;
    }

    const updates: Prisma.CampaignUpdateInput = {};
    const currentStatus = normalizeStatus(campaign.status) ?? 'draft';

    if (rawStatus) {
      if (!canTransition(currentStatus, rawStatus)) {
        res.status(409).json({
          success: false,
          error: {
            code: 'INVALID_CAMPAIGN_TRANSITION',
            message: `Transição de ${currentStatus} para ${rawStatus} não permitida.`,
          },
        });
        return;
      }

      updates.status = rawStatus;
      updates.metadata = appendCampaignHistory(
        campaign.metadata as CampaignMetadata,
        buildCampaignHistoryEntry('status-changed', req.user?.id ?? 'system', {
          from: currentStatus,
          to: rawStatus,
        })
      );
      if (rawStatus === 'active') {
        updates.endDate = null;
      } else if (rawStatus === 'ended') {
        updates.endDate = new Date();
      }
    }

    if (!updates.status && !updates.metadata) {
      res.json({ success: true, data: campaign });
      return;
    }

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: updates,
    });

    logger.info('Campaign updated', {
      tenantId,
      campaignId: campaign.id,
      status: updated.status,
    });

    res.json({
      success: true,
      data: updated,
    });
  })
);

export const campaignsRouter = router;
