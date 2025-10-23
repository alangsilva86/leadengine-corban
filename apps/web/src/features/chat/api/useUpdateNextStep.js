import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiPatch } from '@/lib/api.js';

export const useUpdateNextStep = ({ ticketId } = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['chat', 'ticket-next-step', ticketId ?? null],
    mutationFn: async ({ targetTicketId, description, metadata } = {}) => {
      const resolvedTicketId = targetTicketId ?? ticketId;

      if (!resolvedTicketId) {
        throw new Error('ticketId is required to update the next step');
      }

      const payload = {};

      if (description !== undefined) {
        payload.description = description;
      }

      if (metadata && typeof metadata === 'object') {
        payload.metadata = metadata;
      }

      const response = await apiPatch(
        `/api/tickets/${encodeURIComponent(resolvedTicketId)}/next-step`,
        payload
      );

      return response?.data ?? null;
    },
    onSuccess: (ticket) => {
      if (!ticket?.id) {
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['chat', 'tickets'] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'ticket', ticket.id] });
    },
  });
};

export default useUpdateNextStep;
