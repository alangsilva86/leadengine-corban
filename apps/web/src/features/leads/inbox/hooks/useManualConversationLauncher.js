import { useMutation } from '@tanstack/react-query';

import { apiGet, apiPost } from '@/lib/api.js';

const sanitizePhone = (value) => String(value ?? '').replace(/\D/g, '');

const fetchContactByPhone = async (digits) => {
  if (!digits) {
    return null;
  }

  const response = await apiGet(`/api/contacts?phone=${encodeURIComponent(digits)}`);
  const items = response?.data?.items;
  if (Array.isArray(items) && items.length > 0) {
    return items[0];
  }

  return null;
};

const createContact = async (digits) => {
  const defaultName = `Contato ${digits}`;
  const response = await apiPost('/api/contacts', {
    name: defaultName,
    phone: digits,
  });
  return response?.data ?? null;
};

export const useManualConversationLauncher = () => {
  const mutation = useMutation({
    mutationKey: ['lead-inbox', 'manual-conversation'],
    mutationFn: async ({ phone, message }) => {
      const digits = sanitizePhone(phone);
      const trimmedMessage = typeof message === 'string' ? message.trim() : '';

      if (!digits) {
        throw new Error('Informe um telefone válido.');
      }

      let contact = await fetchContactByPhone(digits);

      if (!contact) {
        try {
          contact = await createContact(digits);
        } catch (error) {
          const status = error?.status ?? error?.statusCode;
          if (status === 409) {
            contact = await fetchContactByPhone(digits);
          } else {
            throw error;
          }
        }
      }

      if (!contact) {
        throw new Error('Não foi possível localizar ou criar o contato.');
      }

      const leadResponse = await apiPost('/api/leads', {
        contactId: contact.id,
        source: 'WHATSAPP',
        notes: trimmedMessage || undefined,
      });

      const lead = leadResponse?.data ?? null;

      return {
        contact,
        lead,
        phone: digits,
        message: trimmedMessage,
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
