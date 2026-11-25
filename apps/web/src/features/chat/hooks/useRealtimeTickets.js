import { useRef } from 'react';

import { emitRealtime } from '@/lib/realtime/socket.js';
import { useRealtimeConnection, useRealtimeEvent, useRealtimeRoom } from '@/lib/realtime/useRealtime.js';

/**
 * Diagnóstico do canal em tempo real — só em desenvolvimento (em produção, um log por evento é ruído).
 * Cada chamada fica atrás de `import.meta.env.DEV`, que o build troca por `false` e remove.
 */
const debugRealtime = (message, details) => console.info(`[realtime] ${message}`, details);

const MESSAGE_UPDATED_EVENTS = ['messages.updated', 'message:updated'];

/**
 * Eventos de tickets/mensagens do Inbox sobre a conexão compartilhada (`@/lib/realtime`).
 * As salas do tenant e do usuário vêm do servidor (derivadas da sessão); aqui só entramos
 * na sala do ticket aberto.
 */
export const useRealtimeTickets = ({
  tenantId,
  ticketId,
  enabled = true,
  onTicketEvent,
  onTicketUpdated,
  onMessageCreated,
  onMessageUpdated,
  onMessageStatusChanged,
  onTyping,
  onViewers,
  onQueueMissing,
} = {}) => {
  const active = Boolean(enabled && tenantId);
  const callbacksRef = useRef({});
  callbacksRef.current = {
    onTicketEvent,
    onTicketUpdated,
    onMessageCreated,
    onMessageUpdated,
    onMessageStatusChanged,
    onTyping,
    onViewers,
    onQueueMissing,
  };
  const messageUpdateCacheRef = useRef(new Map());

  const connection = useRealtimeConnection({ enabled: active });
  useRealtimeRoom('ticket', ticketId, { enabled: active });

  const notifyTicketEvent = (payload) => {
    callbacksRef.current.onTicketEvent?.(payload);
  };

  useRealtimeEvent(
    'tickets.updated',
    (payload) => {
      if (import.meta.env.DEV) debugRealtime('Ticket atualizado', { ticketId: payload?.ticketId ?? null });
      notifyTicketEvent(payload);
      callbacksRef.current.onTicketUpdated?.(payload);
    },
    { enabled: active }
  );

  useRealtimeEvent(
    'messages.new',
    (payload) => {
      if (import.meta.env.DEV) debugRealtime('Mensagem recebida', {
        ticketId: payload?.ticketId ?? null,
        direction: payload?.message?.direction ?? null,
      });
      notifyTicketEvent(payload);
      callbacksRef.current.onMessageCreated?.(payload);
    },
    { enabled: active }
  );

  // `messages.updated` e `message:updated` são o mesmo fato com nomes diferentes: entrega uma vez.
  useRealtimeEvent(
    MESSAGE_UPDATED_EVENTS,
    (payload) => {
      const messageId = payload?.message?.id ?? payload?.id ?? null;
      const updatedAt =
        payload?.message?.updatedAt ?? payload?.updatedAt ?? payload?.message?.statusUpdatedAt ?? null;
      const cacheKeyBase = messageId ?? 'anonymous-message';
      const cacheKey = updatedAt ? `${cacheKeyBase}:${updatedAt}` : cacheKeyBase;
      if (messageUpdateCacheRef.current.get(cacheKeyBase) === cacheKey) {
        return;
      }
      messageUpdateCacheRef.current.set(cacheKeyBase, cacheKey);

      if (import.meta.env.DEV) debugRealtime('Mensagem atualizada', { messageId });
      notifyTicketEvent(payload);
      callbacksRef.current.onMessageUpdated?.(payload);
    },
    { enabled: active }
  );

  useRealtimeEvent(
    'message.status.changed',
    (payload) => {
      notifyTicketEvent(payload);
      callbacksRef.current.onMessageStatusChanged?.(payload);
    },
    { enabled: active }
  );

  // Presença de outros atendentes (digitando / com a conversa aberta). Não é mudança do ticket: não passa por
  // onTicketEvent.
  useRealtimeEvent(
    'ticket:typing',
    (payload) => {
      callbacksRef.current.onTyping?.(payload);
    },
    { enabled: active }
  );

  useRealtimeEvent(
    'ticket:viewers',
    (payload) => {
      callbacksRef.current.onViewers?.(payload);
    },
    { enabled: active }
  );

  useRealtimeEvent(
    'whatsapp.queue.missing',
    (payload) => {
      console.warn('[realtime] Fila padrão ausente', { tenantId, payload });
      callbacksRef.current.onQueueMissing?.(payload);
    },
    { enabled: active }
  );

  return {
    connected: connection.connected,
    connectionError: connection.error,
    status: connection.status,
    reconnect: connection.reconnect,
    emit: emitRealtime,
  };
};

export default useRealtimeTickets;
