import { useCallback, useMemo } from 'react';

/**
 * Centraliza os dados de presença/typing do WhatsApp para reutilização entre componentes.
 */
export const useWhatsAppPresence = ({ typingIndicator, ticketId }) => {
  const typingAgents = useMemo(() => {
    if (!typingIndicator || !Array.isArray(typingIndicator.agentsTyping)) {
      return [];
    }

    return typingIndicator.agentsTyping;
  }, [typingIndicator]);

  const broadcastTyping = useCallback(() => {
    if (!typingIndicator?.broadcastTyping || !ticketId) {
      return;
    }
    typingIndicator.broadcastTyping({ ticketId });
  }, [ticketId, typingIndicator]);

  return { typingAgents, broadcastTyping };
};

export default useWhatsAppPresence;
