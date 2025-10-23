import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiPatch } from '@/lib/api.js';

export const useUpdateDealFields = ({ leadId } = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['chat', 'deal-update', leadId ?? null],
    mutationFn: async ({ targetLeadId, data }) => {
      const resolvedLeadId = targetLeadId ?? leadId;

      if (!resolvedLeadId) {
        throw new Error('leadId is required to update deal information');
      }

      if (!data || typeof data !== 'object') {
        throw new Error('data payload is required to update deal information');
      }

      const response = await apiPatch(
        `/api/leads/${encodeURIComponent(resolvedLeadId)}/deal`,
        data
      );

      return response?.data ?? null;
    },
    onSuccess: (lead) => {
      if (!lead?.id) {
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['chat', 'tickets'] });
      queryClient.invalidateQueries({ queryKey: ['leads', lead.id] });
    },
  });
};

export default useUpdateDealFields;

