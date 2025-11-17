import { Router, type Request, type Response } from 'express';
import { body, param, query } from 'express-validator';
import {
  CampaignStatus,
  createOrActivateCampaign,
  listCampaigns,
  type LeadAllocationStatus,
} from '@ticketz/storage';
import { asyncHandler } from '../middleware/error-handler';
import { validateRequest } from '../middleware/validation';
import { requireTenant } from '../middleware/auth';
import { leadEngineClient } from '../services/lead-engine-client';
import { logger } from '../config/logger';
import { agreementDefinitions } from '../config/lead-engine';
import type { AgreementSummary } from '../services/lead-engine-client';
import {
  addAllocations,
  listAllocations as listTenantAllocations,
  updateAllocation as updateTenantAllocation,
  isStorageInitializationError,
  isStorageUnavailableError,
} from '../data/lead-allocation-store';
import { prisma } from '../lib/prisma';
import { resolveRequestTenantId } from '../services/tenant-service';

const router: Router = Router();

router.use(requireTenant);

const ensureTenantContext = (req: Request): string => resolveRequestTenantId(req);

const normalizeClassificationValue = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeTagsInput = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  const tags: string[] = [];

  const pushValue = (entry: unknown) => {
    if (typeof entry === 'string') {
      entry
        .split(',')
        .map((token) => token.trim())
        .filter((token) => token.length > 0)
        .forEach((token) => tags.push(token));
      return;
    }

    if (entry !== null && entry !== undefined) {
      const normalized = String(entry).trim();
      if (normalized.length > 0) {
        tags.push(normalized);
      }
    }
  };

  if (Array.isArray(value)) {
    value.forEach(pushValue);
  } else {
    pushValue(value);
  }

  return Array.from(new Set(tags));
};

const normalizeNumericValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const parsed = Number(trimmed.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const ALLOCATION_STATUSES: LeadAllocationStatus[] = ['allocated', 'contacted', 'won', 'lost'];

const buildAgreementFallbackSummaries = (): AgreementSummary[] => {
  return agreementDefinitions.map((definition) => {
    const fallbackLeads = leadEngineClient.getFallbackLeadsForAgreement(definition.id, 100);
    const availableLeads = fallbackLeads.length;
    const hotLeads = Math.min(availableLeads, 5);

    return {
      ...definition,
      availableLeads,
      hotLeads,
      lastSyncAt: null,
    };
  });
};

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && typeof error.message === 'string' && error.message.trim().length > 0) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error.trim();
  }

  return fallback;
};

const extractStatusCode = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  if ('status' in error && typeof (error as { status?: unknown }).status === 'number') {
    return (error as { status?: number }).status;
  }

  if ('statusCode' in error && typeof (error as { statusCode?: unknown }).statusCode === 'number') {
    return (error as { statusCode?: number }).statusCode;
  }

  if ('response' in error && error.response && typeof error.response === 'object') {
    const responseStatus = (error.response as { status?: unknown }).status;
    if (typeof responseStatus === 'number') {
      return responseStatus;
    }
  }

  return undefined;
};

const extractRetryAfterHeader = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = (error as { retryAfter?: unknown }).retryAfter;

  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    const seconds = candidate > 1000 ? Math.ceil(candidate / 1000) : Math.ceil(candidate);
    return seconds > 0 ? seconds.toString() : undefined;
  }

  return undefined;
};

const parseStatusFilter = (
  value: unknown
): { statuses?: LeadAllocationStatus[]; error?: string } => {
  if (value === undefined || value === null) {
    return {};
  }

  const rawValues = Array.isArray(value) ? value : [value];
  const normalized = rawValues
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter((item) => item !== 'all');

  if (normalized.length === 0) {
    return {};
  }

  const invalid = normalized.filter(
    (status) => !ALLOCATION_STATUSES.includes(status as LeadAllocationStatus)
  );

  if (invalid.length > 0) {
    return {
      error: `Status de lead inválido: ${invalid.join(', ')}`,
    };
  }

  return {
    statuses: normalized as LeadAllocationStatus[],
  };
};

