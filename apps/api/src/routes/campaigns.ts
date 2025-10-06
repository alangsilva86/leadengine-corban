import crypto from 'node:crypto';
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
import { getMvpBypassTenantId, getUseRealDataFlag } from '../config/feature-flags';
import type { CampaignDTO, CampaignWarning } from './campaigns.types';
import { fetchLeadEngineCampaigns } from '../services/campaigns-upstream';
import { mapPrismaError } from '../utils/prisma-error';

type CampaignMetadata = Record<string, unknown> | null | undefined;

const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'ended'] as const;

type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

const DEFAULT_STATUS: CampaignStatus = 'active';
const LOG_CONTEXT = '[/api/campaigns]';

type RawCampaignMetrics = ReturnType<typeof getCampaignMetrics>;

const createEmptyRawMetrics = (): RawCampaignMetrics =>
  ({
    total: 0,
    allocated: 0,
    contacted: 0,
    won: 0,
    lost: 0,
    averageResponseSeconds: 0,
  } as RawCampaignMetrics);

const toSafeError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    message: String(error),
  };
};

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

const buildCampaignBase = (campaign: CampaignWithInstance): Omit<CampaignDTO, 'metrics'> => {
  const metadata = readMetadata(campaign.metadata as CampaignMetadata);
  const { whatsappInstance, ...campaignData } = campaign;
  const instanceId = campaign.whatsappInstanceId ?? whatsappInstance?.id ?? null;
  const instanceName = whatsappInstance?.name ?? null;

  return {
    ...campaignData,
    agreementId: campaignData.agreementId ?? null,
    instanceId,
    instanceName,
    metadata,
  } as Omit<CampaignDTO, 'metrics'>;
};

const computeCampaignMetrics = (
  campaign: CampaignWithInstance,
  metadata: Record<string, unknown>,
  rawMetrics: RawCampaignMetrics
): CampaignDTO['metrics'] => {
  const budget = readNumeric(metadata, 'budget');
  const cplTarget = readNumeric(metadata, 'cplTarget');
  const cpl = budget !== null && rawMetrics.total > 0 ? toFixedNumber(budget / rawMetrics.total) : null;

  return {
    ...rawMetrics,
    budget,
    cplTarget,
    cpl,
  } as CampaignDTO['metrics'];
};

const buildCampaignResponse = (
  campaign: CampaignWithInstance,
  rawMetrics?: RawCampaignMetrics
): CampaignDTO => {
  const base = buildCampaignBase(campaign);
  const metricsSource = rawMetrics ?? getCampaignMetrics(campaign.tenantId, campaign.id);
  const metrics = computeCampaignMetrics(campaign, base.metadata, metricsSource);

  return {
    ...base,
    metrics,
  } satisfies CampaignDTO;
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

const normalizeQueryValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    for (const candidate of value) {
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }
  }

  return undefined;
};

const extractStatuses = (value: unknown): CampaignStatus[] => {
  if (value === undefined) {
    return [];
  }

  const rawValues: string[] = [];

  if (typeof value === 'string') {
    rawValues.push(...value.split(','));
  } else if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (typeof entry === 'string') {
        rawValues.push(...entry.split(','));
      }
    });
  }

  const normalized = rawValues
    .map((status) => normalizeStatus(status))
    .filter((status): status is CampaignStatus => Boolean(status));

  return Array.from(new Set(normalized));
};

export interface CampaignQueryFilters {
  agreementId?: string;
  instanceId?: string;
  statuses: CampaignStatus[];
}

export const buildFilters = (query: Request['query']): CampaignQueryFilters => {
  const agreementId = normalizeQueryValue(query.agreementId);
  const instanceId = normalizeQueryValue(query.instanceId);
  const statuses = extractStatuses(query.status);
  return {
    agreementId,
    instanceId,
    statuses: statuses.length > 0 ? statuses : [DEFAULT_STATUS],
  } satisfies CampaignQueryFilters;
};

