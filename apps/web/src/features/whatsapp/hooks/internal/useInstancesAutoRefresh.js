import { useEffect, useRef } from 'react';

const DEFAULT_POLL_INTERVAL_MS = 15_000;

const isDocumentHidden = () => typeof document !== 'undefined' && document.hidden === true;

/**
 * Atualiza a lista de números por polling só quando o tempo real não está conectado.
 * - Com o socket conectado, as mudanças chegam por eventos; o polling fica parado.
 * - Com a aba oculta (e `pauseWhenHidden`), os ciclos são pulados; ao voltar, a lista é recarregada.
 * - Se o socket cair, recarrega na hora e retoma o polling.
 */
export const useInstancesAutoRefresh = ({
  api,
  autoRefresh,
  pauseWhenHidden,
  sessionActive,
  authDeferred,
  realtimeConnected = false,
}) => {
  useEffect(() => {
    if (!autoRefresh || realtimeConnected || !api?.loadInstances) {
      return undefined;
    }
    const interval = setInterval(() => {
      if (pauseWhenHidden && isDocumentHidden()) {
        return;
      }
      void api.loadInstances({ reason: 'auto' });
    }, DEFAULT_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [api, autoRefresh, pauseWhenHidden, realtimeConnected]);

  // Tempo real caiu: recarrega imediatamente em vez de esperar o próximo ciclo.
  const wasConnectedRef = useRef(realtimeConnected);
  useEffect(() => {
    const wasConnected = wasConnectedRef.current;
    wasConnectedRef.current = realtimeConnected;
    if (!autoRefresh || !api?.loadInstances || !wasConnected || realtimeConnected) {
      return;
    }
    if (sessionActive && !authDeferred && !(pauseWhenHidden && isDocumentHidden())) {
      void api.loadInstances({ reason: 'auto' });
    }
  }, [api, autoRefresh, pauseWhenHidden, realtimeConnected, sessionActive, authDeferred]);

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
