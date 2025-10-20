import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiPatch, apiPost } from '@/lib/api.js';

export const useUpsertContactTag = ({ contactId } = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['chat', 'contact-tag-upsert', contactId ?? null],
    mutationFn: async ({ assignmentId, targetContactId, tagId }) => {
      const resolvedContactId = targetContactId ?? contactId;
      if (!resolvedContactId) {
        throw new Error('contactId is required to upsert contact tag');
      }

      if (!tagId) {
        throw new Error('tagId is required to upsert contact tag');
      }

      if (assignmentId) {
        const response = await apiPatch(
          `/api/tags/contact-tags/${encodeURIComponent(assignmentId)}`,
          { tagId }
        );
        return response?.data ?? null;
      }

      const response = await apiPost('/api/tags/contact-tags', {
        contactId: resolvedContactId,
        tagId,
      });

      return response?.data ?? null;
    },
    onSuccess: (assignment, { targetContactId }) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'tickets'] });

      const contactKey = assignment?.contactId ?? targetContactId ?? contactId ?? null;
      if (contactKey) {
        queryClient.invalidateQueries({ queryKey: ['contacts', contactKey] });
      }
    },
  });
};

export default useUpsertContactTag;
