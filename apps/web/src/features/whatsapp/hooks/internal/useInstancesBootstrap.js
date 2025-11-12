import { useEffect, useRef } from 'react';

export const useInstancesBootstrap = ({
  store,
  api,
  logger,
  providerConfig,
}) => {
  const hasFetchedOnceRef = useRef(false);

  useEffect(() => {
    store.getState().hydrateFromCache();
  }, [store]);

  useEffect(() => {
    store.getState().setConfig(providerConfig);
  }, [store, providerConfig]);

  useEffect(() => {
    if (!providerConfig.initialFetch) {
      return undefined;
    }
    if (!api?.loadInstances) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const result = await api.loadInstances({ reason: 'startup' });
      if (cancelled) {
        return;
      }
      if (!result.success && result.error) {
        logger.warn?.('Falha ao carregar instâncias WhatsApp durante o boot', result.error);
      } else if (result.success) {
        hasFetchedOnceRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, logger, providerConfig.initialFetch]);
};
