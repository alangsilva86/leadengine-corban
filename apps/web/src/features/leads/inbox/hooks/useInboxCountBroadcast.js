import { useEffect } from 'react';

export const useInboxCountBroadcast = (count) => {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.dispatchEvent(new CustomEvent('leadengine:inbox-count', { detail: count }));
  }, [count]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    return () => {
      window.dispatchEvent(new CustomEvent('leadengine:inbox-count', { detail: 0 }));
    };
  }, []);
};

export default useInboxCountBroadcast;
