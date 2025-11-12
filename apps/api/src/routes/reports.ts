import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { query } from 'express-validator';
import { Prisma } from '@prisma/client';

import { asyncHandler } from '../middleware/error-handler';
import { validateRequest } from '../middleware/validation';
import { prisma } from '../lib/prisma';
import { logger } from '../config/logger';
import { resolveTenantId } from './campaigns';

const reportsRouter = Router();

type DimensionKey = 'campaign' | 'instance' | 'agreement' | 'product' | 'strategy';

interface MetricAccumulator {
  total: number;
  allocated: number;
  contacted: number;
  won: number;
  lost: number;
  responseTotalMs: number;
  responseCount: number;
}

interface GroupAccumulator {
  key: string;
  label: string;
  dimension: DimensionKey;
  metadata: GroupMetadata;
  metrics: MetricAccumulator;
  breakdown: Map<string, MetricAccumulator>;
}

interface GroupMetadata {
  campaignId: string | null;
  campaignName: string | null;
  instanceId: string | null;
  instanceName: string | null;
  agreementId: string | null;
  agreementName: string | null;
  productType: string | null;
  marginType: string | null;
  marginValue: number | null;
  strategy: string | null;
}

interface MetricsResponseEntry {
  key: string;
  dimension: DimensionKey;
  label: string;
  metrics: MetricSnapshot;
  metadata: GroupMetadata;
  breakdown: BreakdownEntry[];
}

interface MetricSnapshot {
  total: number;
  allocated: number;
  contacted: number;
  won: number;
  lost: number;
  averageResponseSeconds: number | null;
  conversionRate: number;
}

interface BreakdownEntry {
  date: string;
  metrics: MetricSnapshot;
}

type LeadAllocationWithCampaign = Prisma.LeadAllocationGetPayload<{
  select: {
    status: true;
    receivedAt: true;
    updatedAt: true;
    campaignId: true;
    campaign: {
      select: {
        id: true;
        name: true;
        agreementId: true;
        agreementName: true;
        whatsappInstanceId: true;
        productType: true;
        marginType: true;
        strategy: true;
        metadata: true;
        whatsappInstance: {
          select: {
            id: true;
            name: true;
          };
        };
      };
    };
  };
}>;

const DIMENSION_OPTIONS: DimensionKey[] = ['campaign', 'instance', 'agreement', 'product', 'strategy'];

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const createAccumulator = (): MetricAccumulator => ({
  total: 0,
  allocated: 0,
  contacted: 0,
  won: 0,
  lost: 0,
  responseTotalMs: 0,
  responseCount: 0,
});

const finalizeAccumulator = (acc: MetricAccumulator): MetricSnapshot => {
  const averageResponseSeconds = acc.responseCount > 0 ? Math.round(acc.responseTotalMs / acc.responseCount / 1000) : null;
  const conversionRate = acc.total > 0 ? Number((acc.won / acc.total).toFixed(4)) : 0;
  return {
    total: acc.total,
    allocated: acc.allocated,
    contacted: acc.contacted,
    won: acc.won,
    lost: acc.lost,
    averageResponseSeconds,
    conversionRate,
  } satisfies MetricSnapshot;
};

