import { useMutation } from '@tanstack/react-query';
import { apiPost } from '@/lib/api.js';
import { extractAiSuggestion } from '../utils/aiSuggestions.js';

const MAX_TIMELINE_ITEMS = 50;

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

const sanitizeTimeline = (timeline) => {
  if (!Array.isArray(timeline)) {
    return [];
  }

  const slice = timeline.slice(-MAX_TIMELINE_ITEMS);

  return slice.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return entry ?? null;
    }

    const payload = entry.payload && typeof entry.payload === 'object' ? entry.payload : null;
    const content = payload?.content ?? payload?.text ?? payload?.body ?? null;

    return {
      id: entry.id ?? null,
      type: entry.type ?? payload?.type ?? payload?.messageType ?? null,
      timestamp: entry.timestamp ?? payload?.timestamp ?? payload?.createdAt ?? null,
      payload: payload
        ? {
            id: payload.id ?? null,
            direction: payload.direction ?? payload.metadata?.direction ?? null,
            author:
              payload.author ??
              payload.userName ??
              payload.agentName ??
              payload.contact?.name ??
              payload.metadata?.contactName ??
              null,
            role: payload.role ?? payload.direction ?? null,
            content,
            channel: payload.channel ?? payload.metadata?.channel ?? null,
            attachments: Array.isArray(payload.attachments) ? payload.attachments : undefined,
          }
        : entry.payload ?? entry,
    };
  });
};

export const useAiSuggestions = () => {
  const mutation = useMutation({
    mutationKey: ['chat', 'ai-suggestions'],
    mutationFn: async ({ ticket, timeline }) => {
      if (!ticket?.id) {
        throw new Error('Ticket inválido para solicitar ajuda da IA.');
      }

      const payload = {
        ticket: sanitizeTicket(ticket),
        timeline: sanitizeTimeline(timeline),
      };

      const response = await apiPost('/ai/suggest', payload, { rateLimitKey: 'ai-suggest' });
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
