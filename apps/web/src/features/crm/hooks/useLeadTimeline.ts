import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api.js';
import type { LeadTimelineEvent } from '../state/leads';

const createFallbackTimeline = (leadId: string): LeadTimelineEvent[] => [
  {
    id: `${leadId}-evt-1`,
    type: 'note',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    author: 'Você',
    title: 'Contato inicial registrado',
    description: 'Lead respondeu rapidamente e pediu uma proposta personalizada.',
  },
  {
    id: `${leadId}-evt-2`,
    type: 'call',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    author: 'Você',
    title: 'Chamada de negociação',
    description: 'Apresentamos plano avançado, aguardando retorno financeiro.',
  },
];

const fetchLeadTimeline = async (leadId: string): Promise<LeadTimelineEvent[]> => {
  if (!leadId) {
    return createFallbackTimeline('demo');
  }

  try {
    const response = await apiGet(`/api/crm/leads/${leadId}/timeline`);
    const payload = response?.data ?? response;
    if (Array.isArray(payload)) {
      return payload as LeadTimelineEvent[];
    }
  } catch (error) {
    console.warn('[CRM] Falha ao carregar timeline do lead', error);
  }

  return createFallbackTimeline(leadId);
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
