import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiDelete } from '@/lib/api.js';

export const useDeleteContactEmail = ({ contactId } = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['chat', 'contact-email-delete', contactId ?? null],
    mutationFn: async ({ emailId, targetContactId }) => {
      const resolvedEmailId = emailId;
      if (!resolvedEmailId) {
        throw new Error('emailId is required to delete contact email');
      }

      await apiDelete(`/api/contact-emails/${encodeURIComponent(resolvedEmailId)}`);

      return { emailId: resolvedEmailId, contactId: targetContactId ?? contactId ?? null };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'tickets'] });
      if (result?.contactId) {
        queryClient.invalidateQueries({ queryKey: ['contacts', result.contactId] });
      }
    },
  });
};

export default useDeleteContactEmail;
