import { Router, type Request, type Response } from 'express';
import { body, param, query } from 'express-validator';
import { Prisma } from '@prisma/client';

import { asyncHandler } from '../middleware/error-handler';
import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { prisma } from '../lib/prisma';
import { toSlug } from '../lib/slug';
import { logger } from '../config/logger';
import { getCampaignMetrics } from '@ticketz/storage';

type CampaignMetadata = Record<string, unknown> | null | undefined;

const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'ended'] as const;

type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

type CampaignWithInstance = Prisma.CampaignGetPayload<{
  include: {
    whatsappInstance: {
      select: {
        id: true;
        name: true;
      };
    };
  };
}>;

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

const readMetadata = (metadata: CampaignMetadata): Record<string, unknown> => {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
};

const readNumeric = (source: Record<string, unknown>, key: string): number | null => {
  const value = source[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toFixedNumber = (input: number | null, fractionDigits = 2): number | null => {
  if (input === null) {
    return null;
  }
  return Number(input.toFixed(fractionDigits));
};

const buildCampaignResponse = (campaign: CampaignWithInstance) => {
  const metadata = readMetadata(campaign.metadata as CampaignMetadata);
  const metrics = getCampaignMetrics(campaign.tenantId, campaign.id);
  const budget = readNumeric(metadata, 'budget');
  const cplTarget = readNumeric(metadata, 'cplTarget');
  const cpl = budget !== null && metrics.total > 0 ? toFixedNumber(budget / metrics.total) : null;

  const { whatsappInstance, ...campaignData } = campaign;
  const instanceId = campaign.whatsappInstanceId ?? whatsappInstance?.id ?? null;
  const instanceName = whatsappInstance?.name ?? null;

  return {
    ...campaignData,
    instanceId,
    instanceName,
    metadata,
    metrics: {
      ...metrics,
      budget,
      cplTarget,
      cpl,
    },
  };
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
  body('budget').optional().isFloat({ min: 0 }),
  body('cplTarget').optional().isFloat({ min: 0 }),
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
    const budget = typeof req.body?.budget === 'number' ? req.body.budget : undefined;
    const cplTarget = typeof req.body?.cplTarget === 'number' ? req.body.cplTarget : undefined;

    const instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });
    if (!instance) {
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

    const requestedStatus = normalizeStatus(req.body?.status) ?? 'draft';

    const metadataBase: Record<string, unknown> = slug ? { slug } : {};
    if (typeof budget === 'number') {
      metadataBase.budget = budget;
    }
    if (typeof cplTarget === 'number') {
      metadataBase.cplTarget = cplTarget;
    }

    const campaign = await prisma.campaign.create({
      data: {
        tenantId,
        name: normalizedName,
        agreementId: agreementId.trim(),
        agreementName: agreementName.trim(),
        whatsappInstanceId: instance.id,
        status: requestedStatus,
        metadata: appendCampaignHistory(
          metadataBase,
          buildCampaignHistoryEntry('created', req.user?.id ?? 'system', { status: requestedStatus, instanceId: instance.id })
        ),
      },
      include: {
        whatsappInstance: {
          select: {
            id: true,
            name: true,
          },
        },
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
      data: buildCampaignResponse(campaign),
    });
  })
);

router.get(
  '/',
  query('status').optional(),
  query('agreementId').optional().isString().trim(),
  query('instanceId').optional().isString().trim(),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;

    const rawStatus = req.query.status;
    const statuses = Array.isArray(rawStatus)
      ? rawStatus
      : typeof rawStatus === 'string'
        ? rawStatus.split(',')
        : [];

    const normalizedStatuses = statuses
      .map((status) => normalizeStatus(status))
      .filter((status): status is CampaignStatus => Boolean(status));

    const agreementId = typeof req.query.agreementId === 'string' ? req.query.agreementId.trim() : undefined;
    const instanceId = typeof req.query.instanceId === 'string' ? req.query.instanceId.trim() : undefined;

    const campaigns = await prisma.campaign.findMany({
      where: {
        tenantId,
        ...(agreementId ? { agreementId } : {}),
        ...(instanceId ? { whatsappInstanceId: instanceId } : {}),
        ...(normalizedStatuses.length > 0 ? { status: { in: normalizedStatuses } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        whatsappInstance: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: campaigns.map((campaign) => buildCampaignResponse(campaign)),
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
      include: {
        whatsappInstance: {
          select: {
            id: true,
            name: true,
          },
        },
      },
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
      res.json({ success: true, data: buildCampaignResponse(campaign) });
      return;
    }

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: updates,
      include: {
        whatsappInstance: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    logger.info('Campaign updated', {
      tenantId,
      campaignId: campaign.id,
      status: updated.status,
    });

    res.json({
      success: true,
      data: buildCampaignResponse(updated),
    });
  })
);

export const campaignsRouter = router;
