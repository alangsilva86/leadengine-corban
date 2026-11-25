import { useCallback, useMemo } from 'react';
import { buildConversationTimeline, normaliseMessages } from '../../../hooks/useConversationState.js';

const EMPTY_PAGES = [];

/**
 * Paginação das mensagens (carregar anteriores) + linha do tempo de reserva,
 * montada pelo mesmo construtor de `useConversationState`.
 */
export const useTicketMessages = (messagesQuery) => {
  const pages = messagesQuery?.data?.pages ?? EMPTY_PAGES;
  const timelineItems = useMemo(
    () => buildConversationTimeline({ messages: normaliseMessages(pages) }),
    [pages],
  );

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
