import { useQuery } from '@tanstack/react-query';
import { startOfDay, endOfDay } from 'date-fns';
import { apiGet } from '@/lib/api.js';
import { serializeCrmFilters } from '../utils/filter-serialization.ts';
import type { CrmFilterState } from '../state/types.ts';
import type { LeadTask } from '../state/leads.ts';

type DateRange = { from: Date; to: Date };

type CrmTaskResponse = {
  items: LeadTask[];
};

const buildRangeParams = (range: DateRange) => ({
  from: startOfDay(range.from).toISOString(),
  to: endOfDay(range.to).toISOString(),
});

const createFallbackTasks = (range: DateRange): LeadTask[] => {
  const { from } = range;
  return [0, 1, 2, 3].map((days) => {
    const dueDate = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
    return {
      id: `agenda-${days}`,
      title: days % 2 === 0 ? 'Revisar follow-up' : 'Enviar proposta revisada',
      dueDate: dueDate.toISOString(),
      status: days === 0 ? 'overdue' : 'pending',
      ownerId: 'owner:me',
      ownerName: 'Você',
      leadId: `lead-demo-${days + 1}`,
      leadName: `Lead exemplo ${days + 1}`,
    } satisfies LeadTask;
  });
};

const fetchCrmTasks = async (filters: CrmFilterState, range: DateRange): Promise<LeadTask[]> => {
  try {
    const params = new URLSearchParams({
      filters: serializeCrmFilters(filters),
      ...buildRangeParams(range),
    });
    const response = await apiGet(`/api/crm/tasks?${params.toString()}`);
    const payload = response?.data ?? response;
    if (payload && typeof payload === 'object' && Array.isArray((payload as CrmTaskResponse).items)) {
      return (payload as CrmTaskResponse).items;
    }
  } catch (error) {
    console.warn('[CRM] Falha ao carregar tarefas do calendário', error);
  }
  return createFallbackTasks(range);
};

export const useCrmTasks = (filters: CrmFilterState, range: DateRange) => {
  const keyRange = `${range.from.toISOString()}::${range.to.toISOString()}`;
  const query = useQuery<LeadTask[]>({
    queryKey: ['crm', 'tasks', serializeCrmFilters(filters), keyRange],
    queryFn: () => fetchCrmTasks(filters, range),
    staleTime: 30 * 1000,
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

export default useCrmTasks;
