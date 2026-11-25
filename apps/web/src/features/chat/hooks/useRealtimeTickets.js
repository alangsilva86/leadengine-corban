import { getAuthToken } from '@/lib/auth.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '@/lib/api.js';

/**
 * Diagnóstico do canal em tempo real — só em desenvolvimento (em produção, um log por evento é ruído).
 * Cada chamada fica atrás de `import.meta.env.DEV`, que o build troca por `false` e remove.
 */
const debugRealtime = (message, details) => console.info(`[realtime] ${message}`, details);

const resolveSocketUrl = () => {
  if (API_BASE_URL) {
    return API_BASE_URL;
  }
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return '';
};

const registerHandler = (socket, event, handler) => {
  if (!socket || typeof handler !== 'function') {
    return () => {};
  }

  const events = Array.isArray(event) ? event : [event];
  const uniqueEvents = [...new Set(events)];

  uniqueEvents.forEach((eventName) => {
    if (typeof socket.off === 'function') {
      socket.off(eventName, handler);
    }
    socket.on(eventName, handler);
  });

  return () => {
    uniqueEvents.forEach((eventName) => {
      if (typeof socket.off === 'function') {
        socket.off(eventName, handler);
      }
    });
  };
};

export const useRealtimeTickets = ({
  tenantId,
  userId,
  ticketId,
  enabled = true,
  onTicketEvent,
  onTicketUpdated,
  onMessageCreated,
  onMessageUpdated,
  onMessageStatusChanged,
  onTyping,
  onQueueMissing,
} = {}) => {
  const socketRef = useRef(null);
  const ticketRoomRef = useRef(null);
  const messageUpdateCacheRef = useRef(new Map());
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  // 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline'
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (!enabled || !tenantId) {
      return undefined;
    }

    let isMounted = true;
    setStatus('connecting');

    const connect = async () => {
      try {
        const { io } = await import('socket.io-client');
        if (!isMounted) {
          return;
        }

        const transports = ['websocket', 'polling'];

        if (import.meta.env.DEV) debugRealtime('Abrindo canal', {
          tenantId,
          userId,
          ticketId,
          transports,
        });

        const socket = io(resolveSocketUrl(), {
          path: '/socket.io',
          auth: (callback) => callback({ token: getAuthToken() }),
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
          setStatus('connected');
          if (import.meta.env.DEV) debugRealtime('Conectado', {
            tenantId,
            userId,
            ticketId: ticketRoomRef.current,
            socketId: socket.id,
          });
          socket.emit('join-tenant', tenantId);
          if (userId) {
            socket.emit('join-user', userId);
          }
          const currentTicket = ticketRoomRef.current;
          if (currentTicket) {
            socket.emit('join-ticket', currentTicket);
          }
        });

        socket.on('disconnect', (reason) => {
          if (!isMounted) return;
          setConnected(false);
          setStatus(reason === 'io client disconnect' ? 'offline' : 'reconnecting');
          if (import.meta.env.DEV) debugRealtime('Desconectado', {
            tenantId,
            userId,
            ticketId: ticketRoomRef.current,
          });
        });

        socket.on('connect_error', (error) => {
          if (!isMounted) return;
          setConnectionError(error instanceof Error ? error.message : 'Falha ao conectar no tempo real');
          setStatus((current) => (current === 'offline' ? current : 'reconnecting'));
          if (import.meta.env.DEV) debugRealtime('Erro na conexão', {
            tenantId,
            userId,
            ticketId: ticketRoomRef.current,
            message: error instanceof Error ? error.message : error,
          });
        });

        const handleReconnectFailed = () => {
          if (!isMounted) return;
          setConnectionError('Não foi possível estabelecer conexão em tempo real. Continuaremos no modo offline.');
          setStatus('offline');
          console.warn('[realtime] Reconexão falhou; o Inbox segue atualizando sem tempo real.', {
            tenantId,
            userId,
            ticketId: ticketRoomRef.current,
          });
        };

        // No socket.io v4 o evento `reconnect_failed` é emitido pelo Manager (`socket.io`),
        // não pelo socket — antes ele nunca disparava e a falha passava em silêncio.
        socket.on('reconnect_failed', handleReconnectFailed);
        if (socket.io && typeof socket.io.on === 'function') {
          socket.io.on('reconnect_failed', handleReconnectFailed);
        }

        // Eventos do ticket bus
        const handleTicketEvent = (payload) => {
          if (import.meta.env.DEV) debugRealtime('Evento recebido', {
            tenantId,
            userId,
            ticketId: ticketRoomRef.current,
            eventKeys: Object.keys(payload ?? {}),
          });
          if (typeof onTicketEvent === 'function') {
            onTicketEvent(payload);
          }
        };

        const handleTicketUpdated = (payload) => {
          handleTicketEvent(payload);
          if (typeof onTicketUpdated === 'function') {
            onTicketUpdated(payload);
          }
        };

        registerHandler(socket, 'tickets.updated', handleTicketUpdated);
        const handleMessageCreated = (payload) => {
          if (import.meta.env.DEV) debugRealtime('Mensagem recebida', {
            tenantId,
            ticketId: ticketRoomRef.current,
            direction: payload?.message?.direction ?? payload?.message?.Direction ?? null,
          });
          handleTicketEvent(payload);
          if (typeof onMessageCreated === 'function') {
            onMessageCreated(payload);
          }
        };

        registerHandler(socket, 'messages.new', handleMessageCreated);
        const messageUpdatedEvents = ['messages.updated', 'message:updated'];
        const handleMessageUpdated = (payload) => {
          const messageId = payload?.message?.id ?? payload?.id ?? null;
          const updatedAt =
            payload?.message?.updatedAt ?? payload?.updatedAt ?? payload?.message?.statusUpdatedAt ?? null;
          const cacheKeyBase = messageId ?? 'anonymous-message';
          const cacheKey = updatedAt ? `${cacheKeyBase}:${updatedAt}` : cacheKeyBase;
          const previousKey = messageUpdateCacheRef.current.get(cacheKeyBase);

          if (previousKey === cacheKey) {
            return;
          }

          messageUpdateCacheRef.current.set(cacheKeyBase, cacheKey);

          if (import.meta.env.DEV) debugRealtime('Mensagem atualizada', {
            tenantId,
            ticketId: ticketRoomRef.current,
            messageId: payload?.message?.id ?? payload?.id ?? null,
          });
          handleTicketEvent(payload);
          if (typeof onMessageUpdated === 'function') {
            onMessageUpdated(payload);
          }
        };

        registerHandler(socket, messageUpdatedEvents, handleMessageUpdated);
        registerHandler(socket, 'message.status.changed', (payload) => {
          if (import.meta.env.DEV) debugRealtime('Status de mensagem atualizado', {
            tenantId,
            ticketId: ticketRoomRef.current,
            status: payload?.status ?? null,
          });
          handleTicketEvent(payload);
          if (typeof onMessageStatusChanged === 'function') {
            onMessageStatusChanged(payload);
          }
        });
        registerHandler(socket, 'ticket:typing', (payload) => {
          if (import.meta.env.DEV) debugRealtime('Indicador de digitação recebido', {
            tenantId,
            ticketId: ticketRoomRef.current,
            from: payload?.userId ?? null,
          });
          handleTicketEvent(payload);
          if (typeof onTyping === 'function') {
            onTyping(payload);
          }
        });
        registerHandler(socket, 'whatsapp.queue.missing', (payload) => {
          console.warn('[realtime] Fila padrão ausente', {
            tenantId,
            payload,
          });
          if (typeof onQueueMissing === 'function') {
            onQueueMissing(payload);
          }
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setConnectionError(error instanceof Error ? error.message : 'Falha ao carregar socket.io-client');
        setStatus('offline');
      }
    };

    void connect();

    return () => {
      isMounted = false;
      const socket = socketRef.current;
      if (socket) {
        socket.disconnect();
      }
      socketRef.current = null;
      ticketRoomRef.current = null;
    };
  }, [enabled, onMessageCreated, onMessageStatusChanged, onQueueMissing, onTicketEvent, onTicketUpdated, onTyping, tenantId, userId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      ticketRoomRef.current = ticketId ?? null;
      return;
    }

    const previousTicket = ticketRoomRef.current;
    if (previousTicket && previousTicket !== ticketId) {
      socket.emit('leave-ticket', previousTicket);
    }
    if (ticketId) {
      socket.emit('join-ticket', ticketId);
      ticketRoomRef.current = ticketId;
    } else {
      ticketRoomRef.current = null;
    }
  }, [ticketId]);

  const reconnect = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || socket.connected || typeof socket.connect !== 'function') {
      return;
    }
    setStatus('connecting');
    socket.connect();
  }, []);

  // Ao voltar a internet, tenta reconectar sem esperar o usuário.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleOnline = () => reconnect();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [reconnect]);

  return {
    connected,
    connectionError,
    status,
    reconnect,
    socket: socketRef.current,
  };
};

export default useRealtimeTickets;
