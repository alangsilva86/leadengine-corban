import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiPatch } from '@/lib/api.js';

export const useUpdateContactField = ({ contactId } = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['chat', 'contact-update', contactId ?? null],
    mutationFn: async ({ targetContactId, data }) => {
      const resolvedContactId = targetContactId ?? contactId;
      if (!resolvedContactId) {
        throw new Error('contactId is required to update contact information');
      }

      if (!data || typeof data !== 'object') {
        throw new Error('data payload is required to update contact information');
      }

      const response = await apiPatch(
        `/api/contacts/${encodeURIComponent(resolvedContactId)}`,
        data
      );

      return response?.data ?? null;
    },
    onSuccess: (contact) => {
      if (!contact?.id) {
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['chat', 'tickets'] });
      queryClient.invalidateQueries({ queryKey: ['contacts', contact.id] });
    },
  });
};

export default useUpdateContactField;
