import { useEffect, useRef, useSyncExternalStore } from 'react';

import {
  acquireRealtime,
  getRealtimeState,
  joinRealtimeRoom,
  reconnectRealtime,
  subscribeRealtimeEvent,
  subscribeRealtimeState,
} from './socket.js';

const IDLE = Object.freeze({ status: 'idle', connected: false, error: null });

/**
 * Mantém a conexão compartilhada aberta enquanto o componente estiver montado
 * e devolve o estado dela (`idle | connecting | connected | reconnecting | offline`).
 */
export const useRealtimeConnection = ({ enabled = true } = {}) => {
  useEffect(() => (enabled ? acquireRealtime() : undefined), [enabled]);
  const state = useSyncExternalStore(subscribeRealtimeState, getRealtimeState, getRealtimeState);
  const current = enabled ? state : IDLE;
  return { ...current, reconnect: reconnectRealtime };
};

/**
 * Assina um evento (ou lista de eventos) na conexão compartilhada.
 * O handler pode mudar a cada render sem reassinar; recebe `(payload, eventName)`.
 */
export const useRealtimeEvent = (events, handler, { enabled = true } = {}) => {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const key = Array.isArray(events) ? events.filter(Boolean).join('\n') : events || '';

  useEffect(() => {
    if (!enabled || !key) return undefined;
    const release = acquireRealtime();
    const unsubscribe = subscribeRealtimeEvent(key.split('\n'), (payload, event) => {
      handlerRef.current?.(payload, event);
    });
    return () => {
      unsubscribe();
      release();
    };
  }, [enabled, key]);
};

/** Entra na sala `kind:id` (ex.: `ticket`) enquanto montado; reentra sozinho ao reconectar. */
export const useRealtimeRoom = (kind, id, { enabled = true } = {}) => {
  useEffect(() => {
    if (!enabled || !kind || !id) return undefined;
    const release = acquireRealtime();
    const leave = joinRealtimeRoom(kind, id);
    return () => {
      leave();
      release();
    };
  }, [enabled, kind, id]);
};
