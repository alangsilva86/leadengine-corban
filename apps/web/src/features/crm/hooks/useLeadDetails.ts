import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api.js';
import type { LeadDetail } from '../state/leads';

const FALLBACK_DETAIL: LeadDetail = {
  id: 'lead-demo-1',
  name: 'Cliente de Exemplo',
  stage: 'qualification',
  ownerId: 'owner:me',
  ownerName: 'Você',
  lastActivityAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  source: 'web',
  channel: 'whatsapp',
  potentialValue: 12000,
  status: 'in_progress',
  email: 'cliente@example.com',
  phone: '+55 11 99999-0000',
  company: 'Empresa Exemplo',
  score: 78,
  health: 'healthy',
  notes: 'Lead aberto através do formulário de contato. Interesse em plano premium.',
  customFields: {
    segment: 'Educação',
    employees: 35,
  },
};

const fetchLeadDetails = async (leadId: string): Promise<LeadDetail> => {
  if (!leadId) {
    return FALLBACK_DETAIL;
  }

  try {
    const response = await apiGet(`/api/crm/leads/${leadId}`);
    const payload = response?.data ?? response;
    if (payload && typeof payload === 'object') {
      return {
        ...FALLBACK_DETAIL,
        ...payload,
        id: typeof (payload as any).id === 'string' ? (payload as any).id : leadId,
      } as LeadDetail;
    }
  } catch (error) {
    console.warn('[CRM] Falha ao carregar detalhes do lead', error);
  }

  return { ...FALLBACK_DETAIL, id: leadId };
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
