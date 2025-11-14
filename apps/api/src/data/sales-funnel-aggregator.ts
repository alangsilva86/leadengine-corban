import { SalesStage } from '@ticketz/core';
import type { Ticket } from '@ticketz/storage';

import { salesFunnelStageGauge } from '../lib/metrics';

type SalesOperationKind = 'simulation' | 'proposal' | 'deal';

const SALES_DIMENSIONS = ['agreement', 'campaign', 'instance', 'product', 'strategy'] as const;

type SalesFunnelDimension = (typeof SALES_DIMENSIONS)[number];

export interface SalesContextMetadata {
  agreementId: string | null;
  agreementName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  instanceId: string | null;
  productType: string | null;
  strategy: string | null;
}

interface StageCounters {
  simulation: number;
  proposal: number;
  deal: number;
}

interface AggregationRecord {
  dimension: SalesFunnelDimension;
  value: string;
  label: string;
  operations: StageCounters;
  stageOperations: Map<SalesStage, StageCounters>;
  updatedAt: number;
}

interface TenantAggregation {
  overall: {
    operations: StageCounters;
    stageOperations: Map<SalesStage, StageCounters>;
    updatedAt: number;
  };
  dimensions: Map<SalesFunnelDimension, Map<string, AggregationRecord>>;
}

export interface SalesFunnelStageEntry {
  stage: SalesStage;
  simulation: number;
  proposal: number;
  deal: number;
  total: number;
}

export interface SalesFunnelSnapshot {
  dimension: SalesFunnelDimension | 'overall';
  value: string;
  label: string;
  operations: StageCounters & { total: number };
  stages: SalesFunnelStageEntry[];
  updatedAt: string;
}

const aggregations = new Map<string, TenantAggregation>();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
};

const readFirst = (candidates: unknown[]): string | null => {
  for (const candidate of candidates) {
    const value = toStringOrNull(candidate);
    if (value) {
      return value;
    }
  }
  return null;
};

const getNested = (record: Record<string, unknown>, path: string[]): unknown => {
  let current: unknown = record;
  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
};

const createStageCounters = (): StageCounters => ({
  simulation: 0,
  proposal: 0,
  deal: 0,
});

const ensureTenantAggregation = (tenantId: string): TenantAggregation => {
  let aggregation = aggregations.get(tenantId);
  if (!aggregation) {
    aggregation = {
      overall: {
        operations: createStageCounters(),
        stageOperations: new Map(),
        updatedAt: Date.now(),
      },
      dimensions: new Map(),
    } satisfies TenantAggregation;
    aggregations.set(tenantId, aggregation);
  }
  return aggregation;
};

const ensureStageCounters = (
  store: Map<SalesStage, StageCounters>,
  stage: SalesStage
): StageCounters => {
  let counters = store.get(stage);
  if (!counters) {
    counters = createStageCounters();
    store.set(stage, counters);
  }
  return counters;
};

const sumCounters = (counters: StageCounters): number =>
  counters.simulation + counters.proposal + counters.deal;

const incrementCounters = (counters: StageCounters, operation: SalesOperationKind): void => {
  if (operation === 'simulation') {
    counters.simulation += 1;
  } else if (operation === 'proposal') {
    counters.proposal += 1;
  } else if (operation === 'deal') {
    counters.deal += 1;
  }
};

const toDimensionValue = (value: string | null, fallback: string): string => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
};

const toDimensionLabel = (value: string | null, fallback: string): string => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
};