const buildAllocationSummary = (
  allocations: Awaited<ReturnType<typeof listTenantAllocations>>
) => {
  return allocations.reduce(
    (
      summary,
      allocation
    ) => {
      summary.total += 1;
      if (allocation.status === 'contacted') {
        summary.contacted += 1;
      } else if (allocation.status === 'won') {
        summary.won += 1;
      } else if (allocation.status === 'lost') {
        summary.lost += 1;
      }
      return summary;
    },
    { total: 0, contacted: 0, won: 0, lost: 0 }
  );
};

// ============================================================================
// Rotas baseadas na API real do Lead Engine
// ============================================================================

/**
 * GET /api/lead-engine/agreements - Lista convênios com métricas
 */
router.get(
  '/agreements',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req);

    logger.info('[LeadEngine] GET /agreements', { tenantId });

    try {
      const { summaries, warnings } = await leadEngineClient.getAgreementSummaries();

      res.json({
        success: true,
        data: summaries,
        warnings: warnings.length > 0 ? warnings : undefined,
      });

    logger.info('[LeadEngine] ✅ Agreements delivered', {
      tenantId,
      count: summaries.length,
      warnings: warnings.length,
    });
  } catch (error) {
    logger.error('[LeadEngine] ❌ Failed to get agreements', { tenantId, error });
    const fallbackSummaries = buildAgreementFallbackSummaries();

    logger.warn('[LeadEngine] ⚠️ Returning fallback agreements', {
      tenantId,
      count: fallbackSummaries.length,
    });

    res.status(200).json({
      success: true,
      data: fallbackSummaries,
      warnings: [
        {
          code: 'LEAD_ENGINE_FALLBACK',
          message: 'Lead Engine indisponível. Retornando convênios simulados.',
        },
      ],
      meta: {
        fallback: true,
      },
    });
  }
})
);

/**
 * GET /api/lead-engine/campaigns - Lista campanhas com filtros opcionais
 */
router.get(
  '/campaigns',
  query('agreementId').optional().isString().trim(),
  query('productType').optional().isString().trim(),
  query('marginType').optional().isString().trim(),
  query('strategy').optional().isString().trim(),
  query('status')
    .optional()
    .customSanitizer((value) => {
      const rawValues = Array.isArray(value) ? value : [value];
      return rawValues
        .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
        .map((item) => item.trim().toLowerCase())
        .map((item) => (item === 'all' ? 'ALL' : item))
        .filter(Boolean);
    })
    .custom((value) => {
      const values = Array.isArray(value) ? value : [value];
      const allowed = new Set([...Object.values(CampaignStatus), 'ALL']);
      const isValid = values.every((status) => allowed.has(status as CampaignStatus));
      if (!isValid) {
        throw new Error('Invalid campaign status');
      }
      return true;
    }),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req);

    const agreementId = typeof req.query.agreementId === 'string' ? req.query.agreementId : undefined;
    const productType = normalizeClassificationValue(req.query.productType);
    const marginType = normalizeClassificationValue(req.query.marginType);
    const strategy = normalizeClassificationValue(req.query.strategy);
    const tags = normalizeTagsInput(req.query.tags);
    const rawStatus = req.query.status as string[] | undefined;
    const normalizedStatus = rawStatus?.filter((status) => status !== 'ALL');
    const statusFilter =
      normalizedStatus && normalizedStatus.length > 0
        ? (normalizedStatus.filter((status): status is CampaignStatus =>
            Object.values(CampaignStatus).includes(status as CampaignStatus)
          ) as CampaignStatus[])
        : undefined;

    logger.info('[LeadEngine] GET /campaigns', {
      tenantId,
      agreementId,
      productType,
      marginType,
      strategy,
      tags,
      status: statusFilter,
    });

    try {
      const filters: Parameters<typeof listCampaigns>[0] = {
        tenantId,
        ...(agreementId ? { agreementId } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(productType ? { productType } : {}),
        ...(marginType ? { marginType } : {}),
        ...(strategy ? { strategy } : {}),
        ...(tags.length > 0 ? { tags } : {}),
      };

      const campaigns = await listCampaigns(filters);

      res.json({
        success: true,
        data: campaigns,
      });

      logger.info('[LeadEngine] ✅ Campaigns listed', {
        tenantId,
        agreementId,
        productType,
        marginType,
        strategy,
        tags,
        status: statusFilter,
        count: campaigns.length,
      });
    } catch (error) {
      logger.error('[LeadEngine] ❌ Failed to list campaigns', {
        tenantId,
        agreementId,
        productType,
        marginType,
        strategy,
        tags,
        status: statusFilter,
        error,
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'CAMPAIGNS_LIST_FAILED',
          message: 'Falha ao listar campanhas',
        },
      });
    }
  })
);

