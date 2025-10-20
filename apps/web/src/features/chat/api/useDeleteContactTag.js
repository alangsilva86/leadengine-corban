import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiDelete } from '@/lib/api.js';

export const useDeleteContactTag = ({ contactId } = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['chat', 'contact-tag-delete', contactId ?? null],
    mutationFn: async ({ assignmentId, targetContactId }) => {
      if (!assignmentId) {
        throw new Error('assignmentId is required to delete contact tag');
      }

      await apiDelete(`/api/tags/contact-tags/${encodeURIComponent(assignmentId)}`);

      return { assignmentId, contactId: targetContactId ?? contactId ?? null };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'tickets'] });
      if (result?.contactId) {
        queryClient.invalidateQueries({ queryKey: ['contacts', result.contactId] });
      }
    },
  });
};

export default useDeleteContactTag;
