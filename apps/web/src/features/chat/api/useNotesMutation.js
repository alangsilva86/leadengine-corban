import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api.js';

export const useNotesMutation = ({ fallbackTicketId } = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['chat', 'notes', fallbackTicketId ?? null],
    mutationFn: async ({ ticketId, body, visibility, tags, metadata }) => {
      const targetTicketId = ticketId ?? fallbackTicketId;
      if (!targetTicketId) {
        throw new Error('ticketId is required to append a note');
      }

      const payload = await apiPost(`/api/tickets/${targetTicketId}/notes`, {
        body,
        visibility,
        tags,
        metadata,
      });

      return payload?.data ?? null;
    },
    onSuccess: (note) => {
      if (!note?.ticketId) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['chat', 'tickets'] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'ticket', note.ticketId] });
    },
  });
};

export default useNotesMutation;