/**
 * GET /api/lead-engine/leads - Busca leads paginados
 */
router.get(
  '/leads',
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('page').optional().isInt({ min: 0 }),
  query('size').optional().isInt({ min: 1, max: 1000 }),
  query('agreementCode').optional().isString(),
  query('documentNumber').optional().isString(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req);

    const {
      startDate,
      endDate,
      page = 0,
      size = 100,
      agreementCode,
      documentNumber,
    } = req.query;

    logger.info('[LeadEngine] GET /leads', {
      tenantId,
      startDate,
      endDate,
      page,
      size,
      agreementCode,
      documentNumber,
    });

    try {
      const response = await leadEngineClient.getLeads({
        startDateUtc: startDate as string,
        endDateUtc: endDate as string,
        page: parseInt(page as string),
        size: parseInt(size as string),
        agreementCode: agreementCode as string,
        documentNumber: documentNumber as string,
      });

      res.json({
        success: true,
        data: response,
      });

      logger.info('[LeadEngine] ✅ Leads retrieved', {
        tenantId,
        count: response.data?.length || 0,
        total: response.total || 0,
      });
    } catch (error) {
      logger.error('[LeadEngine] ❌ Failed to get leads', { tenantId, error });
      res.status(500).json({
        success: false,
        error: {
          code: 'LEADS_FETCH_FAILED',
          message: 'Falha ao buscar leads',
        },
      });
    }
  })
);

/**
 * GET /api/lead-engine/leads/by-agreement/:agreementId - Busca leads por convênio
 */
router.get(
  '/leads/by-agreement/:agreementId',
  param('agreementId').isString(),
  query('take').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req);

    const agreementId = req.params.agreementId as string;
    const take = parseInt(req.query.take as string) || 25;

    logger.info('[LeadEngine] GET /leads/by-agreement/:agreementId', {
      tenantId,
      agreementId,
      take,
    });

    try {
      const leads = await leadEngineClient.fetchLeadsByAgreement(agreementId, take);

      res.json({
        success: true,
        data: leads,
        count: leads.length,
      });

      logger.info('[LeadEngine] ✅ Leads by agreement retrieved', {
        tenantId,
        agreementId,
        count: leads.length,
      });
    } catch (error) {
      logger.error('[LeadEngine] ❌ Failed to get leads by agreement', {
        tenantId,
        agreementId,
        error,
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'LEADS_BY_AGREEMENT_FAILED',
          message: 'Falha ao buscar leads do convênio',
        },
      });
    }
  })
);

/**
 * POST /api/lead-engine/leads/ingest - Ingere leads no Lead Engine principal
 */
router.post(
  '/leads/ingest',
  body('leads').isArray(),
  body('leads.*.document').isString(),
  body('leads.*.registrations').isArray(),
  body('leads.*.registrations.*.number').isString(),
  body('leads.*.registrations.*.agreementCode').isString(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req);

    const { leads } = req.body;

    logger.info('[LeadEngine] POST /leads/ingest', {
      tenantId,
      count: leads.length,
    });

    try {
      await leadEngineClient.ingestLead(leads);

      res.json({
        success: true,
        message: `${leads.length} leads ingeridos com sucesso`,
        count: leads.length,
      });

      logger.info('[LeadEngine] ✅ Leads ingested', {
        tenantId,
        count: leads.length,
      });
    } catch (error) {
      logger.error('[LeadEngine] ❌ Failed to ingest leads', { tenantId, error });
      res.status(500).json({
        success: false,
        error: {
          code: 'LEADS_INGEST_FAILED',
          message: 'Falha ao ingerir leads',
        },
      });
    }
  })
);

