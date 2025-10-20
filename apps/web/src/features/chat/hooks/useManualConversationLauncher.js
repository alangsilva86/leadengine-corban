import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api.js';
import { looksLikeWhatsAppJid } from '@/features/whatsapp/utils/instanceIdentifiers.js';

const sanitizePhone = (value) => String(value ?? '').replace(/\D/g, '');

const buildChatId = (value) => {
  if (!value) {
    return null;
  }

  if (looksLikeWhatsAppJid(value)) {
    return value;
  }

  const digits = sanitizePhone(value);
  if (!digits) {
    return null;
  }

  return digits;
};

export const useManualConversationLauncher = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationKey: ['lead-inbox', 'manual-conversation'],
    mutationFn: async ({ phone, message, instanceId }) => {
      const chatId = buildChatId(phone);
      const trimmedMessage = typeof message === 'string' ? message.trim() : '';
      const normalizedInstance = typeof instanceId === 'string' ? instanceId.trim() : '';

      if (!chatId) {
        throw new Error('Informe um telefone válido com DDD e país.');
      }

      if (!trimmedMessage) {
        throw new Error('Digite a mensagem inicial.');
      }

      if (!normalizedInstance) {
        throw new Error('Selecione uma instância conectada.');
      }

      const response = await apiPost('/api/tickets/messages', {
        chatId,
        iid: normalizedInstance,
        text: trimmedMessage,
        metadata: {
          origin: 'manual-conversation',
          phone: sanitizePhone(phone),
        },
      });

      const data = response?.data ?? response ?? null;

      return {
        ticket: data?.ticket ?? null,
        ticketId:
          data?.ticketId ??
          data?.ticket?.id ??
          data?.message?.ticketId ??
          null,
        message: data?.message ?? null,
        raw: data,
      };
    },
    onSuccess: (result) => {
      if (result?.ticketId) {
        queryClient.invalidateQueries({
          queryKey: ['chat', 'messages', result.ticketId],
        });
      }
      queryClient.invalidateQueries({ queryKey: ['chat', 'tickets'] });
    },
  });

  return {
    launch: (payload) => mutation.mutateAsync(payload),
    isPending: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
    isAvailable: true,
    unavailableReason: null,
  };
};

export default useManualConversationLauncher;