export const resolveTenantId = (req: Request): string | undefined => {
  const queryTenant = normalizeQueryValue(req.query.tenantId);
  if (queryTenant) {
    return queryTenant;
  }

  const headerTenant = req.header('x-tenant-id');
  if (headerTenant && headerTenant.trim().length > 0) {
    return headerTenant.trim();
  }

  const userTenant = req.user?.tenantId?.trim();
  if (userTenant) {
    return userTenant;
  }

  return getMvpBypassTenantId();
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
    const requestedTenantId = req.user?.tenantId;
    const { agreementId, agreementName, instanceId } = req.body as {
      agreementId: string;
      agreementName: string;
      instanceId: string;
      name?: string;
    };
    const providedName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const budget = typeof req.body?.budget === 'number' ? req.body.budget : undefined;
    const cplTarget = typeof req.body?.cplTarget === 'number' ? req.body.cplTarget : undefined;

    const fallbackTenantId = requestedTenantId ?? 'demo-tenant';

    const ensuredTenant = await prisma.tenant.upsert({
      where: { id: fallbackTenantId },
      update: {},
      create: {
        id: fallbackTenantId,
        name: fallbackTenantId,
        slug: toSlug(fallbackTenantId, fallbackTenantId),
        settings: {},
      },
    });

    let instance = await prisma.whatsAppInstance.findUnique({ where: { id: instanceId } });

    if (!instance) {
      logger.warn('WhatsApp instance not found. Creating placeholder for testing purposes.', {
        instanceId,
        tenantId: ensuredTenant.id,
      });

      instance = await prisma.whatsAppInstance.create({
        data: {
          id: instanceId,
          tenantId: ensuredTenant.id,
          name: instanceId,
          brokerId: instanceId,
          status: 'connected',
          connected: true,
          metadata: {
            origin: 'auto-created-for-campaign',
          },
        },
      });
    }

    const tenantId = instance.tenantId ?? ensuredTenant.id;

    if (requestedTenantId && requestedTenantId !== tenantId) {
      logger.warn('Campaign creation using tenant fallback', {
        requestedTenantId,
        effectiveTenantId: tenantId,
        instanceTenantId: instance.tenantId,
      });
    }

    const actorId = req.user?.id ?? 'system';
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

    const buildCreationMetadata = (
      extraEntries: ReturnType<typeof buildCampaignHistoryEntry>[] = []
    ): Prisma.JsonObject => {
      const entries = [
        buildCampaignHistoryEntry('created', actorId, {
          status: requestedStatus,
          instanceId: instance.id,
        }),
        ...extraEntries,
      ];

      let metadata: CampaignMetadata = metadataBase;
      for (const entry of entries) {
        metadata = appendCampaignHistory(metadata, entry);
      }

      return metadata as Prisma.JsonObject;
    };

    const existingCampaign = await prisma.campaign.findFirst({
      where: {
        tenantId,
        whatsappInstanceId: instance.id,
        agreementId: agreementId.trim(),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        whatsappInstance: {
          select: { id: true, name: true },
        },
      },
    });

    let creationExtras: ReturnType<typeof buildCampaignHistoryEntry>[] | null = null;

    if (existingCampaign) {
      const currentStatus = normalizeStatus(existingCampaign.status) ?? 'draft';

      if (currentStatus === 'ended') {
        creationExtras = [
          buildCampaignHistoryEntry('reactivated', actorId, {
            previousCampaignId: existingCampaign.id,
            from: currentStatus,
            to: requestedStatus,
          }),
        ];
      } else if (currentStatus !== requestedStatus) {
        if (!canTransition(currentStatus, requestedStatus)) {
          res.status(409).json({
            success: false,
            error: {
              code: 'INVALID_CAMPAIGN_TRANSITION',
              message: `Transição de ${currentStatus} para ${requestedStatus} não permitida.`,
            },
          });
          return;
        }

        let metadata: CampaignMetadata = existingCampaign.metadata as CampaignMetadata;
        metadata = appendCampaignHistory(
          metadata,
          buildCampaignHistoryEntry('status-changed', actorId, {
            from: currentStatus,
            to: requestedStatus,
          })
        );

        if (requestedStatus === 'ended') {
          metadata = appendCampaignHistory(
            metadata,
            buildCampaignHistoryEntry('status-ended', actorId, {
              from: currentStatus,
            })
          );
        }

        if (requestedStatus === 'active' && currentStatus !== 'active') {
          metadata = appendCampaignHistory(
            metadata,
            buildCampaignHistoryEntry('reactivated', actorId, {
              from: currentStatus,
              to: requestedStatus,
            })
          );
        }

        const updatedCampaign = await prisma.campaign.update({
          where: { id: existingCampaign.id },
          data: {
            status: requestedStatus,
            metadata,
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

        logger.info('Campaign status updated via POST /campaigns', {
          tenantId,
          agreementId,
          instanceId: instance.id,
          campaignId: existingCampaign.id,
          fromStatus: currentStatus,
          toStatus: requestedStatus,
        });

        res.json({ success: true, data: buildCampaignResponse(updatedCampaign) });
        return;
      } else {
        logger.info('Campaign reused for instance', {
          tenantId,
          agreementId,
          instanceId: instance.id,
          campaignId: existingCampaign.id,
          status: existingCampaign.status,
          requestedStatus,
        });

        res.json({ success: true, data: buildCampaignResponse(existingCampaign) });
        return;
      }
    }

    const creationMetadata = buildCreationMetadata(creationExtras ?? []);

    let campaign;
    try {
      campaign = await prisma.campaign.create({
        data: {
          tenantId,
          name: normalizedName,
          agreementId: agreementId.trim(),
          agreementName: agreementName.trim(),
          whatsappInstanceId: instance.id,
          status: requestedStatus,
          metadata: creationMetadata,
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
    } catch (error) {
      logger.error('Failed to create campaign, returning fallback', {
        error,
        tenantId,
        agreementId,
        instanceId: instance.id,
      });

      const fallback = await prisma.campaign.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        include: {
          whatsappInstance: {
            select: { id: true, name: true },
          },
        },
      });

      if (fallback) {
        res.json({ success: true, data: buildCampaignResponse(fallback) });
        return;
      }

      throw error;
    }

    logger.info(creationExtras ? 'Campaign recreated after ended' : 'Campaign created', {
      tenantId,
      campaignId: campaign.id,
      instanceId,
      status: campaign.status,
      previousCampaignId: creationExtras ? existingCampaign?.id ?? null : null,
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
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? crypto.randomUUID();
    const tenantId = resolveTenantId(req);

    if (!tenantId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'TENANT_REQUIRED',
          message: 'tenantId é obrigatório.',
        },
        requestId,
      });
      return;
    }

    const useRealData = getUseRealDataFlag();
    const { agreementId, instanceId, statuses } = buildFilters(req.query);
    const logContext = {
      requestId,
      tenantId,
      agreementId: agreementId ?? null,
      instanceId: instanceId ?? null,
      status: statuses,
    };

    try {
      if (useRealData) {
        try {
          const items = await fetchLeadEngineCampaigns({
            tenantId,
            agreementId,
            status: statuses[0],
            requestId,
          });

          res.json({ success: true, items, requestId });
          return;
        } catch (upstreamError) {
          const upstreamStatus = (upstreamError as { status?: number }).status;

          if (upstreamStatus === 404) {
            logger.info(`${LOG_CONTEXT} upstream retornou 404 (sem campanhas)`, logContext);
            res.json({ success: true, items: [], requestId });
            return;
          }

          if (typeof upstreamStatus === 'number' && upstreamStatus >= 500) {
            logger.error(`${LOG_CONTEXT} upstream failure`, {
              ...logContext,
              upstreamStatus,
              error: toSafeError(upstreamError),
            });
            res.status(502).json({
              success: false,
              error: {
                code: 'UPSTREAM_FAILURE',
                message: 'Lead Engine indisponível ao listar campanhas.',
              },
              requestId,
            });
            return;
          }

          logger.error(`${LOG_CONTEXT} erro inesperado ao consultar upstream`, {
            ...logContext,
            error: toSafeError(upstreamError),
          });
          res.status(500).json({
            success: false,
            error: {
              code: 'UNEXPECTED_CAMPAIGNS_ERROR',
              message: 'Falha inesperada ao listar campanhas.',
            },
            requestId,
          });
          return;
        }
      }

      const campaigns = await prisma.campaign.findMany({
        where: {
          tenantId,
          ...(agreementId ? { agreementId } : {}),
          ...(instanceId ? { whatsappInstanceId: instanceId } : {}),
          status: { in: statuses },
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
        take: 100,
      });

      let items: CampaignDTO[];
      let warnings: CampaignWarning[] | undefined;

      try {
        items = campaigns.map((campaign) => buildCampaignResponse(campaign));
      } catch (metricsError) {
        logger.warn(`${LOG_CONTEXT} enrich metrics failed`, {
          ...logContext,
          error: toSafeError(metricsError),
        });
        warnings = [{ code: 'CAMPAIGN_METRICS_UNAVAILABLE' }];
        items = campaigns.map((campaign) => buildCampaignResponse(campaign, createEmptyRawMetrics()));
      }

      const payload: {
        success: true;
        items: CampaignDTO[];
        requestId: string;
        warnings?: CampaignWarning[];
      } = {
        success: true,
        items,
        requestId,
      };

      if (warnings) {
        payload.warnings = warnings;
      }

      res.json(payload);
    } catch (error) {
      const mapped = mapPrismaError(error, {
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
      });

      if (mapped) {
        const log = mapped.type === 'validation' ? logger.warn.bind(logger) : logger.error.bind(logger);
        log(`${LOG_CONTEXT} prisma error`, {
          ...logContext,
          error: toSafeError(error),
          mappedError: mapped,
        });

        res.status(mapped.status).json({
          success: false,
          error: {
            code: mapped.code,
            message: mapped.message,
          },
          requestId,
        });
        return;
      }

      logger.error(`${LOG_CONTEXT} unexpected failure`, {
        ...logContext,
        error: toSafeError(error),
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'UNEXPECTED_CAMPAIGNS_ERROR',
          message: 'Falha inesperada ao listar campanhas.',
        },
        requestId,
      });
    }
  })
);

router.patch(
  '/:id',
  param('id').isString().trim().isLength({ min: 1 }),
  body('name').optional().isString().trim().isLength({ min: 1 }),
  body('status').optional().isString().trim().isLength({ min: 1 }),
  body('instanceId').optional().isString().trim().isLength({ min: 1 }),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const campaignId = req.params.id;
    const rawStatus = normalizeStatus(req.body?.status);
    const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined;
    const requestedInstanceId =
      typeof req.body?.instanceId === 'string' ? req.body.instanceId.trim() : undefined;
    const actorId = req.user?.id ?? 'system';

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
    let metadataAccumulator: CampaignMetadata = readMetadata(campaign.metadata as CampaignMetadata);
    let metadataDirty = false;

    const updateMetadata = (mutator: (current: Record<string, unknown>) => void) => {
      const base =
        metadataAccumulator && typeof metadataAccumulator === 'object' && !Array.isArray(metadataAccumulator)
          ? { ...(metadataAccumulator as Record<string, unknown>) }
          : {};
      mutator(base);
      metadataAccumulator = base;
      metadataDirty = true;
    };

    const appendHistoryEntry = (entry: ReturnType<typeof buildCampaignHistoryEntry>) => {
      metadataAccumulator = appendCampaignHistory(metadataAccumulator, entry);
      metadataDirty = true;
    };

    if (rawStatus && rawStatus !== currentStatus) {
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
      appendHistoryEntry(
        buildCampaignHistoryEntry('status-changed', actorId, {
          from: currentStatus,
          to: rawStatus,
        })
      );

      if (rawStatus === 'ended') {
        appendHistoryEntry(
          buildCampaignHistoryEntry('status-ended', actorId, {
            endedAt: new Date().toISOString(),
          })
        );
      }
    }

    if (requestedInstanceId && requestedInstanceId !== campaign.whatsappInstanceId) {
      const nextInstance = await prisma.whatsAppInstance.findFirst({
        where: {
          id: requestedInstanceId,
          tenantId,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!nextInstance) {
        res.status(404).json({
          success: false,
          error: {
            code: 'INSTANCE_NOT_FOUND',
            message: 'Instância WhatsApp não encontrada para este tenant.',
          },
        });
        return;
      }

      updates.whatsappInstanceId = nextInstance.id;
      updateMetadata((base) => {
        base.reassignedAt = new Date().toISOString();
        base.previousInstanceId = campaign.whatsappInstanceId ?? null;
      });
      appendHistoryEntry(
        buildCampaignHistoryEntry('instance-reassigned', actorId, {
          from: campaign.whatsappInstanceId ?? null,
          to: nextInstance.id,
        })
      );
    }

    if (metadataDirty) {
      updates.metadata = metadataAccumulator as Prisma.JsonObject;
    }

    if (!updates.status && !updates.metadata && !updates.whatsappInstanceId) {
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
      instanceId: updated.whatsappInstanceId,
      statusChanged: Boolean(updates.status && rawStatus !== currentStatus),
      instanceReassigned: Boolean(updates.whatsappInstanceId),
    });

    res.json({
      success: true,
      data: buildCampaignResponse(updated),
    });
  })
);

