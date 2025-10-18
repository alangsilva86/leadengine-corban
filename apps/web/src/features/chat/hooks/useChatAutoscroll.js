import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Keeps the chat timeline pinned to the bottom when the user is close to it.
 * Prevents hijacking the scroll position if the user is reading older messages.
 *
 * @returns {{
 *   scrollRef: import('react').MutableRefObject<HTMLElement | null>,
 *   scrollToBottom: (options?: { behavior?: ScrollBehavior, force?: boolean }) => void,
 *   isNearBottom: boolean
 * }}
 */
export const useChatAutoscroll = () => {
  const scrollRef = useRef(null);
  const atBottomRef = useRef(true);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const scrollToBottom = useCallback(({ behavior = 'auto', force = false } = {}) => {
    const element = scrollRef.current;
    if (!element) return;
    if (!force && !atBottomRef.current) return;

    const target = element.scrollHeight;
    if (typeof element.scrollTo === 'function') {
      element.scrollTo({ top: target, behavior });
    } else {
      element.scrollTop = target;
    }
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;

    const handleScroll = () => {
      const threshold = 96; // pixels from the bottom
      const distanceFromBottom = element.scrollHeight - element.clientHeight - element.scrollTop;
      const nearBottom = distanceFromBottom <= threshold;
      atBottomRef.current = nearBottom;
      setIsNearBottom(nearBottom);
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
    isNearBottom,
  };
};

export default useChatAutoscroll;
