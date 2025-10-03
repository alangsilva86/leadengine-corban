import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api.js';

export const useTicketAssignMutation = ({ fallbackTicketId } = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['chat', 'ticket-assign', fallbackTicketId ?? null],
    mutationFn: async ({ ticketId, userId }) => {
      const targetTicketId = ticketId ?? fallbackTicketId;
      if (!targetTicketId) {
        throw new Error('ticketId is required to assign ticket');
      }
      if (!userId) {
        throw new Error('userId is required to assign ticket');
      }

      const payload = await apiPost(`/api/tickets/${targetTicketId}/assign`, {
        userId,
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

export default useTicketAssignMutation;
