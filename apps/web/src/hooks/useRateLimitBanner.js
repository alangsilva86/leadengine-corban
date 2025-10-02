import { useEffect, useState } from 'react';

const parseHeaderNumber = (value) => {
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const useRateLimitBanner = () => {
  const [state, setState] = useState({
    limit: null,
    remaining: null,
    resetSeconds: null,
    retryAfter: null,
    show: false,
  });

  useEffect(() => {
    const handler = (event) => {
      const detail = event.detail || {};
      const limit = parseHeaderNumber(detail.limit);
      const remaining = parseHeaderNumber(detail.remaining);
      const resetSeconds = parseHeaderNumber(detail.reset);
      const retryAfter = parseHeaderNumber(detail.retryAfter);

      if (remaining !== null && limit !== null && remaining <= Math.max(1, Math.floor(limit * 0.1))) {
        setState({
          limit,
          remaining,
          resetSeconds,
          retryAfter,
          show: true,
        });
      } else {
        setState((prev) => ({ ...prev, show: false }));
      }
    };

    window.addEventListener('leadengine:rate-limit', handler);
    return () => {
      window.removeEventListener('leadengine:rate-limit', handler);
    };
  }, []);

  return state;
};

export default useRateLimitBanner;
