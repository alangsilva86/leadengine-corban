import { PropsWithChildren, useEffect, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { normalizeCrmFilters } from '../utils/filter-serialization';
import { CrmViewProvider } from '../state/view-context';
import type { CrmFilterState } from '../state/types';
import type { CrmMetricPrimitive } from '../state/metrics';

const queryClient = new QueryClient();

const defaultFilters: CrmFilterState = normalizeCrmFilters({
  stages: ['qualification'],
  owners: ['owner:me'],
  origins: ['web'],
  channels: ['whatsapp'],
  inactivityDays: 2,
});

const metricsPayload = {
  success: true,
  data: {
    summary: [
      { id: 'activeLeads', label: 'Leads ativos', unit: 'count', value: 120, delta: 5, deltaUnit: 'count', trend: 'up' },
      { id: 'slaCompliance', label: 'Dentro do SLA', unit: 'percentage', value: 82, delta: -4, deltaUnit: 'percentage', trend: 'down' },
      { id: 'avgResponseTime', label: '1ª resposta média', unit: 'duration', value: 58, delta: -3, deltaUnit: 'duration', trend: 'up' },
      { id: 'stalledLeads', label: 'Sem atividade', unit: 'count', value: 14, delta: 2, deltaUnit: 'count', trend: 'down' },
      { id: 'conversionRate', label: 'Taxa de conversão', unit: 'percentage', value: 27, delta: 1, deltaUnit: 'percentage', trend: 'up' },
    ] as CrmMetricPrimitive[],
    retrievedAt: new Date().toISOString(),
    source: 'api' as const,
  },
};

const agingPayload = {
  success: true,
  data: {
    generatedAt: new Date().toISOString(),
    filters: {},
    buckets: [
      { stageId: 'qualification', stageName: 'Qualificação', bucketId: '0-1', bucketLabel: '0-1 dia', leadCount: 6, potentialValue: 12000, sampleLeadId: 'lead-1', sampleLeadName: 'Lead 1' },
      { stageId: 'qualification', stageName: 'Qualificação', bucketId: '2-3', bucketLabel: '2-3 dias', leadCount: 4, potentialValue: 9000, sampleLeadId: 'lead-2', sampleLeadName: 'Lead 2' },
      { stageId: 'proposal', stageName: 'Proposta', bucketId: '0-1', bucketLabel: '0-1 dia', leadCount: 3, potentialValue: 15000, sampleLeadId: 'lead-3', sampleLeadName: 'Lead 3' },
      { stageId: 'proposal', stageName: 'Proposta', bucketId: '2-3', bucketLabel: '2-3 dias', leadCount: 5, potentialValue: 22000, sampleLeadId: 'lead-4', sampleLeadName: 'Lead 4' },
    ],
  },
};

const timelinePayload = {
  success: true,
  data: {
    items: [
      {
        id: 'evt-1',
        type: 'note',
        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        author: 'Você',
        title: 'Contato realizado',
        description: 'Lead respondeu ao follow-up com interesse.',
      },
    ],
  },
};

const tasksPayload = {
  success: true,
  data: {
    items: Array.from({ length: 5 }).map((_, index) => ({
      id: `task-${index + 1}`,
      title: index % 2 === 0 ? 'Enviar follow-up' : 'Agendar call',
      dueDate: new Date(Date.now() + index * 24 * 60 * 60 * 1000).toISOString(),
      status: index === 0 ? 'overdue' : 'pending',
      ownerId: 'owner:me',
      ownerName: 'Você',
      leadId: `lead-${index + 1}`,
      leadName: `Lead exemplo ${index + 1}`,
    })),
  },
};

const useMockFetch = () => {
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/crm/metrics')) {
        return new Response(JSON.stringify(metricsPayload), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/api/crm/aging')) {
        return new Response(JSON.stringify(agingPayload), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/api/crm/timeline')) {
        return new Response(JSON.stringify(timelinePayload), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/api/crm/tasks')) {
        return new Response(JSON.stringify(tasksPayload), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);
};

export const CrmStoryProviders = ({ children }: PropsWithChildren) => {
  useMockFetch();

  const filters = useMemo(() => defaultFilters, []);

  return (
    <QueryClientProvider client={queryClient}>
      <CrmViewProvider filters={filters}>{children}</CrmViewProvider>
    </QueryClientProvider>
  );
};

export default CrmStoryProviders;
