import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_TIMEOUT_MS = 4000;

export const useTypingIndicator = ({ timeoutMs = DEFAULT_TIMEOUT_MS, socket } = {}) => {
  const [entries, setEntries] = useState([]);
  const timeoutRef = useRef();

  const prune = useCallback(() => {
    setEntries((current) => {
      const now = Date.now();
      return current.filter((entry) => entry.expiresAt > now);
    });
  }, []);

  const schedulePrune = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      prune();
    }, timeoutMs);
  }, [prune, timeoutMs]);

  const registerTypingEvent = useCallback(
    ({ ticketId, userId, userName }) => {
      if (!userId) {
        return;
      }
      const expiresAt = Date.now() + timeoutMs;
      setEntries((current) => {
        const next = current.filter((entry) => entry.userId !== userId);
        next.push({ userId, userName, ticketId, expiresAt });
        return next;
      });
      schedulePrune();
    },
    [schedulePrune, timeoutMs]
  );

  const broadcastTyping = useCallback(
    ({ ticketId }) => {
      if (!socket || !ticketId) {
        return;
      }
      socket.emit('ticket:typing', { ticketId, timestamp: Date.now() });
    },
    [socket]
  );

  useEffect(() => {
    prune();
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [prune]);

  const agentsTyping = entries.map(({ userId, userName }) => ({ userId, userName }));

  return {
    agentsTyping,
    registerTypingEvent,
    broadcastTyping,
  };
};

export default useTypingIndicator;