/**
 * POST /api/lead-engine/campaigns - Cria ou reativa uma campanha para o tenant
 */
router.post(
  '/campaigns',
  body('agreementId').isString().notEmpty(),
  body('instanceId').isString().notEmpty(),
  body('agreementName').optional().isString().trim().notEmpty(),
  body('name').optional().isString().trim().notEmpty(),
  body()
    .custom((_, { req }) => {
      const hasName = typeof req.body.name === 'string' && req.body.name.trim().length > 0;
      const hasAgreementName =
        typeof req.body.agreementName === 'string' && req.body.agreementName.trim().length > 0;

      if (!hasName && !hasAgreementName) {
        throw new Error('Campaign name is required');
      }

      return true;
    })
    .bail(),
  body('status')
    .optional()
    .isString()
    .trim()
    .customSanitizer((status) => (typeof status === 'string' ? status.toLowerCase() : status))
    .custom((status) => {
      if (
        typeof status === 'string' &&
        Object.values(CampaignStatus).includes(status as CampaignStatus)
      ) {
        return true;
      }
      throw new Error('Invalid campaign status');
    }),
  body('productType').isString().trim().isLength({ min: 1 }),
  body('marginType').optional().isString().trim().isLength({ min: 1 }),
  body('marginValue').optional({ nullable: true }).isFloat({ min: 0 }),
  body('strategy').optional().isString().trim().isLength({ min: 1 }),
  body('tags').optional().isArray(),
  body('tags.*').optional().isString(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req);

    const { agreementId, instanceId } = req.body as {
      agreementId: string;
      instanceId: string;
    };
    const agreementNameInput =
      typeof req.body.agreementName === 'string' ? req.body.agreementName.trim() : undefined;
    const normalizedNameSource =
      typeof req.body.name === 'string' && req.body.name.trim().length > 0
        ? req.body.name
        : agreementNameInput ?? agreementId;
    const normalizedName = normalizedNameSource.trim();
    const rawStatusValue = typeof req.body.status === 'string' ? req.body.status : undefined;
    const status =
      rawStatusValue && Object.values(CampaignStatus).includes(rawStatusValue as CampaignStatus)
        ? (rawStatusValue as CampaignStatus)
        : undefined;
    const rawProductType = normalizeClassificationValue(req.body.productType);
    const productType = rawProductType ?? 'generic';
    const marginType = normalizeClassificationValue(req.body.marginType) ?? 'percentage';
    const marginValue = normalizeNumericValue(req.body.marginValue);
    const strategy = normalizeClassificationValue(req.body.strategy);
    const tags = normalizeTagsInput(req.body.tags);

    logger.info('[LeadEngine] POST /campaigns', {
      tenantId,
      agreementId,
      instanceId,
      name: normalizedName,
      status: status ?? CampaignStatus.ACTIVE,
      productType,
      marginType,
      marginValue,
      strategy,
      tags,
    });

    try {
      const payload: Parameters<typeof createOrActivateCampaign>[0] = {
        tenantId,
        agreementId,
        instanceId,
        name: normalizedName,
        ...(status ? { status } : {}),
        ...(agreementNameInput ? { agreementName: agreementNameInput } : {}),
        ...(productType ? { productType } : {}),
        ...(marginType ? { marginType } : {}),
        ...(marginValue !== null ? { marginValue } : {}),
        ...(strategy ? { strategy } : {}),
        ...(tags.length > 0 ? { tags } : {}),
      };

      const campaign = await createOrActivateCampaign(payload);

      res.json({
        success: true,
        data: campaign,
      });

      logger.info('[LeadEngine] ✅ Campaign created or activated', {
        tenantId,
        agreementId,
        instanceId,
        campaignId: campaign.id,
        status: campaign.status,
      });
    } catch (error) {
      logger.error('[LeadEngine] ❌ Failed to create or activate campaign', {
        tenantId,
        agreementId,
        instanceId,
        error,
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'CAMPAIGN_SAVE_FAILED',
          message: 'Falha ao criar ou reativar campanha',
        },
      });
    }
  })
);

