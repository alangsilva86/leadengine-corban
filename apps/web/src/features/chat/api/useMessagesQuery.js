import { useInfiniteQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api.js';

const DEFAULT_PAGE_SIZE = 40;

const buildPath = (ticketId, cursor, pageSize) => {
  const params = new URLSearchParams();
  params.set('limit', String(pageSize));
  params.set('sortOrder', 'desc');
  if (cursor) {
    params.set('cursor', cursor);
  }
  return `/api/tickets/${ticketId}/messages?${params.toString()}`;
};

export const useMessagesQuery = ({
  ticketId,
  enabled = true,
  pageSize = DEFAULT_PAGE_SIZE,
} = {}) => {
  return useInfiniteQuery({
    enabled: enabled && Boolean(ticketId),
    queryKey: ['chat', 'messages', ticketId, pageSize],
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage?.cursors?.next ?? null,
    queryFn: async ({ pageParam }) => {
      if (!ticketId) {
        return null;
      }

      const payload = await apiGet(buildPath(ticketId, pageParam, pageSize));
      const data = payload?.data ?? null;
      const items = Array.isArray(data?.items) ? data.items : [];

      return {
        ...data,
        items,
      };
    },
  });
};

export default useMessagesQuery;
