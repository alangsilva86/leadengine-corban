import { useCallback, useEffect, useMemo } from 'react';

const EMPTY = Object.freeze([]);

/**
 * Presença de outros atendentes na conversa aberta: quem está digitando (`typingAgents`) e quem está com ela
 * aberta (`viewers`). `broadcastTyping` é chamado pelo composer a cada alteração do texto.
 */
export const useWhatsAppPresence = ({ typingIndicator, ticketId }) => {
  const agentsTyping = typingIndicator?.agentsTyping;
  const typingAgents = useMemo(() => {
    if (!ticketId || !Array.isArray(agentsTyping)) {
      return EMPTY;
    }
    // O indicador recebe eventos do tenant inteiro (para a lista); aqui só os desta conversa.
    return agentsTyping.filter((agent) => agent?.ticketId === ticketId);
  }, [agentsTyping, ticketId]);

  const viewers = useMemo(() => {
    const byTicket = typingIndicator?.viewersByTicket;
    return (ticketId && Array.isArray(byTicket?.[ticketId]) ? byTicket[ticketId] : EMPTY);
  }, [ticketId, typingIndicator?.viewersByTicket]);

  const broadcast = typingIndicator?.broadcastTyping;
  const stop = typingIndicator?.stopTyping;

  const broadcastTyping = useCallback(
    ({ mode, hasText = true } = {}) => {
      if (!ticketId) return;
      if (!hasText) {
        stop?.({ ticketId });
        return;
      }
      broadcast?.({ ticketId, mode });
    },
    [broadcast, stop, ticketId]
  );

  // Trocar de conversa (ou fechá-la) encerra o "digitando" na anterior.
  useEffect(() => {
    if (!ticketId) return undefined;
    return () => stop?.({ ticketId });
  }, [stop, ticketId]);

  return { typingAgents, viewers, broadcastTyping };
};

export default useWhatsAppPresence;
