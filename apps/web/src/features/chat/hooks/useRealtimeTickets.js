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

const registerHandler = (socket, event, handler) => {
  if (!socket || typeof handler !== 'function') {
    return;
  }
  socket.on(event, handler);
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

        console.info('🎯 LeadEngine • Chat :: 🚪 Abrindo canal tempo real', {
          tenantId,
          userId,
          ticketId,
          transports,
        });

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
          console.info('🎯 LeadEngine • Chat :: 🤝 Conectado ao tempo real', {
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

        socket.on('disconnect', () => {
          if (!isMounted) return;
          setConnected(false);
          console.info('🎯 LeadEngine • Chat :: 👋 Desconectado do tempo real', {
            tenantId,
            userId,
            ticketId: ticketRoomRef.current,
          });
        });

        socket.on('connect_error', (error) => {
          if (!isMounted) return;
          setConnectionError(error instanceof Error ? error.message : 'Falha ao conectar no tempo real');
          console.warn('🎯 LeadEngine • Chat :: ⚠️ Erro na conexão tempo real', {
            tenantId,
            userId,
            ticketId: ticketRoomRef.current,
            message: error instanceof Error ? error.message : error,
          });
        });

        socket.on('reconnect_failed', () => {
          if (!isMounted) return;
          setConnectionError('Não foi possível estabelecer conexão em tempo real. Continuaremos no modo offline.');
          console.warn('🎯 LeadEngine • Chat :: 💤 Reconnect falhou — seguindo em modo offline', {
            tenantId,
            userId,
            ticketId: ticketRoomRef.current,
          });
        });

        // Eventos do ticket bus
        const handleTicketEvent = (payload) => {
          console.info('🎯 LeadEngine • Chat :: 📨 Evento recebido', {
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
          console.info('🎯 LeadEngine • Chat :: 💬 Mensagem recebida', {
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
        const handleMessageUpdated = (payload) => {
          console.info('🎯 LeadEngine • Chat :: 🔄 Mensagem atualizada', {
            tenantId,
            ticketId: ticketRoomRef.current,
            messageId: payload?.message?.id ?? payload?.id ?? null,
          });
          handleTicketEvent(payload);
          if (typeof onMessageUpdated === 'function') {
            onMessageUpdated(payload);
          }
        };

        registerHandler(socket, 'messages.updated', handleMessageUpdated);
        registerHandler(socket, 'message:updated', handleMessageUpdated);
        registerHandler(socket, 'message.status.changed', (payload) => {
          console.info('🎯 LeadEngine • Chat :: 📬 Status de mensagem atualizado', {
            tenantId,
            ticketId: ticketRoomRef.current,
            status: payload?.status ?? null,
          });
          handleTicketEvent(payload);
          if (typeof onMessageStatusChanged === 'function') {
            onMessageStatusChanged(payload);
          }
        });
        registerHandler(socket, 'ticket.typing', (payload) => {
          console.info('🎯 LeadEngine • Chat :: ⌨️ Indicador de digitação recebido', {
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
          console.warn('🎯 LeadEngine • Chat :: 🚨 Fila padrão ausente', {
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

  return {
    connected,
    connectionError,
    socket: socketRef.current,
  };
};

export default useRealtimeTickets;
