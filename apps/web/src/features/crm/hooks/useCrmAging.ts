import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api.js';
import { serializeCrmFilters } from '../utils/filter-serialization';
import type { CrmFilterState } from '../state/types';
import type { LeadAgingSummary } from '../state/leads';

const emptySummary: LeadAgingSummary = { buckets: [], generatedAt: '' };

const fetchAging = async (filters: CrmFilterState): Promise<LeadAgingSummary> => {
  const params = new URLSearchParams({ filters: serializeCrmFilters(filters) });
  const response = await apiGet(`/api/crm/aging?${params}`);
  const payload = response?.data ?? response;
  if (!Array.isArray(payload?.buckets)) throw new Error('Resposta inválida ao carregar inatividade.');
  return payload;
};

export const useCrmAging = (filters: CrmFilterState) => {
  const query = useQuery<LeadAgingSummary>({
    queryKey: ['crm', 'aging', serializeCrmFilters(filters)],
    queryFn: () => fetchAging(filters),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return {
    summary: query.data ?? emptySummary,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error : null,
    refetch: query.refetch,
  };
};

export default useCrmAging;
