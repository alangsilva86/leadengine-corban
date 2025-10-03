import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api.js';

export const useTicketStatusMutation = ({ fallbackTicketId } = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['chat', 'ticket-status', fallbackTicketId ?? null],
    mutationFn: async ({ ticketId, status, reason }) => {
      const targetTicketId = ticketId ?? fallbackTicketId;
      if (!targetTicketId) {
        throw new Error('ticketId is required to update ticket status');
      }

      const payload = await apiPost(`/api/tickets/${targetTicketId}/status`, {
        status,
        reason,
      });

      return payload?.data ?? null;
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

export default useTicketStatusMutation;
