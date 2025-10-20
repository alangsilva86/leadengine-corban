import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiPatch, apiPost } from '@/lib/api.js';

export const useUpsertContactEmail = ({ contactId } = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['chat', 'contact-email-upsert', contactId ?? null],
    mutationFn: async ({ emailId, targetContactId, data }) => {
      const resolvedContactId = targetContactId ?? contactId;
      if (!resolvedContactId) {
        throw new Error('contactId is required to upsert contact email');
      }

      if (!data || typeof data !== 'object' || !data.email) {
        throw new Error('email is required to upsert contact email');
      }

      const payload = {
        contactId: resolvedContactId,
        email: data.email,
        type: data.type ?? undefined,
        label: data.label ?? undefined,
        isPrimary: Boolean(data.isPrimary),
      };

      if (emailId) {
        const response = await apiPatch(
          `/api/contact-emails/${encodeURIComponent(emailId)}`,
          payload
        );
        return response?.data ?? null;
      }

      const response = await apiPost('/api/contact-emails', payload);
      return response?.data ?? null;
    },
    onSuccess: (email, { targetContactId }) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'tickets'] });
      if (email?.contactId) {
        queryClient.invalidateQueries({ queryKey: ['contacts', email.contactId] });
      }
      if (targetContactId) {
        queryClient.invalidateQueries({ queryKey: ['contacts', targetContactId] });
      }
    },
  });
};

export default useUpsertContactEmail;
