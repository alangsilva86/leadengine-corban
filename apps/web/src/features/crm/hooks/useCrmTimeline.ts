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

const FALLBACK_EVENTS: LeadTimelineEvent[] = [
  {
    id: 'evt-1',
    type: 'note',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    author: 'Você',
    title: 'Contato registrado',
    description: 'Lead adicionado manualmente ao CRM.',
  },
  {
    id: 'evt-2',
    type: 'call',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    author: 'Você',
    title: 'Chamada de qualificação',
    description: 'Cliente interessado no plano Plus. Retorno agendado.',
  },
  {
    id: 'evt-3',
    type: 'status_change',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 90).toISOString(),
    author: 'Equipe',
    title: 'Status atualizado',
    description: 'Lead movido para negociação.',
  },
  {
    id: 'evt-4',
    type: 'message',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    author: 'WhatsApp',
    title: 'Mensagem recebida',
    description: 'Cliente solicitou detalhes adicionais sobre integração.',
  },
];

const fetchTimeline = async (filters: CrmFilterState, options: TimelineFilters): Promise<LeadTimelineEvent[]> => {
  try {
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
    if (payload && typeof payload === 'object' && Array.isArray((payload as TimelineResponse).items)) {
      return (payload as TimelineResponse).items;
    }
  } catch (error) {
    console.warn('[CRM] Falha ao carregar timeline', error);
  }
  return FALLBACK_EVENTS;
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
