import { useQuery } from '@tanstack/react-query';
import { startOfDay, endOfDay } from 'date-fns';
import { apiGet } from '@/lib/api.js';
import { serializeCrmFilters } from '../utils/filter-serialization';
import type { CrmFilterState } from '../state/types';
import type { LeadTask } from '../state/leads';

type DateRange = { from: Date; to: Date };

type CrmTaskResponse = {
  items: LeadTask[];
};

const buildRangeParams = (range: DateRange) => ({
  from: startOfDay(range.from).toISOString(),
  to: endOfDay(range.to).toISOString(),
});

const fetchCrmTasks = async (filters: CrmFilterState, range: DateRange): Promise<LeadTask[]> => {
  const params = new URLSearchParams({
    filters: serializeCrmFilters(filters),
    ...buildRangeParams(range),
  });
  const response = await apiGet(`/api/crm/tasks?${params.toString()}`);
  const payload = response?.data ?? response;
  if (!Array.isArray(payload?.items)) throw new Error('Resposta inválida ao carregar dados do CRM.');
  return payload.items;
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
