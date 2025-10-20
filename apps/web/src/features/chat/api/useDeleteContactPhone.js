import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiDelete } from '@/lib/api.js';

export const useDeleteContactPhone = ({ contactId } = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['chat', 'contact-phone-delete', contactId ?? null],
    mutationFn: async ({ phoneId, targetContactId }) => {
      const resolvedPhoneId = phoneId;
      if (!resolvedPhoneId) {
        throw new Error('phoneId is required to delete contact phone');
      }

      await apiDelete(`/api/contact-phones/${encodeURIComponent(resolvedPhoneId)}`);

      return { phoneId: resolvedPhoneId, contactId: targetContactId ?? contactId ?? null };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'tickets'] });
      if (result?.contactId) {
        queryClient.invalidateQueries({ queryKey: ['contacts', result.contactId] });
      }
    },
  });
};

export default useDeleteContactPhone;
