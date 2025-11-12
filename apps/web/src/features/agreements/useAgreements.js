import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from '@/lib/api.js';

const DEFAULT_ERROR_MESSAGE = 'Falha ao carregar origens comerciais';

const useAgreements = () => {
  const [agreements, setAgreements] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const payload = await apiGet('/api/lead-engine/agreements');
      if (!isMountedRef.current) {
        return;
      }

      setAgreements(payload.data || []);
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) {
        return;
      }

      setError(err instanceof Error ? err.message : DEFAULT_ERROR_MESSAGE);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const retry = useCallback(async () => {
    setError(null);
    await fetch();
  }, [fetch]);

  useEffect(() => {
    fetch();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetch]);

  return {
    agreements,
    isLoading,
    error,
    fetch,
    retry,
  };
};

export default useAgreements;
