import { Prisma } from '@prisma/client';

import { logger } from '../config/logger';
import { prisma } from '../lib/prisma';
import { toSlug } from '../lib/slug';
import { getCampaignMetrics } from '@ticketz/storage';
import { getUseRealDataFlag } from '../config/feature-flags';
import type { CampaignDTO, CampaignWarning } from '../routes/campaigns.types';
import { fetchLeadEngineCampaigns, type LeadEngineCampaignFilters } from './campaigns-upstream';
import {
  type CampaignQueryFilters,
  type CampaignStatus,
  DEFAULT_STATUS,
  normalizeClassificationValue,
  normalizeStatus,
  isRecord,
  readNumericField,
} from '../routes/campaigns.validators';

const LOG_CONTEXT = '[/api/campaigns]';

const createEmptyRawMetrics = () =>
  ({
    total: 0,
    allocated: 0,
    contacted: 0,
    won: 0,
    lost: 0,
    averageResponseSeconds: 0,
  }) satisfies Awaited<ReturnType<typeof getCampaignMetrics>>;

export class CampaignServiceError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'CampaignServiceError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

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

type CampaignMetadata = Record<string, unknown> | null | undefined;

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

type RawCampaignMetrics = Awaited<ReturnType<typeof getCampaignMetrics>>;

const readMetadata = (metadata: CampaignMetadata): Record<string, unknown> => {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return { ...(metadata as Record<string, unknown>) };
  }
  return {};
};

const toFixedNumber = (input: number | null, fractionDigits = 2): number | null => {
  if (input === null) {
    return null;
  }
  return Number(input.toFixed(fractionDigits));
};

const normalizeTenantSlug = (value: string | null | undefined): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const slug = toSlug(value, '');
  return slug.length > 0 ? slug : undefined;
};

const buildCampaignHistoryEntry = (action: string, actorId: string, details?: Record<string, unknown>) => ({
  action,
  by: actorId,
  at: new Date().toISOString(),
  ...(details ?? {}),
});

const appendCampaignHistory = (
  metadata: CampaignMetadata,
  entry: ReturnType<typeof buildCampaignHistoryEntry>
): Prisma.JsonObject => {
  const base: Record<string, unknown> = metadata && typeof metadata === 'object' ? { ...(metadata as Record<string, unknown>) } : {};
  const history = Array.isArray(base.history) ? [...(base.history as unknown[])] : [];
  history.push(entry);
  base.history = history.slice(-50);
  return base as Prisma.JsonObject;
};

const buildCampaignBase = (campaign: CampaignWithInstance): Omit<CampaignDTO, 'metrics'> => {
  const metadata = readMetadata(campaign.metadata as CampaignMetadata);
  const { whatsappInstance, tags, productType, marginType, strategy, ...campaignData } = campaign;
  const instanceId = campaign.whatsappInstanceId ?? whatsappInstance?.id ?? null;
  const instanceName = whatsappInstance?.name ?? null;
  const normalizedTags = Array.isArray(tags)
    ? Array.from(
        new Set(
          tags
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
        )
      )
    : [];
  const marginValue = readNumericField(metadata, 'margin');

  return {
    ...campaignData,
    agreementId: campaignData.agreementId ?? null,
    agreementName: campaignData.agreementName ?? null,
    instanceId,
    instanceName,
    metadata,
    productType: normalizeClassificationValue(productType),
    marginType: normalizeClassificationValue(marginType),
    marginValue,
    strategy: normalizeClassificationValue(strategy),
    tags: normalizedTags,
  } as Omit<CampaignDTO, 'metrics'>;
};

const computeCampaignMetrics = (
  campaign: CampaignWithInstance,
  metadata: Record<string, unknown>,
  rawMetrics: RawCampaignMetrics
): CampaignDTO['metrics'] => {
  const budget = readNumericField(metadata, 'budget');
  const cplTarget = readNumericField(metadata, 'cplTarget');
  const cpl = budget !== null && rawMetrics.total > 0 ? toFixedNumber(budget / rawMetrics.total) : null;

  return {
    ...rawMetrics,
    budget,
    cplTarget,
    cpl,
  } as CampaignDTO['metrics'];
};

