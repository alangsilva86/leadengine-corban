import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api.js';

const DEFAULT_INCLUDE = ['contact', 'lead', 'notes'];

const normalizeFilters = (filters = {}) => {
  const entries = Object.entries(filters)
    .filter(([_, value]) =>
      Array.isArray(value)
        ? value.length > 0
        : value !== undefined && value !== null && value !== ''
    )
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return [key, [...value]];
      }
      if (typeof value === 'object') {
        return [key, { ...value }];
      }
      return [key, value];
    });

  return Object.fromEntries(entries);
};

const toQueryValue = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => `${item}`.trim())
      .filter(Boolean)
      .join(',');
  }
  return `${value}`;
};

const buildQueryString = ({ limit, includeMetrics, include, filters }) => {
  const params = new URLSearchParams();
  params.set('limit', String(limit));

  if (includeMetrics) {
    params.set('metrics', 'true');
  }

  const includeList = include && include.length > 0 ? include : DEFAULT_INCLUDE;
  params.set('include', includeList.join(','));

  Object.entries(filters ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    if (Array.isArray(value) && value.length === 0) {
      return;
    }

    params.set(key, toQueryValue(value));
  });

  return params.toString();
};

export const useTicketsQuery = ({
  filters = {},
  limit = 40,
  includeMetrics = true,
  enabled = true,
  staleTime = 5000,
} = {}) => {
  const normalizedFilters = useMemo(() => normalizeFilters(filters), [filters]);

  const queryKey = useMemo(
    () => ['chat', 'tickets', { limit, includeMetrics, filters: normalizedFilters }],
    [limit, includeMetrics, normalizedFilters]
  );

  return useQuery({
    queryKey,
    enabled,
    staleTime,
    keepPreviousData: true,
    queryFn: async () => {
      const queryString = buildQueryString({
        limit,
        includeMetrics,
        include: DEFAULT_INCLUDE,
        filters: normalizedFilters,
      });

      const payload = await apiGet(`/api/tickets?${queryString}`);
      const data = payload?.data ?? null;
      const items = Array.isArray(data?.items) ? data.items : [];
      const metrics = data?.metrics ?? null;
      const pagination = data?.pagination ?? { page: 1, limit };

      return {
        items,
        metrics,
        pagination,
        raw: data,
      };
    },
  });
};

export default useTicketsQuery;