/**
 * POST /api/lead-engine/credit/:agreement/ingest - Ingere leads de crédito
 */
router.post(
  '/credit/:agreement/ingest',
  param('agreement').isString(),
  body('leads').isArray(),
  body('leads.*.RegistrationNumber').isString(),
  body('leads.*.Document').isString(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req);

    const agreement = req.params.agreement as string;
    const { leads } = req.body;

    logger.info('[LeadEngine] POST /credit/:agreement/ingest', {
      tenantId,
      agreement,
      count: leads.length,
    });

    try {
      await leadEngineClient.ingestCreditLead(agreement, leads);

      res.json({
        success: true,
        message: `${leads.length} leads de crédito ingeridos para ${agreement}`,
        count: leads.length,
        agreement,
      });

      logger.info('[LeadEngine] ✅ Credit leads ingested', {
        tenantId,
        agreement,
        count: leads.length,
      });
    } catch (error) {
      logger.error('[LeadEngine] ❌ Failed to ingest credit leads', {
        tenantId,
        agreement,
        error,
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'CREDIT_LEADS_INGEST_FAILED',
          message: 'Falha ao ingerir leads de crédito',
        },
      });
    }
  })
);

/**
 * GET /api/lead-engine/agreements/available - Lista convênios disponíveis
 */
router.get(
  '/agreements/available',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req);

    logger.info('[LeadEngine] GET /agreements/available', { tenantId });

    const agreements = leadEngineClient.getAvailableAgreements();

    res.json({
      success: true,
      data: agreements,
      count: agreements.length,
    });

    logger.info('[LeadEngine] ✅ Available agreements listed', {
      tenantId,
      count: agreements.length,
    });
  })
);

/**
 * GET /api/lead-engine/dashboard - Dashboard com métricas gerais
 */
router.get(
  '/dashboard',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req);

    logger.info('[LeadEngine] GET /dashboard', { tenantId });

    try {
      const { summaries } = await leadEngineClient.getAgreementSummaries();

      const totalLeads = summaries.reduce((sum, agreement) => sum + agreement.availableLeads, 0);
      const totalHotLeads = summaries.reduce((sum, agreement) => sum + agreement.hotLeads, 0);
      const activeAgreements = summaries.filter((agreement) => agreement.availableLeads > 0).length;

      const dashboard = {
        totalLeads,
        totalHotLeads,
        activeAgreements,
        totalAgreements: summaries.length,
        conversionRate: totalLeads > 0 ? ((totalHotLeads / totalLeads) * 100).toFixed(2) : '0.00',
        lastUpdate: new Date().toISOString(),
        agreements: summaries,
      };

      res.json({
        success: true,
        data: dashboard,
      });

      logger.info('[LeadEngine] ✅ Dashboard data retrieved', {
        tenantId,
        totalLeads,
        totalHotLeads,
        activeAgreements,
      });
    } catch (error) {
      logger.error('[LeadEngine] ❌ Failed to get dashboard data', { tenantId, error });
      const fallbackSummaries = buildAgreementFallbackSummaries();
      const totalLeads = fallbackSummaries.reduce((sum, agreement) => sum + agreement.availableLeads, 0);
      const totalHotLeads = fallbackSummaries.reduce((sum, agreement) => sum + agreement.hotLeads, 0);
      const activeAgreements = fallbackSummaries.filter((agreement) => agreement.availableLeads > 0).length;

      logger.warn('[LeadEngine] ⚠️ Returning fallback dashboard data', {
        tenantId,
        totalLeads,
        totalHotLeads,
        activeAgreements,
      });

      res.status(200).json({
        success: true,
        data: {
          totalLeads,
          totalHotLeads,
          activeAgreements,
          totalAgreements: fallbackSummaries.length,
          conversionRate: totalLeads > 0 ? ((totalHotLeads / totalLeads) * 100).toFixed(2) : '0.00',
          lastUpdate: new Date().toISOString(),
          agreements: fallbackSummaries,
        },
        warnings: [
          {
            code: 'LEAD_ENGINE_FALLBACK',
            message: 'Lead Engine indisponível. Dashboard em modo demonstrativo.',
          },
        ],
        meta: {
          fallback: true,
        },
      });
    }
})
);