const buildCampaignResponses = async (
  campaigns: CampaignWithInstance[],
  { metricsFallback }: { metricsFallback?: RawCampaignMetrics } = {}
): Promise<{ items: CampaignDTO[]; warnings?: CampaignWarning[]; metricsError?: unknown }> => {
  try {
    const items = await Promise.all(campaigns.map((campaign) => buildCampaignResponse(campaign)));
    return { items };
  } catch (metricsError) {
    const fallbackMetrics = metricsFallback ?? createEmptyRawMetrics();
    const items = await Promise.all(
      campaigns.map((campaign) => buildCampaignResponse(campaign, fallbackMetrics))
    );

    return { items, warnings: [{ code: 'CAMPAIGN_METRICS_UNAVAILABLE' }], metricsError };
  }
};

const buildCampaignResponse = async (
  campaign: CampaignWithInstance,
  rawMetrics?: RawCampaignMetrics
): Promise<CampaignDTO> => {
  const base = buildCampaignBase(campaign);
  const metricsSource =
    rawMetrics ?? (campaign.tenantId ? await getCampaignMetrics(campaign.tenantId, campaign.id) : createEmptyRawMetrics());
  const metrics = computeCampaignMetrics(campaign, base.metadata, metricsSource);

  return {
    ...base,
    metrics,
  } satisfies CampaignDTO;
};

