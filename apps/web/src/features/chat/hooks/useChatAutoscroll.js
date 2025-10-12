import { useCallback, useEffect, useRef } from 'react';

/**
 * Keeps the chat timeline pinned to the bottom when the user is close to it.
 * Prevents hijacking the scroll position if the user is reading older messages.
 *
 * @returns {{ scrollRef: import('react').MutableRefObject<HTMLElement | null>, scrollToBottom: () => void }}
 */
export const useChatAutoscroll = () => {
  const scrollRef = useRef(null);
  const atBottomRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    const element = scrollRef.current;
    if (!element || !atBottomRef.current) return;
    element.scrollTop = element.scrollHeight;
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;

    const handleScroll = () => {
      const threshold = 96; // pixels from the bottom
      const distanceFromBottom = element.scrollHeight - element.clientHeight - element.scrollTop;
      atBottomRef.current = distanceFromBottom <= threshold;
    };

    handleScroll();
    element.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      element.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => {
      if (atBottomRef.current) {
        scrollToBottom();
      }
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [scrollToBottom]);

  return {
    scrollRef,
    scrollToBottom,
  };
};

export default useChatAutoscroll;