export const extractSalesContext = (ticket: Ticket): SalesContextMetadata => {
  const metadata = isRecord(ticket.metadata) ? (ticket.metadata as Record<string, unknown>) : {};

  const agreementId = readFirst([
    (ticket as Ticket & { agreementId?: string | null }).agreementId ?? null,
    metadata['agreementId'],
    metadata['agreement_id'],
    getNested(metadata, ['agreement', 'id']),
    getNested(metadata, ['agreement', 'agreementId']),
  ]);

  const agreementName = readFirst([
    metadata['agreementName'],
    metadata['agreement_name'],
    getNested(metadata, ['agreement', 'name']),
  ]);

  const campaignId = readFirst([
    metadata['campaignId'],
    metadata['campaign_id'],
    getNested(metadata, ['campaign', 'id']),
    getNested(metadata, ['campaign', 'campaignId']),
  ]);

  const campaignName = readFirst([
    metadata['campaignName'],
    metadata['campaign_name'],
    getNested(metadata, ['campaign', 'name']),
  ]);

  const instanceId = readFirst([
    metadata['sourceInstance'],
    metadata['instanceId'],
    metadata['instance_id'],
    metadata['whatsappInstanceId'],
    getNested(metadata, ['instance', 'id']),
  ]);

  const productType = readFirst([
    metadata['productType'],
    metadata['product_type'],
  ]);

  const strategy = readFirst([
    metadata['strategy'],
    metadata['strategyName'],
    metadata['strategy_name'],
  ]);

  return {
    agreementId,
    agreementName,
    campaignId,
    campaignName,
    instanceId,
    productType,
    strategy,
  } satisfies SalesContextMetadata;
};

const resolveDimensionInfo = (
  dimension: SalesFunnelDimension,
  context: SalesContextMetadata
): { value: string; label: string } => {
  switch (dimension) {
    case 'agreement': {
      const value = toDimensionValue(context.agreementId, 'unknown');
      const label = toDimensionLabel(
        context.agreementName ?? context.agreementId,
        'Convênio não informado'
      );
      return { value, label };
    }
    case 'campaign': {
      const value = toDimensionValue(context.campaignId, 'unknown');
      const label = toDimensionLabel(
        context.campaignName ?? context.campaignId,
        'Campanha não informada'
      );
      return { value, label };
    }
    case 'instance': {
      const value = toDimensionValue(context.instanceId, 'unknown');
      const label = toDimensionLabel(context.instanceId, 'Instância não informada');
      return { value, label };
    }
    case 'product': {
      const value = toDimensionValue(context.productType, 'unknown');
      const label = toDimensionLabel(context.productType, 'Produto não informado');
      return { value, label };
    }
    case 'strategy': {
      const value = toDimensionValue(context.strategy, 'unknown');
      const label = toDimensionLabel(context.strategy, 'Estratégia não informada');
      return { value, label };
    }
    default:
      return { value: 'unknown', label: 'Dimensão não informada' };
  }
};

const ensureAggregationRecord = (
  tenantAggregation: TenantAggregation,
  dimension: SalesFunnelDimension,
  value: string,
  label: string
): AggregationRecord => {
  let dimensionBucket = tenantAggregation.dimensions.get(dimension);
  if (!dimensionBucket) {
    dimensionBucket = new Map();
    tenantAggregation.dimensions.set(dimension, dimensionBucket);
  }

  let record = dimensionBucket.get(value);
  if (!record) {
    record = {
      dimension,
      value,
      label,
      operations: createStageCounters(),
      stageOperations: new Map(),
      updatedAt: Date.now(),
    } satisfies AggregationRecord;
    dimensionBucket.set(value, record);
  }

  return record;
};

const SALES_STAGE_ORDER = Object.values(SalesStage);

const buildSnapshot = (
  dimension: SalesFunnelDimension | 'overall',
  value: string,
  label: string,
  operations: StageCounters,
  stageOperations: Map<SalesStage, StageCounters>,
  updatedAt: number
): SalesFunnelSnapshot => {
  const stageEntries: SalesFunnelStageEntry[] = [];

  for (const stage of SALES_STAGE_ORDER) {
    const counters = stageOperations.get(stage);
    if (!counters) {
      continue;
    }
    const total = sumCounters(counters);
    if (total === 0) {
      continue;
    }
    stageEntries.push({
      stage,
      simulation: counters.simulation,
      proposal: counters.proposal,
      deal: counters.deal,
      total,
    });
  }

  return {
    dimension,
    value,
    label,
    operations: {
      simulation: operations.simulation,
      proposal: operations.proposal,
      deal: operations.deal,
      total: sumCounters(operations),
    },
    stages: stageEntries,
    updatedAt: new Date(updatedAt).toISOString(),
  } satisfies SalesFunnelSnapshot;
};

