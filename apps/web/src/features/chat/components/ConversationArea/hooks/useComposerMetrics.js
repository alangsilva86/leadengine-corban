import { useEffect, useState } from 'react';

export const useComposerMetrics = (composerRef, ticketId) => {
  const [composerHeight, setComposerHeight] = useState(0);
  const [composerOffset, setComposerOffset] = useState(96);

  useEffect(() => {
    const element = composerRef.current;
    if (!element) return undefined;

    const updateOffset = () => {
      const height = element.offsetHeight;
      setComposerHeight(height);
      setComposerOffset(height + 16);
    };

    updateOffset();

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(updateOffset);
    observer.observe(element);
    return () => observer.disconnect();
  }, [composerRef, ticketId]);

  return { composerHeight, composerOffset };
};

export default useComposerMetrics;
