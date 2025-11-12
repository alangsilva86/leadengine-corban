import { useEffect, useRef } from 'react';

export const useAutoQr = ({
  store,
  autoGenerateQr,
  currentInstanceId,
  status,
  generatingQr,
  qrState,
}) => {
  const autoQrRef = useRef({ instanceId: null, timestamp: 0 });

  useEffect(() => {
    if (!autoGenerateQr) {
      return;
    }
    if (!currentInstanceId) {
      return;
    }
    if (status === 'connected') {
      return;
    }
    if (generatingQr) {
      return;
    }
    const existingExpires = qrState.instanceId === currentInstanceId ? qrState.expiresAt : null;
    if (existingExpires && existingExpires > Date.now()) {
      return;
    }
    const last = autoQrRef.current;
    if (last.instanceId === currentInstanceId && Date.now() - last.timestamp < 15_000) {
      return;
    }
    store
      .getState()
      .generateQr({
        instanceId: currentInstanceId,
        refresh: true,
      });
    autoQrRef.current = { instanceId: currentInstanceId, timestamp: Date.now() };
  }, [autoGenerateQr, currentInstanceId, generatingQr, qrState, status, store]);
};
