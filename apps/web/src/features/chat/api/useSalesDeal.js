import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiPost } from '@/lib/api.js';

const buildPayload = ({
  ticketId,
  calculationSnapshot,
  leadId = null,
  simulationId = null,
  proposalId = null,
  stage = null,
  metadata = null,
  closedAt = null,
}) => {
  if (!ticketId) {
    throw new Error('ticketId is required to create a sales deal');
  }

  if (!calculationSnapshot || typeof calculationSnapshot !== 'object') {
    throw new Error('calculationSnapshot is required to create a sales deal');
  }

  return {
    ticketId,
    calculationSnapshot,
    ...(leadId ? { leadId } : {}),
    ...(simulationId ? { simulationId } : {}),
    ...(proposalId ? { proposalId } : {}),
    ...(stage ? { stage } : {}),
    ...(metadata ? { metadata } : {}),
    ...(closedAt ? { closedAt } : {}),
  };
};

export const useSalesDeal = ({ fallbackTicketId } = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['chat', 'sales', 'deal', fallbackTicketId ?? null],
    mutationFn: async ({
      ticketId,
      calculationSnapshot,
      leadId = null,
      simulationId = null,
      proposalId = null,
      stage = null,
      metadata = null,
      closedAt = null,
    }) => {
      const resolvedTicketId = ticketId ?? fallbackTicketId;
      const payload = buildPayload({
        ticketId: resolvedTicketId,
        calculationSnapshot,
        leadId,
        simulationId,
        proposalId,
        stage,
        metadata,
        closedAt,
      });

      const response = await apiPost('/api/sales/deals', payload);
      return response?.data ?? null;
    },
    onSuccess: (result) => {
      const ticketId = result?.ticket?.id ?? fallbackTicketId ?? null;
      if (!ticketId) {
        queryClient.invalidateQueries({ queryKey: ['chat', 'tickets'] });
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['chat', 'ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'tickets'] });
    },
  });
};

export default useSalesDeal;
