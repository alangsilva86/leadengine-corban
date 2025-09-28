
import { Router, type Request, type Response } from 'express';
import { body, param, query } from 'express-validator';
import { asyncHandler } from '../middleware/error-handler';
import { validateRequest } from '../middleware/validation';
import { leadEngineClient } from '../services/lead-engine-client';
import { agreementDefinitions } from '../config/lead-engine';
import { logger } from '../config/logger';
import { addAllocations, listAllocations, updateAllocation } from '../data/lead-allocation-store';
import {
  CampaignStatus,
  createOrActivateCampaign,
  findActiveCampaign,
  findCampaignById,
  listCampaigns,
  updateCampaignStatus,
} from '@ticketz/storage';

const router: Router = Router();

const extractTenantId = (req: Request): string | null => {
  if (req.user?.tenantId?.trim()) {
    return req.user.tenantId.trim();
  }

  const headerValue = req.headers['x-tenant-id'];
  const headerTenant = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof headerTenant === 'string' && headerTenant.trim().length > 0) {
    return headerTenant.trim();
  }

  return null;
};

const ensureTenantContext = (req: Request, res: Response): string | null => {
  const tenantId = extractTenantId(req);
  if (!tenantId) {
    const diagnostic = {
      method: req.method,
      path: req.originalUrl,
      hint: 'Inclua o header x-tenant-id ou autentique-se com um usuário que tenha tenantId.',
    };
    logger.warn('[LeadEngine] 🚫 Tenant ausente', diagnostic);
    res.status(400).json({
      success: false,
      error: {
        code: 'TENANT_ID_REQUIRED',
        message: 'Informe o tenant via header x-tenant-id ou finalize a autenticação antes de usar o Lead Engine.',
        details: diagnostic,
      },
    });
    return null;
  }

  return tenantId;
};

type CampaignRecord = NonNullable<Awaited<ReturnType<typeof findCampaignById>>>;

const resolveCampaignContext = async (
  tenantId: string,
  options: { campaignId?: string | null; agreementId?: string | null }
): Promise<CampaignRecord | null> => {
  if (options.campaignId) {
    const campaign = await findCampaignById(tenantId, options.campaignId);
    return campaign ?? null;
  }

  if (options.agreementId) {
    const campaign = await findActiveCampaign(tenantId, options.agreementId);
    return campaign ?? null;
  }

  return null;
};

const mapCampaignResponse = (campaign: CampaignRecord) => {
  const agreement = agreementDefinitions.find((item) => item.id === campaign.agreementId);
  return {
    id: campaign.id,
    tenantId: campaign.tenantId,
    agreementId: campaign.agreementId,
    agreementName: agreement?.name ?? campaign.agreementId,
    instanceId: campaign.instanceId,
    name: campaign.name,
    status: campaign.status.toLowerCase(),
    startDate: campaign.startDate?.toISOString() ?? null,
    endDate: campaign.endDate?.toISOString() ?? null,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
};

router.get(
  '/agreements',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req, res);
    if (!tenantId) {
      return;
    }

    logger.info('HTTP GET /lead-engine/agreements', { tenantId });
    const { summaries, warnings } = await leadEngineClient.getAgreementSummaries();

    if (warnings.length > 0) {
      logger.warn('Lead Engine agreements delivered with warnings', {
        tenantId,
        count: summaries.length,
        warnings,
      });
    } else {
      logger.info('Lead Engine agreements delivered', {
        tenantId,
        count: summaries.length,
      });
    }
    res.json({
      success: true,
      data: summaries,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  })
);

router.get(
  '/campaigns',
  query('agreementId').optional().isString(),
  query('status').optional().isString(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req, res);
    if (!tenantId) {
      return;
    }

    const agreementId = req.query.agreementId as string | undefined;
    const statusParam = req.query.status as string | undefined;
    const statusKeys = statusParam
      ? (statusParam
          .split(',')
          .map((item) => item.trim().toUpperCase())
          .filter((value) => Object.prototype.hasOwnProperty.call(CampaignStatus, value)) as Array<
          keyof typeof CampaignStatus
        >)
      : undefined;
    const statusFilters = statusKeys?.map((value) => CampaignStatus[value]);

    logger.info('HTTP GET /lead-engine/campaigns', {
      tenantId,
      agreementId: agreementId ?? null,
      statuses: statusFilters ?? null,
    });

    const campaigns = await listCampaigns({
      tenantId,
      agreementId,
      status: statusFilters,
    });

    res.json({
      success: true,
      data: campaigns.map(mapCampaignResponse),
    });
  })
);

