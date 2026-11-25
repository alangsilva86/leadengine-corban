import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api.js';

const DEFAULT_INCLUDE = ['contact', 'lead', 'notes'];
// Limite máximo aceito pela API por página (`paginationValidation`).
const API_MAX_PAGE_SIZE = 100;

const normalizeFilters = (filters = {}) => {
  const entries = Object.entries(filters)
    .filter(([, value]) =>
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

const buildQueryString = ({
  limit,
  page,
  includeMetrics,
  include,
  filters,
  sortBy = 'lastMessageAt',
  sortOrder = 'desc',
}) => {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (page && page > 1) {
    params.set('page', String(page));
  }

  if (sortBy) {
    params.set('sortBy', sortBy);
  }

  if (sortOrder) {
    params.set('sortOrder', sortOrder);
  }

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

const toNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * Busca a lista de conversas.
 *
 * `limit` acima de 100 (o máximo da API) é atendido buscando várias páginas e
 * concatenando os itens. O resultado continua plano (`data.items`), formato que os
 * escritores de cache do tempo real (`utils/updateTicketsList.js`) esperam.
 */
export const useTicketsQuery = ({
  filters = {},
  limit = 40,
  includeMetrics = true,
  enabled = true,
  staleTime = 5000,
  sortBy = 'lastMessageAt',
  sortOrder = 'desc',
  refetchInterval = false,
} = {}) => {
  const normalizedFilters = useMemo(() => normalizeFilters(filters), [filters]);

  const queryKey = useMemo(
    () => [
      'chat',
      'tickets',
      { limit, includeMetrics, filters: normalizedFilters, sortBy, sortOrder },
    ],
    [limit, includeMetrics, normalizedFilters, sortBy, sortOrder]
  );

  return useQuery({
    queryKey,
    enabled,
    staleTime,
    // React Query v5: mantém a lista anterior na tela enquanto a nova busca carrega
    // (antes `keepPreviousData: true`, ignorado na v5, esvaziava a lista a cada tecla).
    placeholderData: keepPreviousData,
    refetchInterval,
    queryFn: async () => {
      const pageSize = Math.min(limit, API_MAX_PAGE_SIZE);
      const pagesNeeded = Math.max(1, Math.ceil(limit / pageSize));
      const seen = new Set();
      const items = [];
      let metrics = null;
      let raw = null;
      let total = null;
      let hasNext = false;

      for (let page = 1; page <= pagesNeeded; page += 1) {
        const queryString = buildQueryString({
          limit: pageSize,
          page,
          includeMetrics: includeMetrics && page === 1,
          include: DEFAULT_INCLUDE,
          filters: normalizedFilters,
          sortBy,
          sortOrder,
        });

        const payload = await apiGet(`/api/tickets?${queryString}`);
        const data = payload?.data ?? null;
        const pageItems = Array.isArray(data?.items) ? data.items : [];

        if (page === 1) {
          raw = data;
          metrics = data?.metrics ?? null;
        }
        total = toNumber(data?.total) ?? total;

        for (const item of pageItems) {
          const id = item?.id;
          if (id && seen.has(id)) continue;
          if (id) seen.add(id);
          items.push(item);
        }

        hasNext =
          typeof data?.hasNext === 'boolean'
            ? data.hasNext
            : total !== null
              ? items.length < total
              : pageItems.length >= pageSize;

        if (!hasNext || pageItems.length === 0) {
          break;
        }
      }

      const pagination = raw?.pagination ?? { page: 1, limit };

      return {
        items,
        metrics,
        pagination,
        total: total ?? items.length,
        hasNext,
        raw,
      };
    },
  });
};

export default useTicketsQuery;
