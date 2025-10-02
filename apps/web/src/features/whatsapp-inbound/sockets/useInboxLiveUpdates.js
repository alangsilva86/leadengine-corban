import { useEffect, useRef, useState } from 'react';

import { API_BASE_URL } from '@/lib/api.js';
import { getAuthToken } from '@/lib/auth.js';

const resolveSocketUrl = () => {
  if (API_BASE_URL) {
    return API_BASE_URL;
  }
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return '';
};

export const useInboxLiveUpdates = ({ tenantId, enabled = true, onLead }) => {
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

        const token = getAuthToken();
        const socket = io(resolveSocketUrl(), {
          path: '/socket.io',
          transports: ['websocket'],
          auth: token ? { token } : undefined,
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

        socket.on('leadengine:inbox:new', (payload) => {
          if (typeof onLead === 'function') {
            onLead(payload);
          }
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
  }, [enabled, onLead, tenantId]);

  return {
    connected,
    connectionError,
  };
};

export default useInboxLiveUpdates;