router.delete(
  '/:id',
  param('id').isString().trim().isLength({ min: 1 }),
  validateRequest,
  requireTenant,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const campaignId = req.params.id;
    const actorId = req.user?.id ?? 'system';

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

    const currentStatus = normalizeStatus(campaign.status) ?? 'draft';
    const timestamp = new Date().toISOString();
    let metadataAccumulator: CampaignMetadata = readMetadata(campaign.metadata as CampaignMetadata);

    const updateMetadata = (mutator: (current: Record<string, unknown>) => void) => {
      const base =
        metadataAccumulator && typeof metadataAccumulator === 'object' && !Array.isArray(metadataAccumulator)
          ? { ...(metadataAccumulator as Record<string, unknown>) }
          : {};
      mutator(base);
      metadataAccumulator = base;
    };

    const appendHistoryEntry = (entry: ReturnType<typeof buildCampaignHistoryEntry>) => {
      metadataAccumulator = appendCampaignHistory(metadataAccumulator, entry);
    };

    updateMetadata((base) => {
      base.deletedAt = timestamp;
      base.deletedBy = actorId;
    });

    if (currentStatus !== 'ended') {
      appendHistoryEntry(
        buildCampaignHistoryEntry('status-changed', actorId, {
          from: currentStatus,
          to: 'ended',
        })
      );
      appendHistoryEntry(
        buildCampaignHistoryEntry('status-ended', actorId, {
          endedAt: timestamp,
        })
      );
    }

    appendHistoryEntry(
      buildCampaignHistoryEntry('deleted', actorId, {
        previousStatus: currentStatus,
      })
    );

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: 'ended',
        metadata: metadataAccumulator as Prisma.JsonObject,
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

    logger.info('Campaign soft-deleted', {
      tenantId,
      campaignId: campaign.id,
      previousStatus: currentStatus,
    });

    res.json({
      success: true,
      data: buildCampaignResponse(updated),
    });
  })
);

const campaignsRouter: Router = router;

export { campaignsRouter };
