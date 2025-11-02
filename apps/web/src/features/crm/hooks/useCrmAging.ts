import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api.js';
import { serializeCrmFilters } from '../utils/filter-serialization';
import type { CrmFilterState } from '../state/types';
import type { LeadAgingBucket, LeadAgingSummary } from '../state/leads';

const BUCKET_LABELS = [
  { id: '0-1', label: '0-1 dia' },
  { id: '2-3', label: '2-3 dias' },
  { id: '4-7', label: '4-7 dias' },
  { id: '8-14', label: '8-14 dias' },
  { id: '15+', label: '15+ dias' },
];

const fallbackSummary: LeadAgingSummary = {
  generatedAt: new Date().toISOString(),
  buckets: BUCKET_LABELS.flatMap((bucket, index) => {
    return [
      {
        stageId: 'qualification',
        stageName: 'Qualificação',
        bucketId: bucket.id,
        bucketLabel: bucket.label,
        leadCount: Math.max(0, 6 - index * 2),
        potentialValue: 5000 + index * 1500,
        sampleLeadId: 'lead-demo-1',
        sampleLeadName: 'Lead exemplo 1',
      },
      {
        stageId: 'proposal',
        stageName: 'Proposta',
        bucketId: bucket.id,
        bucketLabel: bucket.label,
        leadCount: Math.max(0, 4 - index),
        potentialValue: 8000 + index * 2000,
        sampleLeadId: 'lead-demo-2',
        sampleLeadName: 'Lead exemplo 2',
      },
    ] satisfies LeadAgingBucket[];
  }),
};

const fetchAging = async (filters: CrmFilterState): Promise<LeadAgingSummary> => {
  try {
    const params = new URLSearchParams({ filters: serializeCrmFilters(filters) });
    const response = await apiGet(`/api/crm/aging?${params.toString()}`);
    const payload = response?.data ?? response;
    if (payload && typeof payload === 'object' && Array.isArray((payload as LeadAgingSummary).buckets)) {
      return payload as LeadAgingSummary;
    }
  } catch (error) {
    console.warn('[CRM] Falha ao carregar dados de envelhecimento', error);
  }
  return fallbackSummary;
};

export const useCrmAging = (filters: CrmFilterState) => {
  const query = useQuery<LeadAgingSummary>({
    queryKey: ['crm', 'aging', serializeCrmFilters(filters)],
    queryFn: () => fetchAging(filters),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return {
    summary: query.data ?? fallbackSummary,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error : null,
    refetch: query.refetch,
  };
};

export default useCrmAging;
