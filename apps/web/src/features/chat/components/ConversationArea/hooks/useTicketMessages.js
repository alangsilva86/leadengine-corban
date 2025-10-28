import { useMemo, useCallback } from 'react';

/**
 * Normaliza as páginas da query de mensagens em uma listagem ordenada cronologicamente.
 */
export const useTicketMessages = (messagesQuery) => {
  const pages = messagesQuery?.data?.pages ?? [];
  const timelineItems = useMemo(() => {
    const messages = [];

    for (const page of pages) {
      if (!page || !Array.isArray(page.items)) {
        continue;
      }

      for (const message of page.items) {
        messages.push(message);
      }
    }

    messages.sort((left, right) => {
      const leftTime = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right?.createdAt ? new Date(right.createdAt).getTime() : 0;
      return leftTime - rightTime;
    });

    return messages.map((entry) => ({
      type: 'message',
      id: entry.id,
      date: entry.createdAt ? new Date(entry.createdAt) : undefined,
      payload: entry,
    }));
  }, [pages]);

  const hasMore = Boolean(messagesQuery?.hasNextPage);
  const isLoadingMore = Boolean(messagesQuery?.isFetchingNextPage);
  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) {
      return;
    }
    messagesQuery?.fetchNextPage?.();
  }, [hasMore, isLoadingMore, messagesQuery]);

  const lastEntryKey = timelineItems.length
    ? timelineItems[timelineItems.length - 1]?.id ?? timelineItems.length
    : 0;

  return { timelineItems, hasMore, isLoadingMore, handleLoadMore, lastEntryKey };
};

export default useTicketMessages;