router.get(
  '/allocations',
  query('agreementId').optional().isString().trim(),
  query('campaignId').optional().isString().trim(),
  query('instanceId').optional().isString().trim(),
  query('status').optional(),
  query('statuses').optional(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req);

    const agreementId = typeof req.query.agreementId === 'string' ? req.query.agreementId : undefined;
    const campaignId = typeof req.query.campaignId === 'string' ? req.query.campaignId : undefined;
    const instanceId = typeof req.query.instanceId === 'string' ? req.query.instanceId : undefined;
    const { statuses, error } = parseStatusFilter(req.query.status ?? req.query.statuses);

    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ALLOCATION_STATUS',
          message: error,
        },
      });
      return;
    }

    if (!agreementId && !campaignId && !instanceId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ALLOCATIONS_FILTER_REQUIRED',
          message: 'Informe campaignId, agreementId ou instanceId para listar alocações.',
        },
      });
      return;
    }

    logger.info('[LeadEngine] GET /allocations', {
      tenantId,
      agreementId,
      campaignId,
      instanceId,
      statuses,
    });

    try {
      const allocationFilters: Parameters<typeof listTenantAllocations>[1] = {
        ...(agreementId ? { agreementId } : {}),
        ...(campaignId ? { campaignId } : {}),
        ...(instanceId ? { instanceId } : {}),
        ...(statuses ? { statuses } : {}),
      };

      const allocations = await listTenantAllocations(tenantId, allocationFilters);

      const summary = buildAllocationSummary(allocations);

      res.json({
        success: true,
        data: allocations,
        meta: {
          total: summary.total,
          summary,
        },
      });
    } catch (error) {
      if (isStorageInitializationError(error)) {
        logger.warn('[LeadEngine] ⚠️ Storage not initialized when listing allocations', {
          tenantId,
          agreementId,
          campaignId,
          instanceId,
          statuses,
          error,
        });

        const allocations: Awaited<ReturnType<typeof listTenantAllocations>> = [];
        const summary = buildAllocationSummary(allocations);

        res.json({
          success: true,
          data: allocations,
          meta: {
            total: summary.total,
            summary,
          },
        });
        return;
      }

      if (isStorageUnavailableError(error)) {
        logger.error('[LeadEngine] 🚫 Storage unavailable when listing allocations', {
          tenantId,
          agreementId,
          campaignId,
          instanceId,
          statuses,
          error,
        });

        res.status(503).json({
          success: false,
          error: {
            code: 'ALLOCATIONS_STORAGE_UNAVAILABLE',
            message:
              'Serviço de armazenamento indisponível no momento. Tente novamente mais tarde.',
          },
        });
        return;
      }

      const statusCandidate = extractStatusCode(error);
      const status = statusCandidate && statusCandidate >= 400 && statusCandidate < 600 ? statusCandidate : 500;
      const retryAfter = extractRetryAfterHeader(error);

      if (retryAfter) {
        res.setHeader('Retry-After', retryAfter);
      }

      const message = toErrorMessage(error, 'Falha ao listar leads alocados');

      logger.error('[LeadEngine] ❌ Failed to list allocations', {
        tenantId,
        agreementId,
        campaignId,
        instanceId,
        statuses,
        status,
        retryAfter,
        error,
      });

      res.status(status).json({
        success: false,
        error: {
          code: status >= 500 ? 'ALLOCATIONS_LIST_FAILED' : 'ALLOCATIONS_LIST_ERROR',
          message,
        },
      });
    }
  })
);

