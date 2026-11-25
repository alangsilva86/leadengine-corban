import { useCallback } from 'react';
import { useMutation, useQueryClient, type InfiniteData, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPatch } from '@/lib/api.js';
import { getFriendlyErrorMessage } from '@/lib/errors.js';
import type { LeadDetail, LeadSummary } from '../state/leads';
import {
  LEAD_STAGE_DEFINITIONS,
  getLeadStageTransitionBlockReason,
  normalizeLeadStage,
  type LeadStage,
} from '../utils/lead-stage';
import emitCrmTelemetry from '../utils/telemetry';
import type { LeadsPage } from './useCrmLeads';

type MoveLeadVariables = { leadId: string; stage: LeadStage; reason?: string | undefined };

type Snapshot = {
  leads: Array<[QueryKey, InfiniteData<LeadsPage> | undefined]>;
  lead: LeadDetail | undefined;
  leadId: string;
};

const LEADS_KEY = ['crm', 'leads'] as const;

const patchPages = (data: InfiniteData<LeadsPage> | undefined, leadId: string, patch: Partial<LeadSummary>) => {
  if (!data?.pages) return data;
  let changed = false;
  const pages = data.pages.map((page) => {
    if (!page.items.some((item) => item.id === leadId)) return page;
    changed = true;
    return { ...page, items: page.items.map((item) => (item.id === leadId ? { ...item, ...patch } : item)) };
  });
  return changed ? { ...data, pages } : data;
};

/** Aplica a nova etapa em todas as listas/detalhes em cache. Devolve o estado anterior para desfazer. */
const applyOptimisticStage = (client: QueryClient, leadId: string, stage: LeadStage): Snapshot => {
  const snapshot: Snapshot = {
    leads: client.getQueriesData<InfiniteData<LeadsPage>>({ queryKey: LEADS_KEY }),
    lead: client.getQueryData<LeadDetail>(['crm', 'lead', leadId]),
    leadId,
  };
  client.setQueriesData<InfiniteData<LeadsPage>>({ queryKey: LEADS_KEY }, (data) => patchPages(data, leadId, { stage }));
  client.setQueryData<LeadDetail>(['crm', 'lead', leadId], (current) => (current ? { ...current, stage } : current));
  return snapshot;
};

const restoreSnapshot = (client: QueryClient, snapshot: Snapshot) => {
  snapshot.leads.forEach(([key, data]) => client.setQueryData(key, data));
  client.setQueryData(['crm', 'lead', snapshot.leadId], snapshot.lead);
};

const requestStageChange = async ({ leadId, stage, reason }: MoveLeadVariables) => {
  const body = reason ? { stage, reason } : { stage };
  const response = await apiPatch(`/api/crm/leads/${encodeURIComponent(leadId)}/stage`, body);
  const lead = (response?.data ?? null) as LeadSummary | null;
  return lead ? { ...lead, stage: normalizeLeadStage(lead.stage, stage) } : null;
};

type MoveOptions = { source?: 'kanban' | 'menu' | 'drawer' | undefined; reason?: string | undefined };

/**
 * Muda a etapa do lead (PATCH /api/crm/leads/:id/stage) com atualização otimista:
 * o cartão muda de coluna na hora, volta se a API recusar e o motivo aparece num aviso.
 */
export const useMoveLeadStage = () => {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey: ['crm', 'lead-stage'],
    mutationFn: requestStageChange,
  });

  const moveLead = useCallback(
    async (lead: Pick<LeadSummary, 'id' | 'name' | 'stage'>, target: LeadStage, options: MoveOptions = {}) => {
      const from = normalizeLeadStage(lead.stage);
      if (from === target) return false;

      const blocked = getLeadStageTransitionBlockReason(from, target);
      if (blocked) {
        toast.error('Não é possível mover este lead', { description: blocked });
        return false;
      }

      // Síncrono (sem esperar o cancelamento) para o cartão não "voltar" um quadro após soltar.
      const snapshot = applyOptimisticStage(client, lead.id, target);
      await client.cancelQueries({ queryKey: LEADS_KEY });
      applyOptimisticStage(client, lead.id, target);

      emitCrmTelemetry('crm.lead.move', { leadId: lead.id, fromStage: from, toStage: target, source: options.source ?? 'menu' });

      try {
        const updated = await mutation.mutateAsync({ leadId: lead.id, stage: target, reason: options.reason });
        if (updated) {
          client.setQueriesData<InfiniteData<LeadsPage>>({ queryKey: LEADS_KEY }, (data) =>
            patchPages(data, lead.id, {
              stage: updated.stage,
              ...(updated.lastActivityAt ? { lastActivityAt: updated.lastActivityAt } : {}),
            })
          );
        }
        return true;
      } catch (error) {
        restoreSnapshot(client, snapshot);
        toast.error(`Não foi possível mover ${lead.name || 'o lead'} para ${LEAD_STAGE_DEFINITIONS[target].label}`, {
          description: getFriendlyErrorMessage(error, 'Tente de novo em instantes.'),
        });
        return false;
      } finally {
        void client.invalidateQueries({ queryKey: LEADS_KEY });
        void client.invalidateQueries({ queryKey: ['crm', 'lead', lead.id] });
        void client.invalidateQueries({ queryKey: ['crm', 'metrics'] });
        void client.invalidateQueries({ queryKey: ['crm', 'aging'] });
        void client.invalidateQueries({ queryKey: ['crm', 'timeline'] });
        void client.invalidateQueries({ queryKey: ['crm', 'leads-index'] });
        // O Inbox mostra a mesma etapa: as conversas do contato precisam refletir a mudança.
        void client.invalidateQueries({ queryKey: ['chat', 'tickets'] });
        void client.invalidateQueries({ queryKey: ['contacts'] });
      }
    },
    [client, mutation]
  );

  return { moveLead, isPending: mutation.isPending, pendingLeadId: mutation.isPending ? mutation.variables?.leadId ?? null : null };
};

export default useMoveLeadStage;
