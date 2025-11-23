import { query, type ValidationChain } from 'express-validator';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface PaginationOptions {
  defaultPage?: number;
  defaultLimit?: number;
  maxLimit?: number;
}

export interface ParsedPagination {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponseInput<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> extends PaginatedResponseInput<T> {
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const parseNumericQuery = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

/**
 * Helpers de paginação compartilhados entre os routers da API.
 *
 * ```ts
 * const paginationValidators = [
 *   ...buildPaginationValidators(),
 *   query('search').optional().isString(),
 * ];
 *
 * const { page, limit, skip } = parsePaginationParams(req.query);
 * const result = buildPaginatedResponse({ items, total, page, limit });
 * res.json({ success: true, data: result });
 * ```
 */
export const buildPaginationValidators = (
  options: PaginationOptions = {}
): ValidationChain[] => {
  const { maxLimit = MAX_LIMIT } = options;

  return [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: maxLimit }).toInt(),
  ];
};

export const parsePaginationParams = (
  params: Record<string, unknown>,
  options: PaginationOptions = {}
): ParsedPagination => {
  const { defaultPage = DEFAULT_PAGE, defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = options;

  const page = Math.max(parseNumericQuery(params.page) ?? defaultPage, 1);
  const limit = parseNumericQuery(params.limit) ?? defaultLimit;
  const safeLimit = Math.min(Math.max(limit, 1), maxLimit);

  return {
    page,
    limit: safeLimit,
    skip: (page - 1) * safeLimit,
  };
};

interface NormalizePaginationOptions {
  defaultPage?: number;
  defaultLimit?: number;
  defaultSortOrder?: 'asc' | 'desc';
  maxLimit?: number;
}

export interface NormalizedPagination {
  page: number;
  limit: number;
  sortOrder: 'asc' | 'desc';
  sortBy?: string;
}

export const normalizePaginationQuery = (
  query: PaginationQueryParams,
  options: NormalizePaginationOptions = {}
): NormalizedPagination => {
  const {
    defaultPage = DEFAULT_PAGE,
    defaultLimit = DEFAULT_LIMIT,
    defaultSortOrder = 'desc',
    maxLimit = MAX_LIMIT,
  } = options;

  const page = Math.max(parseNumericQuery(query.page) ?? defaultPage, 1);
  const limit = Math.min(Math.max(parseNumericQuery(query.limit) ?? defaultLimit, 1), maxLimit);
  const sortOrder = query.sortOrder ?? defaultSortOrder;
  const sortBy = typeof query.sortBy === 'string' && query.sortBy.trim() ? query.sortBy.trim() : undefined;

  return { page, limit, sortOrder, ...(sortBy ? { sortBy } : {}) };
};

export const buildPaginatedResponse = <T>(
  params: PaginatedResponseInput<T>
): PaginatedResponse<T> => {
  const { items, total, page, limit } = params;

  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  const hasNext = page < totalPages;
  const hasPrev = page > 1 && totalPages > 0;

  return {
    items,
    total,
    page,
    limit,
    totalPages,
    hasNext,
    hasPrev,
  };
};