router.post(
  '/allocations',
  body('campaignId').isString().trim().notEmpty(),
  body('agreementId').isString().trim().notEmpty(),
  body('take').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req);

    const { campaignId, agreementId } = req.body as {
      campaignId: string;
      agreementId: string;
      take?: number;
    };
    const take = typeof req.body.take === 'number' ? req.body.take : Number(req.body.take) || 25;

    logger.info('[LeadEngine] POST /allocations', {
      tenantId,
      campaignId,
      agreementId,
      take,
    });

    try {
      const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });

      if (!campaign) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CAMPAIGN_NOT_FOUND',
            message: 'Campanha não encontrada.',
          },
        });
        return;
      }

      if (campaign.status !== 'active') {
        res.status(409).json({
          success: false,
          error: {
            code: 'CAMPAIGN_NOT_ACTIVE',
            message: 'A campanha precisa estar ativa para receber novos leads.',
          },
        });
        return;
      }

      if (campaign.agreementId && campaign.agreementId !== agreementId) {
        res.status(409).json({
          success: false,
          error: {
            code: 'AGREEMENT_MISMATCH',
            message: 'O convênio informado não corresponde ao da campanha.',
          },
        });
        return;
      }

      const leads = await leadEngineClient.fetchLeadsByAgreement(agreementId, take);
      const { newlyAllocated, summary } = await addAllocations(tenantId, { campaignId }, leads);

      res.json({
        success: true,
        data: newlyAllocated,
        meta: {
          pulled: leads.length,
          allocated: newlyAllocated.length,
          summary,
        },
      });
    } catch (error) {
      const statusCandidate = extractStatusCode(error);
      const status = statusCandidate && statusCandidate >= 400 && statusCandidate < 600 ? statusCandidate : 502;
      const retryAfter = extractRetryAfterHeader(error);

      const message = toErrorMessage(error, 'Falha ao buscar novos leads');

      logger.error('[LeadEngine] ❌ Failed to allocate leads', {
        tenantId,
        campaignId,
        agreementId,
        take,
        status,
        retryAfter,
        error,
      });

      const fallbackLeads = leadEngineClient.getFallbackLeadsForAgreement(agreementId, take);
      if (fallbackLeads.length > 0) {
        logger.warn('[LeadEngine] ⚠️ Using fallback leads after allocation failure', {
          tenantId,
          campaignId,
          agreementId,
          requested: take,
          fallback: fallbackLeads.length,
        });

        const { newlyAllocated, summary } = await addAllocations(tenantId, { campaignId }, fallbackLeads);

        res.json({
          success: true,
          data: newlyAllocated,
          meta: {
            pulled: fallbackLeads.length,
            allocated: newlyAllocated.length,
            summary,
            warnings: [
              'Broker indisponível: entregando lote de demonstração. Tente novamente em instantes para dados reais.',
            ],
            error: message,
            status,
            retryAfter,
          },
        });
        return;
      }

      if (retryAfter) {
        res.setHeader('Retry-After', retryAfter);
      }

      res.status(status).json({
        success: false,
        error: {
          code: status >= 500 ? 'ALLOCATIONS_PULL_FAILED' : 'ALLOCATIONS_PULL_ERROR',
          message,
        },
      });
    }
  })
);

router.patch(
  '/allocations/:allocationId',
  param('allocationId').isString().trim().notEmpty(),
  body('status')
    .optional()
    .isString()
    .custom((value) => ALLOCATION_STATUSES.includes(String(value).toLowerCase() as LeadAllocationStatus)),
  body('notes').optional().isString(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req);

    const allocationId = req.params.allocationId;
    const status = typeof req.body.status === 'string' ? (req.body.status.toLowerCase() as LeadAllocationStatus) : undefined;
    const notes = typeof req.body.notes === 'string' ? req.body.notes : undefined;

    logger.info('[LeadEngine] PATCH /allocations/:allocationId', {
      tenantId,
      allocationId,
      status,
      notes: notes ? '<<provided>>' : null,
    });

    try {
      const updatePayload: Parameters<typeof updateTenantAllocation>[2] = {};
      if (status) {
        updatePayload.status = status;
      }
      if (notes !== undefined) {
        updatePayload.notes = notes;
      }

      const allocation = await updateTenantAllocation(tenantId, allocationId, updatePayload);

      if (!allocation) {
        res.status(404).json({
          success: false,
          error: {
            code: 'ALLOCATION_NOT_FOUND',
            message: 'Lead não encontrado para atualização',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: allocation,
      });
    } catch (error) {
      logger.error('[LeadEngine] ❌ Failed to update allocation', {
        tenantId,
        allocationId,
        status,
        error,
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'ALLOCATION_UPDATE_FAILED',
          message: 'Falha ao atualizar lead',
        },
      });
    }
  })
);

