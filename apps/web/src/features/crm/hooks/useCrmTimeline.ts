import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api.js';
import { serializeCrmFilters } from '../utils/filter-serialization';
import type { CrmFilterState } from '../state/types';
import type { LeadTimelineEvent } from '../state/leads';

type TimelineResponse = {
  items: LeadTimelineEvent[];
};

type TimelineFilters = {
  eventTypes?: string[];
  limit?: number;
};

const fetchTimeline = async (filters: CrmFilterState, options: TimelineFilters): Promise<LeadTimelineEvent[]> => {
  const params = new URLSearchParams({
    filters: serializeCrmFilters(filters),
  });
  if (options?.eventTypes?.length) {
    params.set('types', options.eventTypes.join(','));
  }
  if (options?.limit) {
    params.set('limit', String(options.limit));
  }

  const response = await apiGet(`/api/crm/timeline?${params.toString()}`);
  const payload = response?.data ?? response;
  if (!Array.isArray(payload?.items)) throw new Error('Resposta inválida ao carregar dados do CRM.');
  return payload.items;
};

export const useCrmTimeline = (filters: CrmFilterState, options: TimelineFilters) => {
  const query = useQuery<LeadTimelineEvent[]>({
    queryKey: ['crm', 'timeline', serializeCrmFilters(filters), options.eventTypes?.join('|') ?? 'all'],
    queryFn: () => fetchTimeline(filters, options),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return {
    events: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error : null,
    refetch: query.refetch,
  };
};

export default useCrmTimeline;
