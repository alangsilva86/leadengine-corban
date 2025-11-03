import { useEffect, useState } from 'react';

export const useComposerMetrics = (composerRef, ticketId) => {
  const [composerHeight, setComposerHeight] = useState(0);

  useEffect(() => {
    const element = composerRef.current;
    if (!element) return undefined;

    const updateMetrics = () => {
      setComposerHeight(element.offsetHeight);
    };

    updateMetrics();

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(updateMetrics);
    observer.observe(element);
    return () => observer.disconnect();
  }, [composerRef, ticketId]);

  return { composerHeight };
};

export default useComposerMetrics;
