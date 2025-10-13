import { useEffect, useRef, useState } from 'react';

import { API_BASE_URL } from '@/lib/api.js';

const resolveSocketUrl = () => {
  if (API_BASE_URL) {
    return API_BASE_URL;
  }
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return '';
};

const EVENT_TYPE_MAP = {
  'whatsapp.instance.updated': 'updated',
  'whatsapp.instance.created': 'created',
  'whatsapp.instance.removed': 'removed',
  'whatsapp.instance.qr': 'qr',
};

const useInstanceLiveUpdates = ({ tenantId, enabled = true, onEvent }) => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    if (!enabled || !tenantId) {
      return undefined;
    }

    let isMounted = true;

    const connect = async () => {
      try {
        const { io } = await import('socket.io-client');
        if (!isMounted) {
          return;
        }

        const transports = ['websocket', 'polling'];

        const socket = io(resolveSocketUrl(), {
          path: '/socket.io',
          transports,
          withCredentials: true,
          reconnectionAttempts: 3,
          timeout: 8000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
          if (!isMounted) return;
          setConnected(true);
          setConnectionError(null);
          socket.emit('join-tenant', tenantId);
        });

        socket.on('disconnect', () => {
          if (!isMounted) return;
          setConnected(false);
        });

        socket.on('connect_error', (error) => {
          if (!isMounted) return;
          setConnectionError(error instanceof Error ? error.message : 'Falha ao conectar no tempo real');
        });

        socket.on('reconnect_failed', () => {
          if (!isMounted) return;
          setConnectionError('Não foi possível estabelecer conexão em tempo real. Continuaremos no modo offline.');
        });

        Object.entries(EVENT_TYPE_MAP).forEach(([eventName, type]) => {
          socket.on(eventName, (payload) => {
            if (typeof onEvent === 'function') {
              onEvent({ type, payload });
            }
          });
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setConnectionError(error instanceof Error ? error.message : 'Falha ao carregar socket.io-client');
      }
    };

    void connect();

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [enabled, onEvent, tenantId]);

  return {
    connected,
    connectionError,
  };
};

export default useInstanceLiveUpdates;
