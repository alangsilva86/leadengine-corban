import { useMutation } from '@tanstack/react-query';

import { apiPost } from '@/lib/api.js';

const sanitizePhone = (value) => String(value ?? '').replace(/\D/g, '');

export const useManualConversationLauncher = () => {
  const mutation = useMutation({
    mutationKey: ['lead-inbox', 'manual-conversation'],
    mutationFn: async ({ phone, message, instanceId }) => {
      const digits = sanitizePhone(phone);
      const trimmedMessage = typeof message === 'string' ? message.trim() : '';
      const normalizedInstanceId =
        typeof instanceId === 'string' ? instanceId.trim() : '';

      if (!digits) {
        throw new Error('Informe um telefone válido.');
      }

      const response = await apiPost('/api/manual-conversations', {
        phone: digits,
        message: trimmedMessage,
        instanceId: normalizedInstanceId,
      });

      const payload = response?.data ?? {};

      return {
        contact: payload.contact ?? null,
        lead: payload.lead ?? null,
        ticket: payload.ticket ?? null,
        messageRecord: payload.messageRecord ?? null,
        phone: payload.phone ?? digits,
        message: payload.message ?? trimmedMessage,
        instanceId: payload.instanceId ?? normalizedInstanceId,
      };
    },
  });

  return {
    launch: (payload) => mutation.mutateAsync(payload),
    isPending: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
};

export default useManualConversationLauncher;
