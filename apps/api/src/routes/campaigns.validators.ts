import { body, param, query } from 'express-validator';
import type { Request } from 'express';

export const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'ended'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export const DEFAULT_STATUS: CampaignStatus = 'active';

export const normalizeStatus = (value: unknown): CampaignStatus | null => {
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

export const normalizeClassificationValue = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const normalizeTagsInput = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  const values: string[] = [];

  const pushValue = (entry: unknown) => {
    if (typeof entry === 'string') {
      entry
        .split(',')
        .map((token) => token.trim())
        .filter((token) => token.length > 0)
        .forEach((token) => values.push(token));
      return;
    }

    if (entry !== null && entry !== undefined) {
      const asString = String(entry).trim();
      if (asString.length > 0) {
        values.push(asString);
      }
    }
  };

  if (Array.isArray(value)) {
    value.forEach(pushValue);
  } else {
    pushValue(value);
  }

  return Array.from(new Set(values));
};

export const parseMetadataPayload = (value: unknown): Record<string, unknown> => {
  if (isRecord(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
};

export const readNumericField = (source: Record<string, unknown>, key: string): number | null => {
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

const normalizeQueryValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
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
  productType?: string | null;
  marginType?: string | null;
  strategy?: string | null;
  tags: string[];
  statuses: CampaignStatus[];
}

export const buildFilters = (query: Request['query']): CampaignQueryFilters => {
  const agreementId = normalizeQueryValue(query.agreementId);
  const instanceId = normalizeQueryValue(query.instanceId);
  const statuses = extractStatuses(query.status);
  const productType = normalizeClassificationValue(normalizeQueryValue(query.productType));
  const marginType = normalizeClassificationValue(normalizeQueryValue(query.marginType));
  const strategy = normalizeClassificationValue(normalizeQueryValue(query.strategy));
  const tags = normalizeTagsInput(query.tags);
  const filters: CampaignQueryFilters = {
    tags,
    statuses: statuses.length > 0 ? statuses : [DEFAULT_STATUS],
  };

  if (agreementId) {
    filters.agreementId = agreementId;
  }

  if (instanceId) {
    filters.instanceId = instanceId;
  }

  if (productType !== null) {
    filters.productType = productType;
  }

  if (marginType !== null) {
    filters.marginType = marginType;
  }

  if (strategy !== null) {
    filters.strategy = strategy;
  }

  return filters;
};

export const listCampaignValidators = [
  query('status').optional(),
  query('agreementId').optional().isString().trim(),
  query('instanceId').optional().isString().trim(),
];

export const createCampaignValidators = [
  body('agreementId').isString().trim().isLength({ min: 1 }),
  body('agreementName').optional({ nullable: true }).isString().trim().isLength({ min: 1 }),
  body('instanceId').isString().trim().isLength({ min: 1 }),
  body('brokerId').optional().isString().trim().isLength({ min: 1 }),
  body('name').optional().isString().trim().isLength({ min: 1 }),
  body('budget').optional().isFloat({ min: 0 }),
  body('cplTarget').optional().isFloat({ min: 0 }),
  body('productType').isString().trim().isLength({ min: 1 }),
  body('marginType').optional({ nullable: true }).isString().trim().isLength({ min: 1 }),
  body('marginValue').optional({ nullable: true }).isFloat({ min: 0 }),
  body('strategy').optional({ nullable: true }).isString().trim().isLength({ min: 1 }),
  body('tags').optional().isArray(),
  body('tags.*').optional().isString(),
  body('metadata').optional().isObject(),
];

export const updateCampaignValidators = [
  param('id').isString().trim().isLength({ min: 1 }),
  body('name').optional().isString().trim().isLength({ min: 1 }),
  body('status').optional().isString().trim().isLength({ min: 1 }),
  body('instanceId').optional({ nullable: true }).isString().trim(),
];

export const deleteCampaignValidators = [param('id').isString().trim().isLength({ min: 1 })];

