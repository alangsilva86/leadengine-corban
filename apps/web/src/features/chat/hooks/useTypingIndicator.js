import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { emitRealtime } from '@/lib/realtime/socket.js';

/**
 * Presença de outros atendentes nas conversas (prevenção de colisão no Inbox omnichannel).
 *
 * Recebe (`registerTypingEvent`/`registerViewersEvent`, ligados aos eventos `ticket:typing` e `ticket:viewers`
 * da conexão compartilhada) e envia (`broadcastTyping`/`stopTyping`) o "está digitando" do próprio atendente.
 *
 * - Quem digita reenvia `start` a cada `throttleMs` enquanto escreve e manda `stop` após `idleMs` parado, ao
 *   enviar, ao esvaziar o texto ou ao trocar de conversa.
 * - Do lado de quem vê, cada aviso expira sozinho em `timeoutMs` sem atualização (aba fechada, rede caiu…).
 * - Eventos do próprio usuário (outra aba) são ignorados. Nada disso chega ao cliente final.
 */
export const TYPING_EXPIRY_MS = 6_000;
export const TYPING_THROTTLE_MS = 2_500;
export const TYPING_IDLE_MS = 3_000;

const normalizeMode = (mode) => (mode === 'note' ? 'note' : 'reply');

const IDLE_OUTGOING = Object.freeze({ ticketId: null, mode: 'reply', lastStartAt: 0, idleTimer: null });

const clearIdleTimer = (outgoing) => {
  if (outgoing.idleTimer) {
    clearTimeout(outgoing.idleTimer);
    outgoing.idleTimer = null;
  }
};

export const useTypingIndicator = ({
  emit = emitRealtime,
  currentUserId = null,
  timeoutMs = TYPING_EXPIRY_MS,
  throttleMs = TYPING_THROTTLE_MS,
  idleMs = TYPING_IDLE_MS,
} = {}) => {
  const [entries, setEntries] = useState([]);
  const [viewersByTicket, setViewersByTicket] = useState({});
  const emitRef = useRef(emit);
  const currentUserIdRef = useRef(currentUserId);
  const outgoingRef = useRef({ ...IDLE_OUTGOING });

  useEffect(() => {
    emitRef.current = emit;
  }, [emit]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  /* ------------------------------------------------------------ recebidos ---- */

  const registerTypingEvent = useCallback(
    (payload) => {
      const userId = payload?.userId;
      const ticketId = payload?.ticketId;
      if (!userId || !ticketId) return;
      if (currentUserIdRef.current && userId === currentUserIdRef.current) return;

      if (payload.state === 'stop') {
        setEntries((current) => {
          const next = current.filter((entry) => !(entry.userId === userId && entry.ticketId === ticketId));
          return next.length === current.length ? current : next;
        });
        return;
      }

      const entry = {
        userId,
        userName: typeof payload.userName === 'string' && payload.userName.trim() ? payload.userName.trim() : null,
        ticketId,
        mode: normalizeMode(payload.mode),
        expiresAt: Date.now() + timeoutMs,
      };
      // Um atendente digita em uma conversa por vez: a entrada nova substitui a anterior dele.
      setEntries((current) => [...current.filter((item) => item.userId !== userId), entry]);
    },
    [timeoutMs]
  );

  const registerViewersEvent = useCallback((payload) => {
    const ticketId = payload?.ticketId;
    if (!ticketId) return;
    const viewers = (Array.isArray(payload.viewers) ? payload.viewers : [])
      .filter((viewer) => viewer?.userId && viewer.userId !== currentUserIdRef.current)
      .map((viewer) => ({ userId: viewer.userId, userName: viewer.userName ?? null }));
    setViewersByTicket((current) => ({ ...current, [ticketId]: viewers }));
  }, []);

  // Expira cada aviso no seu próprio prazo (o timer mira a entrada mais próxima de vencer).
  useEffect(() => {
    if (entries.length === 0) return undefined;
    const nextExpiry = Math.min(...entries.map((entry) => entry.expiresAt));
    const timer = setTimeout(() => {
      const now = Date.now();
      setEntries((current) => current.filter((entry) => entry.expiresAt > now));
    }, Math.max(0, nextExpiry - Date.now()));
    return () => clearTimeout(timer);
  }, [entries]);

  /* -------------------------------------------------------------- enviados ---- */

  const stopTyping = useCallback(({ ticketId } = {}) => {
    const outgoing = outgoingRef.current;
    if (!outgoing.ticketId || (ticketId && ticketId !== outgoing.ticketId)) return;
    clearIdleTimer(outgoing);
    emitRef.current?.('ticket:typing', { ticketId: outgoing.ticketId, state: 'stop', mode: outgoing.mode });
    outgoingRef.current = { ...IDLE_OUTGOING };
  }, []);

  const broadcastTyping = useCallback(
    ({ ticketId, mode } = {}) => {
      if (!ticketId || typeof emitRef.current !== 'function') return;
      const normalizedMode = normalizeMode(mode);
      const outgoing = outgoingRef.current;

      if (outgoing.ticketId && outgoing.ticketId !== ticketId) {
        stopTyping({ ticketId: outgoing.ticketId });
      }

      const current = outgoingRef.current;
      const now = Date.now();
      const sameTarget = current.ticketId === ticketId && current.mode === normalizedMode;
      if (!sameTarget || now - current.lastStartAt >= throttleMs) {
        emitRef.current('ticket:typing', { ticketId, state: 'start', mode: normalizedMode });
        current.ticketId = ticketId;
        current.mode = normalizedMode;
        current.lastStartAt = now;
      }

      clearIdleTimer(current);
      current.idleTimer = setTimeout(() => stopTyping({ ticketId }), idleMs);
    },
    [idleMs, stopTyping, throttleMs]
  );

  // Ao desmontar (sair do Inbox), quem estava digitando avisa que parou.
  useEffect(() => () => stopTyping(), [stopTyping]);

  const agentsTyping = useMemo(
    () => entries.map(({ userId, userName, ticketId, mode }) => ({ userId, userName, ticketId, mode })),
    [entries]
  );

  return {
    agentsTyping,
    viewersByTicket,
    registerTypingEvent,
    registerViewersEvent,
    broadcastTyping,
    stopTyping,
  };
};

export default useTypingIndicator;
