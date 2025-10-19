import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const resolveSocketUrl = () => {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
};

const registerHandler = (socket, event, handler) => {
  if (!socket || typeof socket.on !== 'function') {
    return;
  }

  socket.on(event, handler);
};

const unregisterHandler = (socket, event, handler) => {
  if (!socket || typeof socket.off !== 'function') {
    return;
  }

  socket.off(event, handler);
};

export const useContactsLiveUpdates = ({ contactId, enabled = true } = {}) => {
  const queryClient = useQueryClient();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let active = true;

    const initialize = async () => {
      try {
        const { io } = await import('socket.io-client');
        if (!active) {
          return;
        }

        const socket = io(resolveSocketUrl(), {
          path: '/socket.io',
          transports: ['websocket', 'polling'],
          autoConnect: true,
        });

        socketRef.current = socket;

        const invalidateList = () => {
          queryClient.invalidateQueries({ queryKey: ['contacts'] });
        };

        const invalidateDetails = () => {
          if (!contactId) {
            return;
          }
          queryClient.invalidateQueries({ queryKey: ['contacts', 'details', contactId] });
        };

        const invalidateTimeline = () => {
          if (!contactId) {
            return;
          }
          queryClient.invalidateQueries({ queryKey: ['contacts', 'timeline', contactId] });
        };

        const invalidateTasks = () => {
          if (!contactId) {
            return;
          }
          queryClient.invalidateQueries({ queryKey: ['contacts', 'tasks', contactId] });
        };

        socket.on('connect', () => {
          if (contactId) {
            socket.emit('join-contact', contactId);
          }
        });

        socket.on('disconnect', () => {
          if (contactId) {
            socket.emit('leave-contact', contactId);
          }
        });

        const handleCreated = () => {
          invalidateList();
        };
        const handleUpdated = () => {
          invalidateList();
          invalidateDetails();
        };
        const handleTasksUpdated = () => {
          invalidateTasks();
        };
        const handleTimelineUpdated = () => {
          invalidateTimeline();
        };

        registerHandler(socket, 'contacts.created', handleCreated);
        registerHandler(socket, 'contacts.updated', handleUpdated);
        registerHandler(socket, 'contacts.tasks.updated', handleTasksUpdated);
        registerHandler(socket, 'contacts.timeline.updated', handleTimelineUpdated);

        socketRef.current.cleanupHandlers = () => {
          unregisterHandler(socket, 'contacts.created', handleCreated);
          unregisterHandler(socket, 'contacts.updated', handleUpdated);
          unregisterHandler(socket, 'contacts.tasks.updated', handleTasksUpdated);
          unregisterHandler(socket, 'contacts.timeline.updated', handleTimelineUpdated);
        };
      } catch (error) {
        console.warn('Failed to initialize contacts socket connection', error);
      }
    };

    initialize();

    return () => {
      active = false;
      const socket = socketRef.current;
      if (socket) {
        if (contactId) {
          socket.emit?.('leave-contact', contactId);
        }
        socket.cleanupHandlers?.();
        socket.removeAllListeners?.();
        socket.disconnect?.();
      }
      socketRef.current = null;
    };
  }, [contactId, enabled, queryClient]);
};

export default useContactsLiveUpdates;
