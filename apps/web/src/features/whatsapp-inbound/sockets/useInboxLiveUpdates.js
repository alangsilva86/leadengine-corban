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

export const useInboxLiveUpdates = ({ tenantId, enabled = true, onLead }) => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const fallbackAttemptedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !tenantId) {
      return undefined;
    }

    let isMounted = true;
    fallbackAttemptedRef.current = false;

    const connect = async () => {
      try {
        const { io } = await import('socket.io-client');
        if (!isMounted) {
          return;
        }

        const initializeSocket = (transports) => {
          if (!isMounted) {
            return;
          }

          if (socketRef.current) {
            socketRef.current.removeAllListeners();
            socketRef.current.disconnect();
          }

          console.info(
            '🎯 LeadEngine • Inbox :: 🚪 Abrindo canal tempo real',
            {
              tenantId,
              transports,
            }
          );

          const socket = io(resolveSocketUrl(), {
            path: '/socket.io',
            transports,
            withCredentials: true,
          });

          socketRef.current = socket;

          socket.on('connect', () => {
            if (!isMounted) return;
            setConnected(true);
            setConnectionError(null);
            console.info('🎯 LeadEngine • Inbox :: 🤝 Conectado ao tempo real', {
              tenantId,
              transports,
              socketId: socket.id,
            });
            socket.emit('join-tenant', tenantId);
          });

          socket.on('disconnect', () => {
            if (!isMounted) return;
            setConnected(false);
            console.info('🎯 LeadEngine • Inbox :: 👋 Conexão encerrada', {
              tenantId,
              socketId: socket.id,
            });
          });

          socket.on('connect_error', (error) => {
            if (!isMounted) return;
            const message =
              error instanceof Error
                ? error.message
                : 'Falha ao conectar no tempo real';
            setConnectionError(message);
            console.warn('🎯 LeadEngine • Inbox :: ⚠️ Erro ao conectar no tempo real', {
              tenantId,
              transports,
              message,
            });

            if (transports.includes('websocket') && !fallbackAttemptedRef.current) {
              fallbackAttemptedRef.current = true;
              setConnected(false);
              setConnectionError('Falha ao conectar via WebSocket. Tentando reconectar via polling.');
              console.info('🎯 LeadEngine • Inbox :: 🔁 Tentando fallback para polling', {
                tenantId,
              });
              initializeSocket(['polling']);
            }
          });

          const notifyLeadUpdate = (payload) => {
            console.info('🎯 LeadEngine • Inbox :: 📨 Atualização recebida', {
              tenantId,
              hasPayload: Boolean(payload),
            });
            if (typeof onLead === 'function') {
              onLead(payload);
            }
          };

          socket.on('tickets.updated', notifyLeadUpdate);
        };

        initializeSocket(['websocket', 'polling']);
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
      fallbackAttemptedRef.current = false;
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
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
