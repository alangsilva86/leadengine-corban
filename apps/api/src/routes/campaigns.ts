import { Router, type Request, type Response } from 'express';
import { requireTenant } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { resolveRequestTenantId } from '../services/tenant-service';
import { HttpErrorTranslator } from '../utils/http-error-translator';
import { withRequestContext } from '../utils/request-context';
import { logger } from '../config/logger';
import type { CampaignDTO } from './campaigns.types';
import type { CreateCampaignInput } from '../services/campaigns-service';
import {
  buildFilters,
  createCampaignValidators,
  deleteCampaignValidators,
  listCampaignValidators,
  normalizeClassificationValue,
  normalizeStatus,
  normalizeTagsInput,
  parseMetadataPayload,
  readNumericField,
  updateCampaignValidators,
} from './campaigns.validators';
import {
  CampaignServiceError,
  createCampaign,
  deleteCampaign,
  listCampaigns,
  updateCampaign,
} from '../services/campaigns-service';

export { buildFilters };

export const resolveTenantId = (req: Request): string => resolveRequestTenantId(req);

const readCampaignIdParam = (req: Request): string | null => {
  const rawId = req.params?.id;
  if (typeof rawId !== 'string') {
    return null;
  }
  const trimmed = rawId.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const handleCampaignError = (res: Response, error: unknown): boolean => {
  if (error instanceof CampaignServiceError) {
    const payload: Record<string, unknown> = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
      ...(error.details ?? {}),
    };
    res.status(error.status).json(payload);
    return true;
  }

  return false;
};

const errorTranslator = new HttpErrorTranslator({
  services: [
    {
      match: (error): error is CampaignServiceError => error instanceof CampaignServiceError,
      map: (error) => ({
        status: error.status,
        code: error.code,
        message: error.message,
        details: error.details,
      }),
    },
  ],
});

const router = Router();

export const buildCreateCampaignInput = (
  body: Record<string, unknown>,
  req: Request
): CreateCampaignInput => {
  const rid = (req as Request & { rid?: string }).rid;
  const requestId = typeof rid === 'string' ? rid : undefined;
  const logContext = {
    scope: 'campaigns:create',
    requestId,
    tenantId: req.user?.tenantId ?? null,
  };

  logger.info('Building campaign creation payload', logContext);

  const requestedTenantId = resolveRequestTenantId(req);
  const rawAgreementId = typeof body.agreementId === 'string' ? body.agreementId.trim() : '';
  const rawAgreementName = normalizeClassificationValue(body.agreementName);
  const rawInstanceId = typeof body.instanceId === 'string' ? body.instanceId.trim() : '';
  const rawBrokerId = typeof body.brokerId === 'string' ? body.brokerId.trim() : '';
  const providedName = typeof body.name === 'string' ? body.name.trim() : '';
  const budget = typeof body.budget === 'number' ? body.budget : undefined;
  const cplTarget = typeof body.cplTarget === 'number' ? body.cplTarget : undefined;
  const schedule = body.schedule ?? { type: 'immediate' };
  const channel = typeof body.channel === 'string' ? body.channel : 'whatsapp';
  const audienceCount = Array.isArray(body.audience) ? body.audience.length : 0;
  const productType = normalizeClassificationValue(body.productType) ?? 'generic';
  const marginType = normalizeClassificationValue(body.marginType) ?? 'percentage';
  const strategy = normalizeClassificationValue(body.strategy);
  const explicitTags = normalizeTagsInput(body.tags);
  const resolvedTags = Array.from(
    new Set([
      ...explicitTags,
      ...([productType, marginType, strategy].filter((value): value is string => Boolean(value)) as string[]),
    ])
  );
  const metadata = parseMetadataPayload(body.metadata);
  const marginValue = readNumericField(body, 'marginValue');

  if (marginValue !== null) {
    metadata.margin = marginValue;
  }

  if (requestId && !metadata.requestId) {
    metadata.requestId = requestId;
  }

  const actorId = req.user?.id ?? 'system';
  const status = normalizeStatus(body.status);

  const payload = {
    requestedTenantId,
    explicitTenantId:
      typeof body.tenantId === 'string' && body.tenantId.trim().length > 0 ? body.tenantId.trim() : undefined,
    agreementId: rawAgreementId,
    agreementName: rawAgreementName,
    instanceId: rawInstanceId,
    brokerId: rawBrokerId || null,
    name: providedName,
    budget,
    cplTarget,
    schedule,
    channel,
    audienceCount,
    productType,
    marginType,
    marginValue,
    strategy,
    tags: resolvedTags,
    metadata,
    actorId,
    status,
  };

  logger.debug('Campaign creation payload built', { ...logContext, payload });

  return payload;
};

