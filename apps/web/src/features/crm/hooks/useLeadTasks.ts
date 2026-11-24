import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api.js';
import type { LeadTask } from '../state/leads';

const fetchLeadTasks = async (leadId: string): Promise<LeadTask[]> => {
  const response = await apiGet(`/api/crm/leads/${encodeURIComponent(leadId)}/tasks`);
  const payload = response?.data ?? response;
  if (!Array.isArray(payload)) throw new Error('Resposta inválida ao carregar dados do lead.');
  return payload;
};

export const useLeadTasks = (leadId: string | null) => {
  const query = useQuery<LeadTask[]>({
    queryKey: ['crm', 'lead', leadId, 'tasks'],
    queryFn: () => fetchLeadTasks(leadId ?? ''),
    enabled: Boolean(leadId),
    staleTime: 15 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return {
    tasks: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error : null,
    refetch: query.refetch,
  };
};

export default useLeadTasks;
