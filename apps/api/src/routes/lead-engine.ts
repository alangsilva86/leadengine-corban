import { Router, type Request, type Response } from 'express';
import { body, param, query } from 'express-validator';
import { CampaignStatus, createOrActivateCampaign, listCampaigns } from '@ticketz/storage';
import { asyncHandler } from '../middleware/error-handler';
import { validateRequest } from '../middleware/validation';
import { leadEngineClient } from '../services/lead-engine-client';
import { logger } from '../config/logger';

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

  return 'demo-tenant'; // Fallback para desenvolvimento
};

const ensureTenantContext = (req: Request, res: Response): string | null => {
  const tenantId = extractTenantId(req);
  if (!tenantId) {
    logger.warn('[LeadEngine] 🚫 Tenant ausente', {
      method: req.method,
      path: req.originalUrl,
    });
    res.status(400).json({
      success: false,
      error: {
        code: 'TENANT_ID_REQUIRED',
        message: 'Informe o tenant via header x-tenant-id ou autentique-se.',
      },
    });
    return null;
  }

  return tenantId;
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
    const tenantId = ensureTenantContext(req, res);
    if (!tenantId) return;

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
      res.status(500).json({
        success: false,
        error: {
          code: 'AGREEMENTS_FETCH_FAILED',
          message: 'Falha ao buscar convênios',
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
  query('status')
    .optional()
    .customSanitizer((value) => {
      const rawValues = Array.isArray(value) ? value : [value];
      return rawValues
        .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
        .map((item) => item.trim())
        .filter(Boolean);
    })
    .custom((value) => {
      const values = Array.isArray(value) ? value : [value];
      const allowed = new Set(Object.values(CampaignStatus));
      const isValid = values.every((status) => allowed.has(status as CampaignStatus));
      if (!isValid) {
        throw new Error('Invalid campaign status');
      }
      return true;
    }),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req, res);
    if (!tenantId) return;

    const agreementId = typeof req.query.agreementId === 'string' ? req.query.agreementId : undefined;
    const rawStatus = req.query.status as string[] | undefined;
    const statusFilter = rawStatus && rawStatus.length > 0 ? rawStatus.map((status) => status as CampaignStatus) : undefined;

    logger.info('[LeadEngine] GET /campaigns', {
      tenantId,
      agreementId,
      status: statusFilter,
    });

    try {
      const campaigns = await listCampaigns({
        tenantId,
        agreementId,
        status: statusFilter,
      });

      res.json({
        success: true,
        data: campaigns,
      });

      logger.info('[LeadEngine] ✅ Campaigns listed', {
        tenantId,
        agreementId,
        status: statusFilter,
        count: campaigns.length,
      });
    } catch (error) {
      logger.error('[LeadEngine] ❌ Failed to list campaigns', {
        tenantId,
        agreementId,
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
    const tenantId = ensureTenantContext(req, res);
    if (!tenantId) return;

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
    const tenantId = ensureTenantContext(req, res);
    if (!tenantId) return;

    const { agreementId } = req.params;
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
    const tenantId = ensureTenantContext(req, res);
    if (!tenantId) return;

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
  body('name').isString().notEmpty(),
  body('status')
    .optional()
    .isString()
    .trim()
    .custom((status) => {
      if (!Object.values(CampaignStatus).includes(status as CampaignStatus)) {
        throw new Error('Invalid campaign status');
      }
      return true;
    }),
  validateRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = ensureTenantContext(req, res);
    if (!tenantId) return;

    const { agreementId, instanceId, name } = req.body as {
      agreementId: string;
      instanceId: string;
      name: string;
    };
    const status = req.body.status as CampaignStatus | undefined;

    logger.info('[LeadEngine] POST /campaigns', {
      tenantId,
      agreementId,
      instanceId,
      status: status ?? CampaignStatus.ACTIVE,
    });

    try {
      const campaign = await createOrActivateCampaign({
        tenantId,
        agreementId,
        instanceId,
        name,
        status,
      });

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
    const tenantId = ensureTenantContext(req, res);
    if (!tenantId) return;

    const { agreement } = req.params;
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
    const tenantId = ensureTenantContext(req, res);
    if (!tenantId) return;

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
    const tenantId = ensureTenantContext(req, res);
    if (!tenantId) return;

    logger.info('[LeadEngine] GET /dashboard', { tenantId });

    try {
      const { summaries } = await leadEngineClient.getAgreementSummaries();
      
      const totalLeads = summaries.reduce((sum, agreement) => sum + agreement.availableLeads, 0);
      const totalHotLeads = summaries.reduce((sum, agreement) => sum + agreement.hotLeads, 0);
      const activeAgreements = summaries.filter(agreement => agreement.availableLeads > 0).length;

      const dashboard = {
        totalLeads,
        totalHotLeads,
        activeAgreements,
        totalAgreements: summaries.length,
        conversionRate: totalLeads > 0 ? (totalHotLeads / totalLeads * 100).toFixed(2) : '0.00',
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
      res.status(500).json({
        success: false,
        error: {
          code: 'DASHBOARD_FETCH_FAILED',
          message: 'Falha ao buscar dados do dashboard',
        },
      });
    }
  })
);

export { router as leadEngineRouter };
