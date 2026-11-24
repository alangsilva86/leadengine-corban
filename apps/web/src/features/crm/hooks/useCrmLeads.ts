import { useInfiniteQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api.js';
import { serializeCrmFilters } from '../utils/filter-serialization';
import type { CrmFilterState } from '../state/types';
import type { LeadSummary } from '../state/leads';

type PaginatedResponse = {
  items: LeadSummary[];
  nextCursor: string | null;
  total: number | null;
};

const fetchLeadsPage = async (filters: CrmFilterState, cursor: string | null): Promise<PaginatedResponse> => {
  const params = new URLSearchParams({ filters: serializeCrmFilters(filters) });
  if (cursor) params.set('cursor', cursor);
  const response = await apiGet(`/api/crm/leads?${params}`);
  const payload = response?.data ?? response;
  if (!Array.isArray(payload?.items)) throw new Error('Resposta inválida ao carregar leads.');
  return { items: payload.items, total: payload.total ?? null, nextCursor: payload.nextCursor ?? null };
};

export const useCrmLeads = (filters: CrmFilterState) => {
  const query = useInfiniteQuery<PaginatedResponse>({
    queryKey: ['crm', 'leads', serializeCrmFilters(filters)],
    queryFn: ({ pageParam }) => fetchLeadsPage(filters, (pageParam as string | null) ?? null),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 15 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = query.data?.pages[0]?.total ?? null;

  return {
    leads: items,
    total,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    error: query.error instanceof Error ? query.error : null,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    refetch: query.refetch,
  };
};

export default useCrmLeads;
