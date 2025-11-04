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

      const applyNote = (ticket) => {
        if (!ticket || ticket.id !== note.ticketId) {
          return ticket;
        }
        const existing = Array.isArray(ticket.notes) ? ticket.notes : [];
        const alreadyPresent = existing.some((entry) => entry?.id === note.id);
        if (alreadyPresent) {
          return ticket;
        }
        const nextNotes = [...existing, note].sort((a, b) => {
          const left = new Date(a?.createdAt ?? a?.updatedAt ?? 0).getTime();
          const right = new Date(b?.createdAt ?? b?.updatedAt ?? 0).getTime();
          return left - right;
        });
        return {
          ...ticket,
          notes: nextNotes,
        };
      };

      const ticketsQueries = queryClient.getQueryCache().findAll({ queryKey: ['chat', 'tickets'] });
      ticketsQueries.forEach(({ queryKey }) => {
        queryClient.setQueryData(queryKey, (current) => {
          if (!current || !Array.isArray(current.items)) return current;
          return {
            ...current,
            items: current.items.map(applyNote),
          };
        });
      });

      queryClient.setQueryData(['chat', 'ticket', note.ticketId], (current) => {
        if (!current) return current;
        return applyNote(current);
      });

      queryClient.invalidateQueries({ queryKey: ['chat', 'tickets'] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'ticket', note.ticketId] });
    },
  });
};

export default useNotesMutation;
