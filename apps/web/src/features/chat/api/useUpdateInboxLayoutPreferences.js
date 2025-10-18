import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch } from '@/lib/api.js';
import {
  DEFAULT_INBOX_LAYOUT_PREFERENCES,
  INBOX_LAYOUT_PREFERENCES_QUERY_KEY,
  MIN_INBOX_LIST_WIDTH,
  MAX_INBOX_LIST_WIDTH,
} from './useInboxLayoutPreferences.js';

const clampWidth = (value) => {
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(Math.max(Math.round(value), MIN_INBOX_LIST_WIDTH), MAX_INBOX_LIST_WIDTH);
};

export const useUpdateInboxLayoutPreferences = ({ userId } = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (partial) => {
      if (!userId) {
        throw new Error('userId is required to persist inbox layout preferences');
      }

      const payload = {};
      if (partial?.inboxListWidth !== undefined) {
        const nextWidth = clampWidth(Number(partial.inboxListWidth));
        if (nextWidth !== undefined) {
          payload.inboxListWidth = nextWidth;
        }
      }

      if (Object.keys(payload).length === 0) {
        return queryClient.getQueryData(INBOX_LAYOUT_PREFERENCES_QUERY_KEY) ?? DEFAULT_INBOX_LAYOUT_PREFERENCES;
      }

      const response = await apiPatch(`/api/users/${userId}/preferences`, payload);
      return response?.data ?? payload;
    },
    onMutate: async (partial) => {
      await queryClient.cancelQueries({ queryKey: INBOX_LAYOUT_PREFERENCES_QUERY_KEY });
      const previous = queryClient.getQueryData(INBOX_LAYOUT_PREFERENCES_QUERY_KEY);

      queryClient.setQueryData(INBOX_LAYOUT_PREFERENCES_QUERY_KEY, (current) => {
        const { inboxListPosition: _ignoredPosition, ...rest } = current ?? {};
        const nextWidth =
          clampWidth(Number(partial?.inboxListWidth)) ?? rest?.inboxListWidth ?? DEFAULT_INBOX_LAYOUT_PREFERENCES.inboxListWidth;

        return {
          ...DEFAULT_INBOX_LAYOUT_PREFERENCES,
          ...rest,
          inboxListWidth: nextWidth,
        };
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(INBOX_LAYOUT_PREFERENCES_QUERY_KEY, context.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(INBOX_LAYOUT_PREFERENCES_QUERY_KEY, (current) => {
        const { inboxListPosition: _ignoredPosition, ...rest } = current ?? {};
        const { inboxListPosition: _ignoredReturnedPosition, ...normalizedData } = data ?? {};
        return {
          ...DEFAULT_INBOX_LAYOUT_PREFERENCES,
          ...rest,
          ...normalizedData,
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: INBOX_LAYOUT_PREFERENCES_QUERY_KEY });
    },
  });
};

export default useUpdateInboxLayoutPreferences;
