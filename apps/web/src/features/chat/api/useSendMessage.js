import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api.js';

export const useSendMessage = ({ fallbackTicketId } = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['chat', 'send-message', fallbackTicketId ?? null],
    mutationFn: async ({
      ticketId,
      content,
      type = 'TEXT',
      mediaUrl,
      mediaMimeType,
      mediaFileName,
      caption,
      quotedMessageId,
      metadata,
      instanceId,
    }) => {
      const targetTicketId = ticketId ?? fallbackTicketId;
      if (!targetTicketId) {
        throw new Error('ticketId is required to send a message');
      }

      const payload = await apiPost('/api/tickets/messages', {
        ticketId: targetTicketId,
        content,
        type,
        mediaUrl,
        mediaMimeType,
        mediaFileName,
        caption,
        quotedMessageId,
        metadata,
        instanceId,
      });

      return payload?.data ?? null;
    },
    onSuccess: (message) => {
      if (!message?.ticketId) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', message.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'tickets'] });
    },
  });
};

export default useSendMessage;