export const recordSalesFunnelOperation = ({
  tenantId,
  ticket,
  stage,
  operation,
  context,
}: {
  tenantId: string;
  ticket: Ticket;
  stage: SalesStage;
  operation: SalesOperationKind;
  context?: SalesContextMetadata;
}): void => {
  const tenantAggregation = ensureTenantAggregation(tenantId);
  const metadata = context ?? extractSalesContext(ticket);
  const normalizedStage = stage ?? SalesStage.DESCONHECIDO;

  const overallStageCounters = ensureStageCounters(tenantAggregation.overall.stageOperations, normalizedStage);
  incrementCounters(overallStageCounters, operation);
  incrementCounters(tenantAggregation.overall.operations, operation);
  tenantAggregation.overall.updatedAt = Date.now();

  salesFunnelStageGauge.set(
    {
      tenantId,
      dimension: 'overall',
      dimensionValue: 'tenant',
      stage: normalizedStage,
    },
    sumCounters(overallStageCounters)
  );

  for (const dimension of SALES_DIMENSIONS) {
    const info = resolveDimensionInfo(dimension, metadata);
    const record = ensureAggregationRecord(tenantAggregation, dimension, info.value, info.label);
    incrementCounters(record.operations, operation);
    const stageCounters = ensureStageCounters(record.stageOperations, normalizedStage);
    incrementCounters(stageCounters, operation);
    record.updatedAt = Date.now();

    salesFunnelStageGauge.set(
      {
        tenantId,
        dimension,
        dimensionValue: info.value,
        stage: normalizedStage,
      },
      sumCounters(stageCounters)
    );
  }
};

export const getSalesFunnelSummary = (tenantId: string): SalesFunnelSnapshot | null => {
  const tenantAggregation = aggregations.get(tenantId);
  if (!tenantAggregation) {
    return null;
  }
  if (sumCounters(tenantAggregation.overall.operations) === 0) {
    return null;
  }
  return buildSnapshot(
    'overall',
    'tenant',
    'Operações do tenant',
    tenantAggregation.overall.operations,
    tenantAggregation.overall.stageOperations,
    tenantAggregation.overall.updatedAt
  );
};

export const getSalesFunnelForDimension = (
  tenantId: string,
  dimension: SalesFunnelDimension,
  value: string
): SalesFunnelSnapshot | null => {
  const tenantAggregation = aggregations.get(tenantId);
  if (!tenantAggregation) {
    return null;
  }
  const bucket = tenantAggregation.dimensions.get(dimension);
  if (!bucket) {
    return null;
  }
  const record = bucket.get(value);
  if (!record) {
    return null;
  }
  if (sumCounters(record.operations) === 0) {
    return null;
  }
  return buildSnapshot(
    record.dimension,
    record.value,
    record.label,
    record.operations,
    record.stageOperations,
    record.updatedAt
  );
};

export const listSalesFunnelForDimension = (
  tenantId: string,
  dimension: SalesFunnelDimension
): SalesFunnelSnapshot[] => {
  const tenantAggregation = aggregations.get(tenantId);
  if (!tenantAggregation) {
    return [];
  }
  const bucket = tenantAggregation.dimensions.get(dimension);
  if (!bucket) {
    return [];
  }

  const snapshots: SalesFunnelSnapshot[] = [];
  for (const record of bucket.values()) {
    if (sumCounters(record.operations) === 0) {
      continue;
    }
    snapshots.push(
      buildSnapshot(
        record.dimension,
        record.value,
        record.label,
        record.operations,
        record.stageOperations,
        record.updatedAt
      )
    );
  }
  return snapshots;
};

export const resetSalesFunnelAggregations = (): void => {
  aggregations.clear();
  salesFunnelStageGauge.clear();
};

export type { SalesFunnelDimension, SalesOperationKind };