const accumulate = (acc: MetricAccumulator, allocation: LeadAllocationWithCampaign): void => {
  acc.total += 1;

  switch (allocation.status) {
    case 'allocated':
      acc.allocated += 1;
      break;
    case 'contacted':
      acc.contacted += 1;
      break;
    case 'won':
      acc.won += 1;
      break;
    case 'lost':
      acc.lost += 1;
      break;
    default:
      break;
  }

  if (allocation.status !== 'allocated') {
    const diff = allocation.updatedAt.getTime() - allocation.receivedAt.getTime();
    if (Number.isFinite(diff) && diff >= 0) {
      acc.responseTotalMs += diff;
      acc.responseCount += 1;
    }
  }
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveDimension = (
  allocation: LeadAllocationWithCampaign,
  dimension: DimensionKey
): { key: string; label: string; metadata: GroupMetadata } => {
  const campaign = allocation.campaign;
  const metadataRecord =
    campaign?.metadata && typeof campaign.metadata === 'object' && !Array.isArray(campaign.metadata)
      ? (campaign.metadata as Record<string, unknown>)
      : {};
  const resolveMarginValue = (): number | null => {
    const raw = metadataRecord.margin;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw;
    }

    if (typeof raw === 'string') {
      const parsed = Number(raw.replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  };
  const metadata: GroupMetadata = {
    campaignId: normalizeString(campaign?.id) ?? null,
    campaignName: normalizeString(campaign?.name) ?? null,
    agreementId: normalizeString(campaign?.agreementId) ?? null,
    agreementName: normalizeString(campaign?.agreementName) ?? null,
    instanceId: normalizeString(campaign?.whatsappInstanceId) ?? null,
    instanceName: normalizeString(campaign?.whatsappInstance?.name) ?? null,
    productType: normalizeString(campaign?.productType) ?? null,
    marginType: normalizeString(campaign?.marginType) ?? null,
    marginValue: resolveMarginValue(),
    strategy: normalizeString(campaign?.strategy) ?? null,
  };

  if (!campaign) {
    return {
      key: `unknown:${dimension}`,
      label: 'Dados indisponíveis',
      metadata,
    };
  }

  switch (dimension) {
    case 'campaign':
      return {
        key: metadata.campaignId ?? `unknown:${dimension}`,
        label: metadata.campaignName ?? metadata.campaignId ?? 'Campanha sem nome',
        metadata,
      };
    case 'instance': {
      const instanceId = metadata.instanceId ?? `unknown:${dimension}`;
      const label = metadata.instanceName ?? (metadata.instanceId ? `Instância ${metadata.instanceId}` : 'Instância não atribuída');
      return {
        key: instanceId,
        label,
        metadata,
      };
    }
    case 'agreement': {
      const agreementId = metadata.agreementId ?? `unknown:${dimension}`;
      const label = metadata.agreementName ?? metadata.agreementId ?? 'Convênio não informado';
      return {
        key: agreementId,
        label,
        metadata,
      };
    }
    case 'product': {
      const productId = metadata.productType ?? `unknown:${dimension}`;
      const label = metadata.productType ?? 'Produto não informado';
      return {
        key: productId,
        label,
        metadata,
      };
    }
    case 'strategy': {
      const strategyId = metadata.strategy ?? `unknown:${dimension}`;
      const label = metadata.strategy ?? 'Estratégia não informada';
      return {
        key: strategyId,
        label,
        metadata,
      };
    }
    default:
      return {
        key: metadata.campaignId ?? `unknown:${dimension}`,
        label: metadata.campaignName ?? 'Campanha',
        metadata,
      };
  }
};

const parseDateParam = (value: unknown): Date | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return new Date(timestamp);
};

const ensureChronologicalRange = (from: Date, to: Date): { from: Date; to: Date } => {
  if (from.getTime() <= to.getTime()) {
    return { from, to };
  }
  return { from: to, to: from };
};

const buildWhereClause = (
  tenantId: string,
  {
    from,
    to,
    campaignId,
    agreementId,
    instanceId,
    productType,
    strategy,
    marginType,
  }: {
    from: Date;
    to: Date;
    campaignId?: string;
    agreementId?: string;
    instanceId?: string;
    productType?: string;
    strategy?: string;
    marginType?: string;
  }
): Prisma.LeadAllocationWhereInput => {
  const where: Prisma.LeadAllocationWhereInput = {
    tenantId,
    receivedAt: {
      gte: from,
      lte: to,
    },
  };

  if (campaignId) {
    where.campaignId = campaignId;
  }

  const campaignFilters: Prisma.CampaignWhereInput = {};

  if (agreementId) {
    campaignFilters.agreementId = agreementId;
  }

  if (instanceId) {
    campaignFilters.whatsappInstanceId = instanceId;
  }

  if (productType) {
    campaignFilters.productType = productType;
  }

  if (strategy) {
    campaignFilters.strategy = strategy;
  }

  if (marginType) {
    campaignFilters.marginType = marginType;
  }

  if (Object.keys(campaignFilters).length > 0) {
    where.campaign = campaignFilters;
  }

  return where;
};

reportsRouter.get(
  '/metrics',
  query('groupBy').optional().isIn(DIMENSION_OPTIONS),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('campaignId').optional().isString().trim().notEmpty(),
  query('agreementId').optional().isString().trim().notEmpty(),
  query('instanceId').optional().isString().trim().notEmpty(),
  query('productType').optional().isString().trim().notEmpty(),
  query('strategy').optional().isString().trim().notEmpty(),
  query('marginType').optional().isString().trim().notEmpty(),
  validateRequest,
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

    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 6 * DAY_IN_MS);

    const parsedFrom = parseDateParam(req.query.from);
    const parsedTo = parseDateParam(req.query.to);

    const { from, to } = ensureChronologicalRange(parsedFrom ?? defaultFrom, parsedTo ?? now);

    const groupBy = (req.query.groupBy as DimensionKey | undefined) ?? 'agreement';
    const limitParam = req.query.limit ? Number.parseInt(String(req.query.limit), 10) : undefined;
    const limit = Number.isFinite(limitParam) ? (limitParam as number) : 10;

    const campaignId = normalizeString(req.query.campaignId);
    const agreementId = normalizeString(req.query.agreementId);
    const instanceId = normalizeString(req.query.instanceId);
    const productType = normalizeString(req.query.productType);
    const strategy = normalizeString(req.query.strategy);
    const marginType = normalizeString(req.query.marginType);

    const where = buildWhereClause(tenantId, {
      from,
      to,
      campaignId: campaignId ?? undefined,
      agreementId: agreementId ?? undefined,
      instanceId: instanceId ?? undefined,
      productType: productType ?? undefined,
      strategy: strategy ?? undefined,
      marginType: marginType ?? undefined,
    });

    logger.info('[Reports] metrics request received', {
      requestId,
      tenantId,
      groupBy,
      from: from.toISOString(),
      to: to.toISOString(),
      campaignId: campaignId ?? null,
      agreementId: agreementId ?? null,
      instanceId: instanceId ?? null,
      productType: productType ?? null,
      strategy: strategy ?? null,
      marginType: marginType ?? null,
    });

    try {
      const allocations = await prisma.leadAllocation.findMany({
        where,
        select: {
          status: true,
          receivedAt: true,
          updatedAt: true,
          campaignId: true,
          campaign: {
            select: {
              id: true,
              name: true,
              agreementId: true,
              agreementName: true,
              whatsappInstanceId: true,
              productType: true,
              marginType: true,
              strategy: true,
              whatsappInstance: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          receivedAt: 'asc',
        },
      });

      const groups = new Map<string, GroupAccumulator>();
      const overall = createAccumulator();

      allocations.forEach((allocation) => {
        const dimensionInfo = resolveDimension(allocation as LeadAllocationWithCampaign, groupBy);
        const key = `${groupBy}:${dimensionInfo.key}`;
        let group = groups.get(key);
        if (!group) {
          group = {
            key,
            label: dimensionInfo.label,
            dimension: groupBy,
            metadata: dimensionInfo.metadata,
            metrics: createAccumulator(),
            breakdown: new Map<string, MetricAccumulator>(),
          } satisfies GroupAccumulator;
          groups.set(key, group);
        }

        accumulate(group.metrics, allocation as LeadAllocationWithCampaign);
        accumulate(overall, allocation as LeadAllocationWithCampaign);

        const dateKey = allocation.receivedAt.toISOString().slice(0, 10);
        let dayMetrics = group.breakdown.get(dateKey);
        if (!dayMetrics) {
          dayMetrics = createAccumulator();
          group.breakdown.set(dateKey, dayMetrics);
        }
        accumulate(dayMetrics, allocation as LeadAllocationWithCampaign);
      });

      const totalGroups = groups.size;

      const sortedGroups = Array.from(groups.values()).sort((a, b) => {
        if (b.metrics.total === a.metrics.total) {
          return a.label.localeCompare(b.label);
        }
        return b.metrics.total - a.metrics.total;
      });

      const limitedGroups = sortedGroups.slice(0, limit).map<MetricsResponseEntry>((group) => ({
        key: group.key,
        dimension: group.dimension,
        label: group.label,
        metadata: group.metadata,
        metrics: finalizeAccumulator(group.metrics),
        breakdown: Array.from(group.breakdown.entries())
          .sort(([dateA], [dateB]) => (dateA < dateB ? -1 : dateA > dateB ? 1 : 0))
          .map(([date, metrics]) => ({
            date,
            metrics: finalizeAccumulator(metrics),
          })),
      }));

      res.json({
        success: true,
        requestId,
        data: {
          groupBy,
          period: {
            from: from.toISOString(),
            to: to.toISOString(),
          },
          summary: finalizeAccumulator(overall),
          groups: limitedGroups,
          totalGroups,
        },
      });
    } catch (error) {
      logger.error('[Reports] failed to compute metrics', {
        requestId,
        tenantId,
        error,
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'REPORTS_METRICS_FAILED',
          message: 'Falha ao recuperar métricas de relatórios.',
        },
        requestId,
      });
    }
  })
);

export { reportsRouter };