router.post(
  '/campaigns',
  body('agreementId').isString().notEmpty(),
  body('instanceId').isString().notEmpty(),
  body('name').optional().isString().isLength({ min: 1, max: 120 }),
  body('status').optional().isIn(['active', 'paused', 'completed']),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req, res);
    if (!tenantId) {
      return;
    }

    const agreementId = req.body.agreementId as string;
    const instanceId = req.body.instanceId as string;
    const agreement = agreementDefinitions.find((item) => item.id === agreementId);
    const requestedStatus = (req.body.status as string | undefined)?.toUpperCase();
    const status = requestedStatus && requestedStatus in CampaignStatus
      ? CampaignStatus[requestedStatus as keyof typeof CampaignStatus]
      : CampaignStatus.ACTIVE;
    const name = (req.body.name as string | undefined) ||
      `${agreement?.name ?? agreementId} • ${instanceId}`;

    logger.info('HTTP POST /lead-engine/campaigns', {
      tenantId,
      agreementId,
      instanceId,
      status,
    });

    const campaign = await createOrActivateCampaign({
      tenantId,
      agreementId,
      instanceId,
      name,
      status,
      startDate: new Date(),
    });

    res.status(201).json({
      success: true,
      data: mapCampaignResponse(campaign),
    });
  })
);

router.patch(
  '/campaigns/:campaignId/status',
  param('campaignId').isString().notEmpty(),
  body('status').isIn(['active', 'paused', 'completed']),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req, res);
    if (!tenantId) {
      return;
    }

    const campaignId = req.params.campaignId as string;
    const requestedStatus = (req.body.status as string).toUpperCase();
    const status = CampaignStatus[requestedStatus as keyof typeof CampaignStatus];

    if (!status) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Status de campanha inválido. Use active, paused ou completed.',
        },
      });
    }

    logger.info('HTTP PATCH /lead-engine/campaigns/:campaignId/status', {
      tenantId,
      campaignId,
      status,
    });

    const campaign = await updateCampaignStatus(tenantId, campaignId, status);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CAMPAIGN_NOT_FOUND',
          message: 'Campanha não localizada para este tenant.',
        },
      });
    }

    res.json({
      success: true,
      data: mapCampaignResponse(campaign),
    });
  })
);

router.get(
  '/allocations',
  query('agreementId').optional().isString(),
  query('campaignId').optional().isString(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req, res);
    if (!tenantId) {
      return;
    }

    const agreementId = req.query.agreementId as string | undefined;
    const campaignId = req.query.campaignId as string | undefined;
    logger.info('HTTP GET /lead-engine/allocations', {
      tenantId,
      agreementId: agreementId ?? null,
      campaignId: campaignId ?? null,
    });
    const allocations = await listAllocations(tenantId, agreementId, campaignId);
    logger.info('Lead Engine allocations retrieved', {
      tenantId,
      agreementId: agreementId ?? null,
      campaignId: campaignId ?? null,
      count: allocations.length,
    });
    res.json({
      success: true,
      data: allocations,
    });
  })
);

router.get(
  '/allocations/export',
  query('agreementId').optional().isString(),
  query('campaignId').optional().isString(),
  query('status').optional().isString(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req, res);
    if (!tenantId) {
      return;
    }

    const agreementId = req.query.agreementId as string | undefined;
    const campaignId = req.query.campaignId as string | undefined;
    const statusFilter = (req.query.status as string | undefined)?.toLowerCase();
    const requestedStatuses = statusFilter
      ? statusFilter
          .split(',')
          .map((status) => status.trim())
          .filter((status): status is 'allocated' | 'contacted' | 'won' | 'lost' =>
            ['allocated', 'contacted', 'won', 'lost'].includes(status)
          )
      : undefined;

    const allocations = await listAllocations(tenantId, agreementId, campaignId);
    const filtered = requestedStatuses?.length
      ? allocations.filter((allocation) => requestedStatuses.includes(allocation.status))
      : allocations;

    const headers = [
      'allocationId',
      'campaignId',
      'agreementId',
      'instanceId',
      'fullName',
      'document',
      'matricula',
      'phone',
      'status',
      'receivedAt',
      'updatedAt',
      'notes',
      'tags',
      'registrations',
      'margin',
      'netMargin',
      'score',
    ];

    const escapeCsv = (value: unknown) => {
      if (value === null || value === undefined) {
        return '';
      }
      const text = Array.isArray(value) ? value.join('|') : String(value);
      if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const rows = filtered.map((allocation) =>
      [
        allocation.allocationId,
        allocation.campaignId,
        allocation.agreementId,
        allocation.instanceId,
        allocation.fullName,
        allocation.document,
        allocation.matricula ?? '',
        allocation.phone ?? '',
        allocation.status,
        allocation.receivedAt,
        allocation.updatedAt,
        allocation.notes ?? '',
        allocation.tags.join('|'),
        allocation.registrations.join('|'),
        allocation.margin ?? '',
        allocation.netMargin ?? '',
        allocation.score ?? '',
      ].map(escapeCsv).join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="lead-allocations.csv"');
    res.send(csvContent);
  })
);

