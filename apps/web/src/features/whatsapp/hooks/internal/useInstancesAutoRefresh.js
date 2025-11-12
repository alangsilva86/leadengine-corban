import { useEffect } from 'react';

const DEFAULT_POLL_INTERVAL_MS = 15_000;

export const useInstancesAutoRefresh = ({
  api,
  autoRefresh,
  pauseWhenHidden,
  sessionActive,
  authDeferred,
}) => {
  useEffect(() => {
    if (!autoRefresh || !api?.loadInstances) {
      return undefined;
    }
    const interval = setInterval(() => {
      void api.loadInstances({ reason: 'auto' });
    }, DEFAULT_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [api, autoRefresh]);

  useEffect(() => {
    if (!autoRefresh || !pauseWhenHidden || typeof document === 'undefined' || !api?.loadInstances) {
      return undefined;
    }
    const handler = () => {
      if (!document.hidden && sessionActive && !authDeferred) {
        const jitter = 200 + Math.floor(Math.random() * 400);
        setTimeout(() => {
          void api.loadInstances({ forceRefresh: true, reason: 'manual' });
        }, jitter);
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [api, autoRefresh, pauseWhenHidden, sessionActive, authDeferred]);
};
