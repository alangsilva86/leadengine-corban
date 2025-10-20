import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiPatch, apiPost } from '@/lib/api.js';

export const useUpsertContactPhone = ({ contactId } = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['chat', 'contact-phone-upsert', contactId ?? null],
    mutationFn: async ({ phoneId, targetContactId, data }) => {
      const resolvedContactId = targetContactId ?? contactId;
      if (!resolvedContactId) {
        throw new Error('contactId is required to upsert contact phone');
      }

      if (!data || typeof data !== 'object' || !data.phoneNumber) {
        throw new Error('phoneNumber is required to upsert contact phone');
      }

      const payload = {
        contactId: resolvedContactId,
        phoneNumber: data.phoneNumber,
        type: data.type ?? undefined,
        label: data.label ?? undefined,
        isPrimary: Boolean(data.isPrimary),
      };

      if (phoneId) {
        const response = await apiPatch(
          `/api/contact-phones/${encodeURIComponent(phoneId)}`,
          payload
        );

        return response?.data ?? null;
      }

      const response = await apiPost('/api/contact-phones', payload);
      return response?.data ?? null;
    },
    onSuccess: (phone, { targetContactId }) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'tickets'] });
      if (phone?.contactId) {
        queryClient.invalidateQueries({ queryKey: ['contacts', phone.contactId] });
      }
      if (targetContactId) {
        queryClient.invalidateQueries({ queryKey: ['contacts', targetContactId] });
      }
    },
  });
};

export default useUpsertContactPhone;
