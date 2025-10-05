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
  onTicketStatusChanged,
  onTicketAssigned,
  onTicketClosed,
  onMessageCreated,
  onMessageStatusChanged,
  onNoteCreated,
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

        const token = getAuthToken();
        const transports = ['polling'];

        const socket = io(resolveSocketUrl(), {
          path: '/socket.io',
          transports,
          auth: token ? { token } : undefined,
          reconnectionAttempts: 3,
          timeout: 8000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
          if (!isMounted) return;
          setConnected(true);
          setConnectionError(null);
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
        });

        socket.on('connect_error', (error) => {
          if (!isMounted) return;
          setConnectionError(error instanceof Error ? error.message : 'Falha ao conectar no tempo real');
        });

        socket.on('reconnect_failed', () => {
          if (!isMounted) return;
          setConnectionError('Não foi possível estabelecer conexão em tempo real. Continuaremos no modo offline.');
        });

        // Eventos do ticket bus
        const handleTicketEvent = (payload) => {
          if (typeof onTicketEvent === 'function') {
            onTicketEvent(payload);
          }
        };

        registerHandler(socket, 'ticket.created', handleTicketEvent);
        registerHandler(socket, 'ticket.updated', (payload) => {
          handleTicketEvent(payload);
          if (typeof onTicketUpdated === 'function') {
            onTicketUpdated(payload);
          }
        });
        registerHandler(socket, 'ticket.status.changed', (payload) => {
          handleTicketEvent(payload);
          if (typeof onTicketStatusChanged === 'function') {
            onTicketStatusChanged(payload);
          }
        });
        registerHandler(socket, 'ticket.assigned', (payload) => {
          handleTicketEvent(payload);
          if (typeof onTicketAssigned === 'function') {
            onTicketAssigned(payload);
          }
        });
        registerHandler(socket, 'ticket.closed', (payload) => {
          handleTicketEvent(payload);
          if (typeof onTicketClosed === 'function') {
            onTicketClosed(payload);
          }
        });
        registerHandler(socket, 'ticket.note.created', (payload) => {
          handleTicketEvent(payload);
          if (typeof onNoteCreated === 'function') {
            onNoteCreated(payload);
          }
        });
        registerHandler(socket, 'ticket.message.created', (payload) => {
          handleTicketEvent(payload);
          if (typeof onMessageCreated === 'function') {
            onMessageCreated(payload);
          }
        });
        registerHandler(socket, 'ticket.message', (payload) => {
          handleTicketEvent(payload);
          if (typeof onMessageCreated === 'function') {
            onMessageCreated(payload);
          }
        });
        registerHandler(socket, 'message.status.changed', (payload) => {
          handleTicketEvent(payload);
          if (typeof onMessageStatusChanged === 'function') {
            onMessageStatusChanged(payload);
          }
        });
        registerHandler(socket, 'ticket.typing', (payload) => {
          handleTicketEvent(payload);
          if (typeof onTyping === 'function') {
            onTyping(payload);
          }
        });
        registerHandler(socket, 'whatsapp.queue.missing', (payload) => {
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
  }, [enabled, onMessageCreated, onMessageStatusChanged, onNoteCreated, onQueueMissing, onTicketAssigned, onTicketClosed, onTicketEvent, onTicketStatusChanged, onTicketUpdated, onTyping, tenantId, userId]);

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
