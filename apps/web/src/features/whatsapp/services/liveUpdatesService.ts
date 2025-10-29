import { useCallback, useEffect } from 'react';
import useInstanceLiveUpdates from '../hooks/useInstanceLiveUpdates.js';
import { parseRealtimeEvent } from '../utils/instanceSync.js';
import { useInstancesStore, useInstancesStoreBundle } from '../state/instancesStore';

export const useLiveUpdatesService = () => {
  const { store } = useInstancesStoreBundle();
  const tenantId = useInstancesStore((state) => state.config.tenantId);
  const canSynchronize = useInstancesStore(
    (state) => state.sessionActive && !state.authDeferred,
  );

  const onEvent = useCallback(
    (event: unknown) => {
      const parsed = parseRealtimeEvent(event);
      if (!parsed) {
        return;
      }

      store.getState().applyRealtimeEvent(parsed);

      if (parsed.type === 'updated' || parsed.type === 'created' || parsed.type === 'removed') {
        store.getState().requestLoad({
          reason: 'realtime',
          preferredInstanceId: parsed.instanceId,
        });
      }
    },
    [store],
  );

  const { connected } = useInstanceLiveUpdates({
    tenantId: tenantId ?? undefined,
    enabled: Boolean(tenantId) && canSynchronize,
    onEvent,
  });

  useEffect(() => {
    store.getState().setRealtimeConnected(connected);
  }, [connected, store]);
};