router.get(
  '/allocations/export',
  query('agreementId').optional().isString().trim(),
  query('campaignId').optional().isString().trim(),
  query('status').optional(),
  query('statuses').optional(),
  query('instanceId').optional().isString().trim(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req);

    const agreementId = typeof req.query.agreementId === 'string' ? req.query.agreementId : undefined;
    const campaignId = typeof req.query.campaignId === 'string' ? req.query.campaignId : undefined;
    const instanceId = typeof req.query.instanceId === 'string' ? req.query.instanceId : undefined;
    const fromDate = typeof req.query.from === 'string' ? new Date(req.query.from) : undefined;
    const toDate = typeof req.query.to === 'string' ? new Date(req.query.to) : undefined;
    const { statuses, error } = parseStatusFilter(req.query.status ?? req.query.statuses);

    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ALLOCATION_STATUS',
          message: error,
        },
      });
      return;
    }

    logger.info('[LeadEngine] GET /allocations/export', {
      tenantId,
      agreementId,
      campaignId,
      statuses,
      instanceId,
      from: fromDate?.toISOString() ?? null,
      to: toDate?.toISOString() ?? null,
    });

    try {
      const exportFilters: Parameters<typeof listTenantAllocations>[1] = {
        ...(agreementId ? { agreementId } : {}),
        ...(campaignId ? { campaignId } : {}),
        ...(instanceId ? { instanceId } : {}),
        ...(statuses ? { statuses } : {}),
      };

      const allocations = await listTenantAllocations(tenantId, exportFilters);

      const filtered = allocations.filter((allocation) => {
        if (instanceId && allocation.instanceId !== instanceId) {
          return false;
        }

        const receivedAtDate = new Date(allocation.receivedAt);

        if (fromDate && Number.isFinite(fromDate.getTime()) && receivedAtDate < fromDate) {
          return false;
        }

        if (toDate && Number.isFinite(toDate.getTime()) && receivedAtDate > toDate) {
          return false;
        }

        return true;
      });

      const header = [
        'allocationId',
        'campaignId',
        'campaignName',
        'agreementId',
        'instanceId',
        'leadId',
        'fullName',
        'document',
        'phone',
        'status',
        'receivedAt',
        'updatedAt',
        'notes',
        'registrations',
        'tags',
        'margin',
        'netMargin',
        'score',
      ];

      const escape = (value: unknown) => {
        if (value === null || value === undefined) {
          return '';
        }
        const text = String(value).replace(/"/g, '""');
        return `"${text}"`;
      };

      const rows = filtered.map((allocation) =>
        [
          allocation.allocationId,
          allocation.campaignId,
          allocation.campaignName,
          allocation.agreementId,
          allocation.instanceId,
          allocation.leadId,
          allocation.fullName,
          allocation.document,
          allocation.phone ?? '',
          allocation.status,
          allocation.receivedAt,
          allocation.updatedAt,
          allocation.notes ?? '',
          allocation.registrations.join('|'),
          allocation.tags.join('|'),
          allocation.margin ?? '',
          allocation.netMargin ?? '',
          allocation.score ?? '',
        ].map(escape).join(',')
      );

      const csvContent = [header.map(escape).join(','), ...rows].join('\n');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="lead-allocations-${timestamp}.csv"`);
      res.send(`\ufeff${csvContent}`);
    } catch (error) {
      logger.error('[LeadEngine] ❌ Failed to export allocations', {
        tenantId,
        agreementId,
        campaignId,
        statuses,
        instanceId,
        from: fromDate?.toISOString() ?? null,
        to: toDate?.toISOString() ?? null,
        error,
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'ALLOCATIONS_EXPORT_FAILED',
          message: 'Falha ao exportar leads',
        },
      });
    }
  })
);

export { router as leadEngineRouter };
