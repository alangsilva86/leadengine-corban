import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiPost } from '@/lib/api.js';

const buildPayload = ({
  ticketId,
  calculationSnapshot,
  leadId = null,
  stage = null,
  metadata = null,
}) => {
  if (!ticketId) {
    throw new Error('ticketId is required to create a sales simulation');
  }

  if (!calculationSnapshot || typeof calculationSnapshot !== 'object') {
    throw new Error('calculationSnapshot is required to create a sales simulation');
  }

  return {
    ticketId,
    calculationSnapshot,
    ...(leadId ? { leadId } : {}),
    ...(stage ? { stage } : {}),
    ...(metadata ? { metadata } : {}),
  };
};

export const useSalesSimulation = ({ fallbackTicketId } = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['chat', 'sales', 'simulation', fallbackTicketId ?? null],
    mutationFn: async ({
      ticketId,
      calculationSnapshot,
      leadId = null,
      stage = null,
      metadata = null,
    }) => {
      const resolvedTicketId = ticketId ?? fallbackTicketId;
      const payload = buildPayload({
        ticketId: resolvedTicketId,
        calculationSnapshot,
        leadId,
        stage,
        metadata,
      });

      const response = await apiPost('/api/sales/simulate', payload);
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

export default useSalesSimulation;
