import { useQueryClient } from '@tanstack/react-query';

import { useRealtimeEvent, useRealtimeRoom } from '@/lib/realtime/useRealtime.js';

const CONTACT_EVENTS = [
  'contacts.created',
  'contacts.updated',
  'contacts.tasks.updated',
  'contacts.timeline.updated',
];

/** Invalida as consultas de contatos quando chegam eventos pela conexão compartilhada. */
export const useContactsLiveUpdates = ({ contactId, enabled = true } = {}) => {
  const queryClient = useQueryClient();

  useRealtimeRoom('contact', contactId, { enabled });

  useRealtimeEvent(
    CONTACT_EVENTS,
    (_payload, event) => {
      const invalidate = (queryKey) => queryClient.invalidateQueries({ queryKey });
      switch (event) {
        case 'contacts.created':
          invalidate(['contacts']);
          break;
        case 'contacts.updated':
          invalidate(['contacts']);
          if (contactId) invalidate(['contacts', 'details', contactId]);
          break;
        case 'contacts.tasks.updated':
          if (contactId) invalidate(['contacts', 'tasks', contactId]);
          break;
        case 'contacts.timeline.updated':
          if (contactId) invalidate(['contacts', 'interactions', contactId]);
          break;
        default:
          break;
      }
    },
    { enabled }
  );
};

export default useContactsLiveUpdates;