const buildCampaignResponseSafely = async (
  campaign: CampaignWithInstance,
  logContext: Record<string, unknown>
): Promise<{ data: CampaignDTO; warnings?: CampaignWarning[] }> => {
  const { items, warnings, metricsError } = await buildCampaignResponses([campaign], {
    metricsFallback: createEmptyRawMetrics(),
  });

  if (metricsError) {
    logger.warn(`${LOG_CONTEXT} enrich metrics failed`, {
      ...logContext,
      error: toSafeError(metricsError),
    });
  }

  return { data: items[0], ...(warnings ? { warnings } : {}) };
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

type StoreCampaignResult = {
  items: CampaignDTO[];
  warnings?: CampaignWarning[];
};

const loadCampaignsFromStore = async ({
  tenantId,
  agreementId,
  instanceId,
  productType,
  marginType,
  strategy,
  tags,
  statuses,
  requestId,
}: {
  tenantId: string;
  agreementId?: string;
  instanceId?: string;
  productType?: string | null;
  marginType?: string | null;
  strategy?: string | null;
  tags: string[];
  statuses: CampaignStatus[];
  requestId: string;
}): Promise<StoreCampaignResult> => {
  const logContext = {
    requestId,
    tenantId,
    agreementId: agreementId ?? null,
    instanceId: instanceId ?? null,
    productType: productType ?? null,
    marginType: marginType ?? null,
    strategy: strategy ?? null,
    tags: tags.join(','),
    statuses,
  };

  logger.info(`${LOG_CONTEXT} querying local store`, logContext);

  const campaigns = await prisma.campaign.findMany({
    where: {
      tenantId,
      ...(agreementId ? { agreementId } : {}),
      ...(instanceId ? { whatsappInstanceId: instanceId } : {}),
      status: { in: statuses },
      ...(productType !== undefined && productType !== null ? { productType } : {}),
      ...(marginType !== undefined && marginType !== null ? { marginType } : {}),
      ...(strategy !== undefined && strategy !== null ? { strategy } : {}),
      ...(tags.length > 0 ? { tags: { hasEvery: tags } } : {}),
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

  const { items, warnings, metricsError } = await buildCampaignResponses(campaigns, {
    metricsFallback: createEmptyRawMetrics(),
  });

  if (metricsError) {
    logger.warn(`${LOG_CONTEXT} metrics enrichment failed, using empty metrics`, {
      ...logContext,
      error: toSafeError(metricsError),
    });
  }

  logger.info(
    warnings
      ? `${LOG_CONTEXT} returning campaigns from store with fallback metrics`
      : `${LOG_CONTEXT} returning campaigns from store`,
    {
      ...logContext,
      count: items.length,
    }
  );

  return { items, ...(warnings ? { warnings } : {}) };
};

export interface ListCampaignsOptions {
  tenantId: string;
  filters: CampaignQueryFilters;
  requestId: string;
}

export interface ListCampaignsResult {
  items: CampaignDTO[];
  warnings?: CampaignWarning[];
  meta?: Record<string, unknown>;
}

export const listCampaigns = async ({
  tenantId,
  filters,
  requestId,
}: ListCampaignsOptions): Promise<ListCampaignsResult> => {
  const { agreementId, instanceId, productType, marginType, strategy, tags, statuses } = filters;
  const logContext = {
    requestId,
    tenantId,
    agreementId: agreementId ?? null,
    instanceId: instanceId ?? null,
    productType: productType ?? null,
    marginType: marginType ?? null,
    strategy: strategy ?? null,
    tags: tags.join(','),
    status: statuses,
  };

  logger.info(`${LOG_CONTEXT} list request received`, logContext);

  let upstreamFailed = false;

  if (getUseRealDataFlag()) {
    logger.info(`${LOG_CONTEXT} attempting upstream sync`, {
      ...logContext,
      targetStatus: statuses.join(','),
    });

    try {
      const upstreamFilters: LeadEngineCampaignFilters = {
        tenantId,
        status: statuses.join(','),
        requestId,
      };

      if (agreementId) {
        upstreamFilters.agreementId = agreementId;
      }

      if (productType) {
        upstreamFilters.productType = productType;
      }

      if (marginType) {
        upstreamFilters.marginType = marginType;
      }

      if (strategy) {
        upstreamFilters.strategy = strategy;
      }

      if (tags.length > 0) {
        upstreamFilters.tags = tags.join(',');
      }

      const items = await fetchLeadEngineCampaigns(upstreamFilters);

      logger.info(`${LOG_CONTEXT} upstream responded successfully`, {
        ...logContext,
        source: 'upstream',
        count: items.length,
      });

      return { items, meta: { source: 'upstream', upstreamFallback: false } };
    } catch (upstreamError) {
      upstreamFailed = true;
      const upstreamStatus = (upstreamError as { status?: number }).status;

      if (upstreamStatus === 404) {
        logger.info(`${LOG_CONTEXT} upstream retornou 404 (sem campanhas)`, logContext);
        return { items: [], meta: { source: 'upstream', upstreamFallback: false } };
      }

      if (typeof upstreamStatus === 'number' && upstreamStatus >= 500) {
        logger.error(`${LOG_CONTEXT} upstream failure`, {
          ...logContext,
          upstreamStatus,
          error: toSafeError(upstreamError),
        });
      } else {
        logger.error(`${LOG_CONTEXT} erro inesperado ao consultar upstream`, {
          ...logContext,
          error: toSafeError(upstreamError),
        });
      }

      logger.warn(`${LOG_CONTEXT} falling back to local store after upstream error`, {
        ...logContext,
        upstreamStatus: upstreamStatus ?? null,
      });
    }
  }

  const storeFilters: Parameters<typeof loadCampaignsFromStore>[0] = {
    tenantId,
    productType: productType ?? null,
    marginType: marginType ?? null,
    strategy: strategy ?? null,
    tags,
    statuses: statuses.length > 0 ? statuses : [DEFAULT_STATUS],
    requestId,
  };

  if (agreementId) {
    storeFilters.agreementId = agreementId;
  }

  if (instanceId) {
    storeFilters.instanceId = instanceId;
  }

  const { items, warnings } = await loadCampaignsFromStore(storeFilters);

  const result: ListCampaignsResult = {
    items,
    ...(warnings ? { warnings } : {}),
    meta: {
      source: upstreamFailed ? 'store-fallback' : 'store',
      upstreamFallback: upstreamFailed,
    },
  };

  return result;
};

export interface CreateCampaignInput {
  requestedTenantId: string;
  explicitTenantId?: string;
  agreementId: string;
  agreementName: string | null;
  instanceId: string;
  brokerId: string | null;
  name: string;
  budget?: number;
  cplTarget?: number;
  schedule?: unknown;
  channel: string;
  audienceCount: number;
  productType: string;
  marginType: string | null;
  marginValue: number | null;
  strategy: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  actorId: string;
  status?: CampaignStatus | null;
}

export interface CreateCampaignResult {
  data: CampaignDTO;
  warnings?: CampaignWarning[];
  meta?: Record<string, unknown>;
  statusCode?: number;
}

const ensureName = (value: string | null, fallback: string): string => {
  if (value && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
};

const getSafeMode = (): boolean => process.env.SAFE_MODE === 'true';

export const createCampaign = async (input: CreateCampaignInput): Promise<CreateCampaignResult> => {
  const requestedTenantId = input.requestedTenantId;
  const rawAgreementId = typeof input.agreementId === 'string' ? input.agreementId.trim() : '';
  const resolvedAgreementId = rawAgreementId || requestedTenantId;
  const rawAgreementName = normalizeClassificationValue(input.agreementName);
  const resolvedAgreementName = rawAgreementName ?? null;
  const rawInstanceId = typeof input.instanceId === 'string' ? input.instanceId.trim() : '';
  const resolvedInstanceId = rawInstanceId || 'alan';
  const rawBrokerIdInput = typeof input.brokerId === 'string' ? input.brokerId.trim() : '';
  const resolvedBrokerId = rawBrokerIdInput || null;
  const identifierCandidates = Array.from(
    new Set(
      [resolvedInstanceId, resolvedBrokerId].filter((value): value is string => typeof value === 'string' && value.length > 0)
    )
  );
  const providedName = typeof input.name === 'string' ? input.name.trim() : '';
  const resolvedName = ensureName(providedName, resolvedAgreementName || `Campanha ${Date.now()}`);
  const budget = typeof input.budget === 'number' ? input.budget : undefined;
  const cplTarget = typeof input.cplTarget === 'number' ? input.cplTarget : undefined;
  const schedule = input.schedule ?? { type: 'immediate' };
  const channel = typeof input.channel === 'string' && input.channel.length > 0 ? input.channel : 'whatsapp';
  const audienceCount = input.audienceCount;
  const productType = input.productType || 'generic';
  const marginType = input.marginType ?? 'percentage';
  const marginValue = input.marginValue;
  const strategy = input.strategy;
  const resolvedTags = Array.from(new Set(input.tags));
  const userMetadata = isRecord(input.metadata)
    ? ({ ...(input.metadata as Record<string, unknown>) } as Record<string, unknown>)
    : {};

  if (marginValue !== null && marginValue !== undefined) {
    userMetadata.margin = marginValue;
  }

  if (getSafeMode()) {
    const now = new Date();
    const fakeId = `cmp_${Date.now()}`;
    const metrics = {
      ...createEmptyRawMetrics(),
      budget: typeof budget === 'number' ? budget : null,
      cplTarget: typeof cplTarget === 'number' ? cplTarget : null,
      cpl: null,
    } satisfies CampaignDTO['metrics'];
    const classificationMetadata: Record<string, string> = {};
    if (productType) {
      classificationMetadata.productType = productType;
    }
    if (marginType) {
      classificationMetadata.marginType = marginType;
    }
    if (strategy) {
      classificationMetadata.strategy = strategy;
    }
    const responsePayload: CampaignDTO = {
      id: fakeId,
      tenantId: resolvedAgreementId,
      agreementId: resolvedAgreementId,
      agreementName: resolvedAgreementName || null,
      name: resolvedName,
      status: 'scheduled',
      metadata: {
        safeMode: true,
        channel,
        schedule,
        audienceCount,
        ...(resolvedTags.length > 0 ? { tags: resolvedTags } : {}),
        ...(Object.keys(classificationMetadata).length > 0 ? { classification: classificationMetadata } : {}),
        ...userMetadata,
      },
      instanceId: resolvedInstanceId,
      instanceName: resolvedInstanceId,
      whatsappInstanceId: resolvedInstanceId,
      createdAt: now,
      updatedAt: now,
      metrics,
      productType,
      marginType,
      strategy,
      tags: resolvedTags,
    };

    return { data: responsePayload, meta: { safeMode: true }, statusCode: 201 };
  }

  const explicitTenantId = input.explicitTenantId?.trim() || undefined;
  const baseLogContext = {
    requestedTenantId,
    explicitTenantId: explicitTenantId ?? null,
    instanceId: resolvedInstanceId,
    requestedBrokerId: resolvedBrokerId,
    agreementId: resolvedAgreementId,
  };

  const tenantIdentifierCandidates = Array.from(
    new Set(
      [explicitTenantId, requestedTenantId, resolvedAgreementId].filter(
        (value): value is string => typeof value === 'string' && value.length > 0
      )
    )
  );

  let instance: Awaited<ReturnType<typeof prisma.whatsAppInstance.findUnique>> | null = null;

  for (const candidateId of identifierCandidates) {
    instance = await prisma.whatsAppInstance.findUnique({ where: { id: candidateId } });
    if (instance) {
      if (candidateId !== resolvedInstanceId) {
        logger.info('WhatsApp instance resolved via alternate identifier during campaign creation', {
          ...baseLogContext,
          requestedInstanceId: resolvedInstanceId,
          matchedIdentifier: candidateId,
          resolvedInstanceId: instance.id,
        });
      }
      break;
    }
  }

  if (!instance) {
    brokerLookup: for (const candidateBrokerId of identifierCandidates) {
      if (tenantIdentifierCandidates.length > 0) {
        for (const tenantCandidate of tenantIdentifierCandidates) {
          instance = await prisma.whatsAppInstance.findUnique({
            where: {
              tenantId_brokerId: {
                tenantId: tenantCandidate,
                brokerId: candidateBrokerId,
              },
            },
          });

          if (instance) {
            logger.info('WhatsApp instance resolved via broker identifier during campaign creation', {
              ...baseLogContext,
              requestedInstanceId: resolvedInstanceId,
              matchedBrokerId: candidateBrokerId,
              matchedTenantId: tenantCandidate,
              resolvedInstanceId: instance.id,
              resolvedBrokerId: instance.brokerId,
            });
            break brokerLookup;
          }
        }
      } else {
        break;
      }
    }
  }

  if (!instance) {
    const placeholderTenantId = explicitTenantId || requestedTenantId || resolvedAgreementId;

    logger.warn('WhatsApp instance not found. Creating placeholder for testing purposes.', {
      ...baseLogContext,
      tenantId: placeholderTenantId,
      identifierCandidates,
    });

    const brokerIdentifier = resolvedBrokerId ?? resolvedInstanceId;

    try {
      instance = await prisma.whatsAppInstance.create({
        data: {
          id: resolvedInstanceId,
          tenantId: placeholderTenantId,
          name: resolvedInstanceId,
          brokerId: brokerIdentifier,
          status: 'connected',
          connected: true,
          metadata: {
            origin: 'auto-created-for-campaign',
          },
        },
      });
    } catch (creationError) {
      if (creationError instanceof Prisma.PrismaClientKnownRequestError && creationError.code === 'P2002') {
        logger.warn('WhatsApp instance creation hit unique constraint; reusing existing record', {
          ...baseLogContext,
          prismaError: creationError.meta,
          identifierCandidates,
        });

        const orConditions = identifierCandidates.flatMap((candidate) => {
          const conditions = [
            { id: candidate },
            ...(tenantIdentifierCandidates.length > 0
              ? tenantIdentifierCandidates.map((tenantCandidate) => ({
                  AND: [{ tenantId: tenantCandidate }, { brokerId: candidate }],
                }))
              : []),
            { brokerId: candidate },
          ];

          return conditions;
        });

        const findArgs =
          orConditions.length > 0 ? ({ where: { OR: orConditions } } as const) : ({} as const);

        instance = await prisma.whatsAppInstance.findFirst(findArgs);

        if (!instance) {
          throw creationError;
        }
      } else {
        throw creationError;
      }
    }
  }

  const instanceTenantId =
    typeof instance.tenantId === 'string' && instance.tenantId.trim().length > 0
      ? instance.tenantId.trim()
      : undefined;

  let tenantRecord = instanceTenantId
    ? await prisma.tenant.findFirst({
        where: {
          OR: [
            { id: instanceTenantId },
            ...(normalizeTenantSlug(instanceTenantId)
              ? [{ slug: normalizeTenantSlug(instanceTenantId) as string }]
              : []),
          ],
        },
      })
    : null;

  const fallbackTenantIdCandidates = new Set<string>([
    ...(explicitTenantId ? [explicitTenantId] : []),
    ...(requestedTenantId ? [requestedTenantId] : []),
    ...(resolvedAgreementId ? [resolvedAgreementId] : []),
    ...(instanceTenantId ? [instanceTenantId] : []),
  ]);

  const fallbackSlugCandidates = new Set<string>();
  for (const candidate of [
    explicitTenantId,
    requestedTenantId,
    resolvedAgreementId,
    resolvedAgreementName,
    instanceTenantId,
  ]) {
    const slug = normalizeTenantSlug(candidate ?? undefined);
    if (slug) {
      fallbackSlugCandidates.add(slug);
    }
  }

  const pickFirst = <T,>(values: Iterable<T>): T | undefined => {
    for (const value of values) {
      return value;
    }
    return undefined;
  };

  const preferredTenantId = pickFirst(fallbackTenantIdCandidates) ?? requestedTenantId;
  const preferredSlug = normalizeTenantSlug(preferredTenantId) ?? pickFirst(fallbackSlugCandidates);
  const preferredName = resolvedAgreementName || resolvedAgreementId || preferredTenantId || 'Lead Engine Tenant';

  if (!tenantRecord) {
    try {
      tenantRecord = await prisma.tenant.create({
        data: {
          id: preferredTenantId,
          name: preferredName,
          slug: preferredSlug ?? undefined,
          settings: {},
        },
      });
    } catch (creationError) {
      if (creationError instanceof Prisma.PrismaClientKnownRequestError && creationError.code === 'P2002') {
        const fallbackWhere = {
          OR: [
            ...Array.from(fallbackTenantIdCandidates).map((id) => ({ id })),
            ...(fallbackSlugCandidates.size > 0 ? Array.from(fallbackSlugCandidates).map((slug) => ({ slug })) : []),
            ...(preferredSlug ? [{ slug: preferredSlug }] : []),
            ...(preferredTenantId ? [{ id: preferredTenantId }] : []),
          ],
          ...(preferredSlug ? { slug: preferredSlug } : {}),
        } as Prisma.TenantWhereInput;

        tenantRecord = await prisma.tenant.findFirst({ where: fallbackWhere });

        if (!tenantRecord) {
          throw creationError;
        }
      } else {
        throw creationError;
      }
    }
  }

  const resolvedTenantId =
    tenantRecord?.id || instanceTenantId || explicitTenantId || requestedTenantId || resolvedAgreementId;

  if (tenantRecord && instance.tenantId !== tenantRecord.id) {
    instance = await prisma.whatsAppInstance.update({
      where: { id: instance.id },
      data: { tenantId: tenantRecord.id },
    });
  }

  const tenantId = resolvedTenantId;
  const effectiveInstanceId = instance.id;

  const actorId = input.actorId || 'system';
  const normalizedName = resolvedName;
  const slug = toSlug(normalizedName, '');
  const requestedStatus = input.status ?? 'draft';

  const metadataBase: Record<string, unknown> = { ...userMetadata };
  if (slug) {
    metadataBase.slug = slug;
  }
  if (typeof budget === 'number') {
    metadataBase.budget = budget;
  }
  if (typeof cplTarget === 'number') {
    metadataBase.cplTarget = cplTarget;
  }
  const classificationMetadata: Record<string, string> = {};
  if (productType) {
    classificationMetadata.productType = productType;
  }
  if (marginType) {
    classificationMetadata.marginType = marginType;
  }
  if (strategy) {
    classificationMetadata.strategy = strategy;
  }
  if (Object.keys(classificationMetadata).length > 0) {
    metadataBase.classification = classificationMetadata;
  }
  if (resolvedTags.length > 0) {
    metadataBase.tags = resolvedTags;
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
      ...(tenantId ? { tenantId } : {}),
      whatsappInstanceId: instance.id,
      agreementId: resolvedAgreementId,
      productType: productType,
      marginType: marginType,
      strategy: strategy,
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
      let releasedMetadata: CampaignMetadata = existingCampaign.metadata as CampaignMetadata;
      if (isRecord(releasedMetadata)) {
        releasedMetadata = { ...(releasedMetadata as Record<string, unknown>), ...metadataBase };
      } else {
        releasedMetadata = metadataBase;
      }

      const newMetadata = appendCampaignHistory(releasedMetadata, buildCampaignHistoryEntry('recreated', actorId, {}));
      creationExtras = [
        buildCampaignHistoryEntry('status-changed', actorId, {
          from: 'ended',
          to: requestedStatus,
          previousCampaignId: existingCampaign.id,
        }),
        buildCampaignHistoryEntry('recreated-from', actorId, {
          previousCampaignId: existingCampaign.id,
        }),
      ];

      await prisma.campaign.update({
        where: { id: existingCampaign.id },
        data: { metadata: newMetadata },
      });
    } else {
      const refreshedCampaign = await prisma.campaign.findUnique({
        where: { id: existingCampaign.id },
        include: {
          whatsappInstance: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!refreshedCampaign) {
        throw new CampaignServiceError('CAMPAIGN_NOT_FOUND', 'Campanha não encontrada.', 404);
      }

      logger.info('Campaign reused for instance', {
        tenantId,
        agreementId: resolvedAgreementId,
        instanceId: instance.id,
        campaignId: existingCampaign.id,
        status: existingCampaign.status,
        requestedStatus,
      });

      const { data, warnings } = await buildCampaignResponseSafely(refreshedCampaign as CampaignWithInstance, {
        tenantId,
        agreementId: resolvedAgreementId,
        instanceId: instance.id,
        campaignId: existingCampaign.id,
      });

      return { data, ...(warnings ? { warnings } : {}), statusCode: 200 };
    }
  }

  const creationMetadata = buildCreationMetadata(creationExtras ?? []);

  let campaign: CampaignWithInstance;
  try {
    campaign = (await prisma.campaign.create({
      data: {
        tenantId,
        name: normalizedName,
        agreementId: resolvedAgreementId,
        agreementName: resolvedAgreementName || resolvedAgreementId,
        whatsappInstanceId: instance.id,
        status: requestedStatus,
        metadata: creationMetadata as Prisma.JsonObject,
        productType,
        marginType,
        strategy,
        tags: resolvedTags,
      },
      include: {
        whatsappInstance: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })) as CampaignWithInstance;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const conflictingCampaign = await prisma.campaign.findFirst({
        where: {
          tenantId,
          agreementId: resolvedAgreementId,
          whatsappInstanceId: instance.id,
        },
        include: {
          whatsappInstance: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (conflictingCampaign) {
        const currentStatus = normalizeStatus(conflictingCampaign.status) ?? 'draft';
        const responseLogContext = {
          tenantId,
          agreementId: resolvedAgreementId,
          instanceId: instance.id,
          campaignId: conflictingCampaign.id,
        };
        const { data, warnings } = await buildCampaignResponseSafely(conflictingCampaign as CampaignWithInstance, responseLogContext);

        if (currentStatus === requestedStatus) {
          logger.warn('Campaign already exists for agreement and instance, returning existing record', {
            ...responseLogContext,
            requestedStatus,
          });
          return { data, ...(warnings ? { warnings } : {}), statusCode: 200 };
        }

        logger.warn('Campaign already exists for agreement and instance with different status', {
          ...responseLogContext,
          requestedStatus,
          currentStatus,
        });

        throw new CampaignServiceError('CAMPAIGN_ALREADY_EXISTS', 'Já existe uma campanha para este acordo e instância.', 409, {
          conflict: {
            data,
            ...(warnings ? { warnings } : {}),
          },
        });
      }
    }

    throw error;
  }

  logger.info(creationExtras ? 'Campaign recreated after ended' : 'Campaign created', {
    tenantId,
    campaignId: campaign.id,
    instanceId: effectiveInstanceId,
    status: campaign.status,
    previousCampaignId: creationExtras ? existingCampaign?.id ?? null : null,
  });

  const responseLogContext = {
    tenantId,
    agreementId: resolvedAgreementId,
    instanceId: instance.id,
    campaignId: campaign.id,
  };
  const { data, warnings } = await buildCampaignResponseSafely(campaign, responseLogContext);

  return { data, ...(warnings ? { warnings } : {}) };
};

export interface UpdateCampaignInput {
  campaignId: string;
  actorId: string;
  status?: CampaignStatus | null;
  name?: string;
  instanceId?: string | null;
}

export interface UpdateCampaignResult {
  data: CampaignDTO;
  warnings?: CampaignWarning[];
}

export const updateCampaign = async (
  input: UpdateCampaignInput
): Promise<UpdateCampaignResult> => {
  const { campaignId, actorId, status: nextStatus, name, instanceId: requestedInstanceId } = input;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
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
    throw new CampaignServiceError('CAMPAIGN_NOT_FOUND', 'Campanha não encontrada.', 404);
  }

  if (name && name !== campaign.name) {
    throw new CampaignServiceError('CAMPAIGN_RENAME_NOT_ALLOWED', 'Renomear campanhas não é permitido.', 400);
  }

  const updates: Prisma.CampaignUpdateInput = {};
  let instanceReassigned = false;
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

  if (nextStatus && nextStatus !== currentStatus) {
    if (!canTransition(currentStatus, nextStatus)) {
      throw new CampaignServiceError(
        'INVALID_CAMPAIGN_TRANSITION',
        `Transição de ${currentStatus} para ${nextStatus} não permitida.`,
        409
      );
    }

    updates.status = nextStatus;
    appendHistoryEntry(
      buildCampaignHistoryEntry('status-changed', actorId, {
        from: currentStatus,
        to: nextStatus,
      })
    );

    if (nextStatus === 'ended') {
      appendHistoryEntry(
        buildCampaignHistoryEntry('status-ended', actorId, {
          endedAt: new Date().toISOString(),
        })
      );
    }
  }

  if (requestedInstanceId !== undefined) {
    const normalizedRequested =
      typeof requestedInstanceId === 'string' && requestedInstanceId.trim().length > 0
        ? requestedInstanceId.trim()
        : null;
    const currentInstanceId = campaign.whatsappInstanceId ?? null;

    if ((normalizedRequested ?? null) !== (currentInstanceId ?? null)) {
      if (normalizedRequested) {
        const nextInstance = await prisma.whatsAppInstance.findFirst({
          where: {
            id: normalizedRequested,
          },
          select: {
            id: true,
            name: true,
          },
        });

        if (!nextInstance) {
          throw new CampaignServiceError('INSTANCE_NOT_FOUND', 'Instância WhatsApp não encontrada.', 404);
        }

        updates.whatsappInstance = { connect: { id: nextInstance.id } };
        instanceReassigned = true;
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
      } else {
        const timestamp = new Date().toISOString();
        updates.whatsappInstance = { disconnect: true };
        instanceReassigned = true;
        updateMetadata((base) => {
          base.reassignedAt = timestamp;
          base.previousInstanceId = campaign.whatsappInstanceId ?? null;
          base.unlinkedAt = timestamp;
        });
        appendHistoryEntry(
          buildCampaignHistoryEntry('instance-reassigned', actorId, {
            from: campaign.whatsappInstanceId ?? null,
            to: null,
            disconnect: true,
          })
        );
      }
    }
  }

  if (metadataDirty) {
    updates.metadata = metadataAccumulator as Prisma.JsonObject;
  }

  if (!updates.status && !updates.metadata && !instanceReassigned) {
    const data = await buildCampaignResponse(campaign as CampaignWithInstance);
    return { data };
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
    tenantId: updated.tenantId,
    campaignId: campaign.id,
    status: updated.status,
    instanceId: updated.whatsappInstanceId,
    statusChanged: Boolean(updates.status && nextStatus !== currentStatus),
    instanceReassigned,
  });

  const data = await buildCampaignResponse(updated as CampaignWithInstance);
  return { data };
};

export interface DeleteCampaignInput {
  campaignId: string;
  tenantId: string;
  actorId: string;
}

export const deleteCampaign = async (input: DeleteCampaignInput): Promise<CampaignDTO> => {
  const { campaignId, tenantId, actorId } = input;

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      tenantId,
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

  if (!campaign) {
    throw new CampaignServiceError('CAMPAIGN_NOT_FOUND', 'Campanha não encontrada.', 404);
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

  const updated = (await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      status: 'ended',
      whatsappInstanceId: null,
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
  })) as CampaignWithInstance;

  logger.info('Campaign soft-deleted', {
    tenantId,
    campaignId: campaign.id,
    previousStatus: currentStatus,
  });

  return buildCampaignResponse(updated);
};

