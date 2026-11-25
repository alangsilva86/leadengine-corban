import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api.js';
import type { LeadDetail } from '../state/leads';
import { normalizeLeadStage } from '../utils/lead-stage';

const fetchLeadDetails = async (leadId: string): Promise<LeadDetail> => {
  const response = await apiGet(`/api/crm/leads/${encodeURIComponent(leadId)}`);
  const payload = response?.data ?? response;
  if (!payload?.id) throw new Error('Resposta inválida ao carregar dados do lead.');
  return { ...payload, stage: normalizeLeadStage(payload.stage) };
};

export const useLeadDetails = (leadId: string | null) => {
  const query = useQuery<LeadDetail>({
    queryKey: ['crm', 'lead', leadId],
    queryFn: () => fetchLeadDetails(leadId ?? ''),
    enabled: Boolean(leadId),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return {
    lead: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error : null,
    refetch: query.refetch,
  };
};

export default useLeadDetails;
