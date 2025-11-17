const ENRICHMENT_METADATA_KEYS = [
  'sourceInstance',
  'campaignId',
  'campaignName',
  'productType',
  'strategy',
] as const;

type MergeTarget = Record<string, unknown>;
type MergeSource = Record<string, unknown> | null | undefined;

const normalizeEnrichmentValue = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
};

export const mergeEnrichmentMetadata = (target: MergeTarget, ...sources: MergeSource[]): void => {
  for (const key of ENRICHMENT_METADATA_KEYS) {
    if (target[key] !== undefined) {
      const normalized = normalizeEnrichmentValue(target[key]);
      if (normalized === undefined) {
        delete target[key];
      } else {
        target[key] = normalized;
      }
      continue;
    }

    for (const source of sources) {
      if (!source || !(key in source)) {
        continue;
      }
      const normalized = normalizeEnrichmentValue(source[key]);
      if (normalized === undefined) {
        continue;
      }
      target[key] = normalized;
      break;
    }
  }
};

export type MergeEnrichmentMetadata = typeof mergeEnrichmentMetadata;
