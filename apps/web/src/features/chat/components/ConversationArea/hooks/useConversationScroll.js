import { useEffect } from 'react';

const conversationScrollMemory = new Map();

export const useConversationScroll = ({
  scrollRef,
  ticketId,
  lastEntryKey,
  typingAgentsCount,
  scrollToBottom,
  onLoadMore,
}) => {
  useEffect(() => {
    scrollToBottom();
  }, [lastEntryKey, typingAgentsCount, scrollToBottom]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;

    const savedPosition = ticketId ? conversationScrollMemory.get(ticketId) : undefined;
    const hasWindow = typeof window !== 'undefined';
    const schedule =
      hasWindow && typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : (cb) => setTimeout(cb, 16);
    const cancelFn =
      hasWindow && typeof window.cancelAnimationFrame === 'function'
        ? window.cancelAnimationFrame.bind(window)
        : (handle) => clearTimeout(handle);

    const frame = schedule(() => {
      if (typeof savedPosition === 'number') {
        element.scrollTop = savedPosition;
      } else {
        scrollToBottom({ force: true });
      }
    });

    return () => {
      if (frame && typeof cancelFn === 'function') {
        cancelFn(frame);
      }
    };
  }, [scrollRef, scrollToBottom, ticketId]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;

    const handleScroll = () => {
      if (ticketId) {
        conversationScrollMemory.set(ticketId, element.scrollTop);
      }
      if (element.scrollTop < 80) {
        onLoadMore?.();
      }
    };

    element.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (ticketId) {
        conversationScrollMemory.set(ticketId, element.scrollTop);
      }
      element.removeEventListener('scroll', handleScroll);
    };
  }, [scrollRef, ticketId, onLoadMore]);
};

export default useConversationScroll;