router.get(
  '/',
  listCampaignValidators,
  validateRequest,
  requireTenant,
  withRequestContext(async ({ req, res, requestId }) => {
    const tenantId = resolveTenantId(req);
    const filters = buildFilters(req.query);

    try {
      const { items, warnings, meta } = await listCampaigns({ tenantId, filters, requestId });
      const payload: {
        success: true;
        items: CampaignDTO[];
        requestId: string;
        warnings?: typeof warnings;
        meta?: typeof meta;
      } = {
        success: true,
        items,
        requestId,
      };

      if (warnings) {
        payload.warnings = warnings;
      }

      if (meta) {
        payload.meta = meta;
      }

      res.json(payload);
    } catch (error) {
      if (handleCampaignError(res, error)) {
        return;
      }

      const translated = errorTranslator.translate(error, {
        requestId,
        includeRequestId: true,
        prisma: {
          connectivity: {
            code: 'CAMPAIGNS_STORE_UNAVAILABLE',
            message: 'Storage de campanhas indisponível no momento.',
            status: 503,
          },
          validation: {
            code: 'INVALID_CAMPAIGN_FILTER',
            message: 'Parâmetros de filtro inválidos.',
            status: 400,
          },
        },
      });

      if (translated) {
        res.status(translated.status).json(translated.payload);
        return;
      }

      throw error;
    }
  }, { scope: 'campaigns:list' })
);

router.post(
  '/',
  createCampaignValidators,
  validateRequest,
  requireTenant,
  withRequestContext(async ({ req, res, requestId }) => {
    const input = buildCreateCampaignInput((req.body ?? {}) as Record<string, unknown>, req);

    try {
      const result = await createCampaign(input);

      const responsePayload: { success: true; data: CampaignDTO; warnings?: typeof result.warnings; meta?: typeof result.meta } = {
        success: true,
        data: result.data,
      };

      if (result.warnings) {
        responsePayload.warnings = result.warnings;
      }

      if (result.meta) {
        responsePayload.meta = result.meta;
      }

      res.status(result.statusCode ?? 201).json(responsePayload);
    } catch (error) {
      if (handleCampaignError(res, error)) {
        return;
      }

      const translated = errorTranslator.translate(error, {
        requestId,
        prisma: {
          connectivity: {
            code: 'CAMPAIGN_STORAGE_UNAVAILABLE',
            message: 'Storage de campanhas indisponível no momento.',
            status: 503,
          },
          validation: {
            code: 'INVALID_CAMPAIGN_DATA',
            message: 'Dados inválidos para criar a campanha.',
            status: 400,
          },
          conflict: {
            code: 'CAMPAIGN_ALREADY_EXISTS',
            message: 'Já existe uma campanha para este acordo e instância.',
            status: 409,
          },
        },
      });

      if (translated) {
        res.status(translated.status).json(translated.payload);
        return;
      }

      throw error;
    }
  }, { scope: 'campaigns:create' })
);

router.patch(
  '/:id',
  updateCampaignValidators,
  validateRequest,
  requireTenant,
  withRequestContext(async ({ req, res, requestId }) => {
    const campaignId = readCampaignIdParam(req);

    if (!campaignId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CAMPAIGN_ID_REQUIRED',
          message: 'Campaign id is required.',
        },
      });
      return;
    }

    const rawInstanceId = req.body?.instanceId;
    const requestedInstanceId: string | null | undefined =
      typeof rawInstanceId === 'string'
        ? rawInstanceId.trim() || null
        : rawInstanceId === null
        ? null
        : undefined;

    try {
      const result = await updateCampaign({
        campaignId,
        actorId: req.user?.id ?? 'system',
        status: normalizeStatus(req.body?.status),
        name: typeof req.body?.name === 'string' ? req.body.name.trim() : undefined,
        instanceId: requestedInstanceId,
      });

      res.json({ success: true, data: result.data });
    } catch (error) {
      if (handleCampaignError(res, error)) {
        return;
      }

      const translated = errorTranslator.translate(error, {
        requestId,
        prisma: {
          connectivity: {
            code: 'CAMPAIGN_STORAGE_UNAVAILABLE',
            message: 'Storage de campanhas indisponível no momento.',
            status: 503,
          },
          validation: {
            code: 'INVALID_CAMPAIGN_DATA',
            message: 'Dados inválidos para atualizar a campanha.',
            status: 400,
          },
        },
      });

      if (translated) {
        res.status(translated.status).json(translated.payload);
        return;
      }

      throw error;
    }
  }, { scope: 'campaigns:update' })
);

router.delete(
  '/:id',
  deleteCampaignValidators,
  validateRequest,
  requireTenant,
  withRequestContext(async ({ req, res, requestId }) => {
    const tenantId = resolveTenantId(req);
    const campaignId = readCampaignIdParam(req);
    if (!campaignId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CAMPAIGN_ID_REQUIRED',
          message: 'Campaign id is required.',
        },
      });
      return;
    }

    try {
      const data = await deleteCampaign({
        campaignId,
        tenantId,
        actorId: req.user?.id ?? 'system',
      });

      res.json({ success: true, data });
    } catch (error) {
      if (handleCampaignError(res, error)) {
        return;
      }

      const translated = errorTranslator.translate(error, {
        requestId,
        prisma: {
          connectivity: {
            code: 'CAMPAIGN_STORAGE_UNAVAILABLE',
            message: 'Storage de campanhas indisponível no momento.',
            status: 503,
          },
        },
      });

      if (translated) {
        res.status(translated.status).json(translated.payload);
        return;
      }

      throw error;
    }
  }, { scope: 'campaigns:delete' })
);

const campaignsRouter: Router = router;

export { campaignsRouter };
