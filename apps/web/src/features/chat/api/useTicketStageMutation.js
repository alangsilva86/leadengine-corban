import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiPut } from '@/lib/api.js';
import { normalizeLeadStage } from '@/features/crm/utils/lead-stage';

import { patchTicketStageInList } from '../utils/leadStage.js';

const TICKETS_KEY = ['chat', 'tickets'];

/**
 * Muda a etapa do lead a partir da conversa (o backend sincroniza o lead e as outras conversas
 * abertas do contato e emite `ticket.updated`). Atualização otimista com retorno em caso de erro.
 */
export const useTicketStageMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['chat', 'ticket-stage'],
    mutationFn: async ({ ticketId, stage }) => {
      if (!ticketId) throw new Error('ticketId is required to update the lead stage');
      const payload = await apiPut(`/api/tickets/${encodeURIComponent(ticketId)}`, { stage });
      return payload?.data ?? null;
    },
    onMutate: ({ ticketId, stage }) => {
      // Síncrono: o chip muda na hora; o cancelamento do refetch em curso vem logo depois.
      const context = { snapshots: queryClient.getQueriesData({ queryKey: TICKETS_KEY }), settled: false };
      queryClient.setQueriesData({ queryKey: TICKETS_KEY }, (data) => patchTicketStageInList(data, ticketId, stage));
      void queryClient.cancelQueries({ queryKey: TICKETS_KEY }).then(() => {
        if (context.settled) return;
        queryClient.setQueriesData({ queryKey: TICKETS_KEY }, (data) => patchTicketStageInList(data, ticketId, stage));
      });
      return context;
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      context.settled = true;
      context.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSuccess: (ticket, { ticketId, stage }, context) => {
      if (context) context.settled = true;
      const confirmed = normalizeLeadStage(ticket?.stage, stage);
      queryClient.setQueriesData({ queryKey: TICKETS_KEY }, (data) => patchTicketStageInList(data, ticketId, confirmed));
    },
    onSettled: (_ticket, _error, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: TICKETS_KEY });
      queryClient.invalidateQueries({ queryKey: ['chat', 'ticket', ticketId] });
      // A mesma etapa aparece no CRM e em Contatos.
      queryClient.invalidateQueries({ queryKey: ['crm'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
};

export default useTicketStageMutation;
