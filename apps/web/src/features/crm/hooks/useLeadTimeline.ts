import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api.js';
import type { LeadTimelineEvent } from '../state/leads';

const fetchLeadTimeline = async (leadId: string): Promise<LeadTimelineEvent[]> => {
  const response = await apiGet(`/api/crm/leads/${encodeURIComponent(leadId)}/timeline`);
  const payload = response?.data ?? response;
  if (!Array.isArray(payload)) throw new Error('Resposta inválida ao carregar dados do lead.');
  return payload;
};

export const useLeadTimeline = (leadId: string | null) => {
  const query = useQuery<LeadTimelineEvent[]>({
    queryKey: ['crm', 'lead', leadId, 'timeline'],
    queryFn: () => fetchLeadTimeline(leadId ?? ''),
    enabled: Boolean(leadId),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return {
    timeline: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error : null,
    refetch: query.refetch,
  };
};

export default useLeadTimeline;