router.post(
  '/allocations',
  body('campaignId').optional().isString().notEmpty(),
  body('agreementId').optional().isString().notEmpty(),
  body('take').optional().isInt({ min: 1, max: 50 }).toInt(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req, res);
    if (!tenantId) {
      return;
    }

    const campaignId = req.body.campaignId as string | undefined;
    const agreementId = req.body.agreementId as string | undefined;
    const take = (req.body.take as number | undefined) ?? 10;
    logger.info('HTTP POST /lead-engine/allocations', {
      tenantId,
      campaignId: campaignId ?? null,
      agreementId: agreementId ?? null,
      requested: take,
    });

    const campaign = await resolveCampaignContext(tenantId, { campaignId, agreementId });
    if (!campaign) {
      logger.warn('Lead Engine allocation failed: campaign not found', {
        tenantId,
        campaignId: campaignId ?? null,
        agreementId: agreementId ?? null,
      });
      return res.status(404).json({
        success: false,
        error: {
          code: 'CAMPAIGN_NOT_FOUND',
          message:
            'Não encontramos uma campanha ativa para o convênio selecionado. Vincule um número de WhatsApp antes de buscar leads.',
        },
      });
    }

    if (campaign.status !== CampaignStatus.ACTIVE) {
      logger.warn('Lead Engine allocation failed: campaign is not active', {
        tenantId,
        campaignId: campaign.id,
        campaignStatus: campaign.status,
      });
      return res.status(409).json({
        success: false,
        error: {
          code: 'CAMPAIGN_NOT_ACTIVE',
          message: 'Ative a campanha antes de solicitar novos leads.',
          details: { status: campaign.status.toLowerCase() },
        },
      });
    }

    const agreementDefinition = agreementDefinitions.find(
      (item) => item.id === campaign.agreementId
    );

    const leads = await leadEngineClient.fetchLeads({
      agreementId: campaign.agreementId,
      take,
    });
    const allocationResult = await addAllocations(tenantId, campaign.id, leads);
    logger.info('Lead Engine allocation created', {
      tenantId,
      campaignId: campaign.id,
      agreementId: campaign.agreementId,
      requested: take,
      allocated: allocationResult.newlyAllocated.length,
    });

    res.json({
      success: true,
      data: allocationResult.newlyAllocated,
      summary: allocationResult.summary,
      campaign: {
        id: campaign.id,
        instanceId: campaign.instanceId,
        agreementId: campaign.agreementId,
        name: campaign.name,
        agreementName: agreementDefinition?.name ?? campaign.agreementId,
      },
    });
  })
);

router.patch(
  '/allocations/:allocationId',
  param('allocationId').isString().notEmpty(),
  body('status').isIn(['allocated', 'contacted', 'won', 'lost']),
  body('notes').optional().isString().isLength({ max: 500 }),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req, res);
    if (!tenantId) {
      return;
    }

    const allocationId = req.params.allocationId as string;
    logger.info('HTTP PATCH /lead-engine/allocations/:allocationId', {
      tenantId,
      allocationId,
      status: req.body.status,
    });

    const updated = await updateAllocation(tenantId, allocationId, {
      status: req.body.status,
      notes: req.body.notes,
    });

    if (!updated) {
      logger.warn('Lead Engine allocation update failed: allocation not found or not owned', {
        tenantId,
        allocationId,
      });
      return res.status(404).json({
        success: false,
        error: {
          code: 'ALLOCATION_NOT_FOUND',
          message: 'Lead não encontrado ou não pertence ao usuário atual',
        },
      });
    }

    res.json({
      success: true,
      data: updated,
    });
    logger.info('Lead Engine allocation updated', {
      tenantId,
      allocationId,
      status: updated.status,
    });
  })
);

export { router as leadEngineRouter };
