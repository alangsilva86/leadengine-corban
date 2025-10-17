import { useEffect, useState } from 'react';

export const useInboxAutoRefreshTimer = (nextRefreshAt) => {
  const [secondsRemaining, setSecondsRemaining] = useState(null);

  useEffect(() => {
    if (!nextRefreshAt) {
      setSecondsRemaining(null);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000));
      setSecondsRemaining(remaining);
    };

    updateCountdown();

    if (typeof window === 'undefined') {
      return;
    }

    const intervalId = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(intervalId);
  }, [nextRefreshAt]);

  return secondsRemaining;
};

export default useInboxAutoRefreshTimer;
