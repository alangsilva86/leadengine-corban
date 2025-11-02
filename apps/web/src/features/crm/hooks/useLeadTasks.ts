import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api.js';
import type { LeadTask } from '../state/leads';

const fallbackTasks: LeadTask[] = [
  {
    id: 'task-1',
    title: 'Enviar proposta comercial',
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    status: 'pending',
    ownerId: 'owner:me',
    ownerName: 'Você',
    leadId: 'lead-demo-1',
    leadName: 'Cliente de Exemplo',
  },
  {
    id: 'task-2',
    title: 'Agendar call de alinhamento',
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
    status: 'pending',
    ownerId: 'owner:me',
    ownerName: 'Você',
    leadId: 'lead-demo-1',
    leadName: 'Cliente de Exemplo',
  },
];

const fetchLeadTasks = async (leadId: string): Promise<LeadTask[]> => {
  if (!leadId) {
    return fallbackTasks;
  }

  try {
    const response = await apiGet(`/api/crm/leads/${leadId}/tasks`);
    const payload = response?.data ?? response;
    if (Array.isArray(payload)) {
      return payload as LeadTask[];
    }
  } catch (error) {
    console.warn('[CRM] Falha ao carregar tarefas do lead', error);
  }

  return fallbackTasks;
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
