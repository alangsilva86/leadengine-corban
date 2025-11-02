import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiPost } from '@/lib/api.js';
import { extractAiSuggestion } from '../utils/aiSuggestions.js';
import { sanitizeAiTimeline } from '../utils/aiTimeline.js';

const sanitizeTicket = (ticket) => {
  if (!ticket || typeof ticket !== 'object') {
    return null;
  }

  const contact = ticket.contact && typeof ticket.contact === 'object' ? ticket.contact : null;
  const lead = ticket.lead && typeof ticket.lead === 'object' ? ticket.lead : null;

  return {
    id: ticket.id ?? null,
    status: ticket.status ?? null,
    stage: lead?.stage ?? lead?.status ?? null,
    value: lead?.value ?? null,
    contact: contact
      ? {
          id: contact.id ?? null,
          name: contact.name ?? null,
          phone: contact.phone ?? contact.metadata?.phone ?? null,
        }
      : null,
    metadata: ticket.metadata ?? null,
  };
};

export const useAiSuggestions = ({ ticketId = null, tenantId = null } = {}) => {
  const mutationKey = useMemo(() => {
    const scope = ['chat', 'ai-suggestions'];
    if (tenantId) {
      scope.push(tenantId);
    }
    if (ticketId) {
      scope.push(ticketId);
    }
    return scope;
  }, [tenantId, ticketId]);

  const mutation = useMutation({
    mutationKey,
    mutationFn: async ({ ticket, timeline }) => {
      if (!ticket?.id) {
        throw new Error('Ticket inválido para solicitar ajuda da IA.');
      }

      const payload = {
        ticket: sanitizeTicket(ticket),
        timeline: sanitizeAiTimeline(timeline),
      };

      const response = await apiPost('/api/ai/suggest', payload, { rateLimitKey: 'ai-suggest' });
      return extractAiSuggestion(response ?? {});
    },
  });

  return {
    requestSuggestions: (payload) => mutation.mutateAsync(payload),
    isLoading: mutation.isPending,
    data: mutation.data ?? null,
    reset: mutation.reset,
    error: mutation.error,
  };
};

export default useAiSuggestions;
