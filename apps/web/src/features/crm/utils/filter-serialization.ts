import type { CrmFilterState } from '../state/types';

const sortStrings = (value: string[] | undefined) => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return [...value].filter(Boolean).sort((a, b) => a.localeCompare(b));
};

const normalizeScoreRange = (range: CrmFilterState['score']) => {
  if (!range) {
    return null;
  }
  const min = typeof range.min === 'number' ? range.min : null;
  const max = typeof range.max === 'number' ? range.max : null;

  if (min === null && max === null) {
    return null;
  }

  return { min, max };
};

const normalizeDateRange = (range: CrmFilterState['dateRange']) => {
  if (!range) {
    return null;
  }
  const from = typeof range.from === 'string' && range.from.length > 0 ? range.from : null;
  const to = typeof range.to === 'string' && range.to.length > 0 ? range.to : null;

  if (!from && !to) {
    return null;
  }

  return { from, to };
};

export const normalizeCrmFilters = (filters: CrmFilterState): CrmFilterState => {
  const normalized: CrmFilterState = {
    stages: sortStrings(filters.stages) ?? [],
    owners: sortStrings(filters.owners) ?? [],
    origins: sortStrings(filters.origins) ?? [],
    channels: sortStrings(filters.channels) ?? [],
    search: typeof filters.search === 'string' ? filters.search.trim() || undefined : undefined,
    inactivityDays:
      typeof filters.inactivityDays === 'number' && filters.inactivityDays >= 0 ? filters.inactivityDays : null,
    score: normalizeScoreRange(filters.score),
    dateRange: normalizeDateRange(filters.dateRange),
  };

  return normalized;
};

export const serializeCrmFilters = (filters: CrmFilterState): string => {
  const normalized = normalizeCrmFilters(filters);
  return JSON.stringify(normalized);
};
