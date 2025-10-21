import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import useTicketsQuery from '../api/useTicketsQuery.js';
import useMessagesQuery from '../api/useMessagesQuery.js';
import useSendMessage from '../api/useSendMessage.js';
import useNotesMutation from '../api/useNotesMutation.js';
import useTicketStatusMutation from '../api/useTicketStatusMutation.js';
import useTicketAssignMutation from '../api/useTicketAssignMutation.js';
import useWhatsAppLimits from '../api/useWhatsAppLimits.js';
import useRealtimeTickets from './useRealtimeTickets.js';
import useConversationState from './useConversationState.js';
import useTypingIndicator from './useTypingIndicator.js';

const DEFAULT_FILTERS = {
  scope: 'team',
  state: 'open',
  window: 'in_window',
  search: '',
  outcome: null,
};

const DEFAULT_MESSAGES_PAGE_SIZE = 40;

const scopeSupportsUser = (scope) => scope === 'mine';

const buildApiFilters = ({ filters, currentUser }) => {
  const queryFilters = {
    state: filters?.state,
    search: filters?.search,
  };

  if (filters?.scope === 'mine' && currentUser?.id) {
    queryFilters.scope = 'mine';
  } else if (filters?.scope && filters.scope !== 'team') {
    queryFilters.scope = filters.scope;
  }

  if (filters?.window === 'expired') {
    queryFilters.window = 'expired';
  } else if (filters?.window === 'in_window') {
    queryFilters.window = 'open';
  }

  if (filters?.outcome === 'won') {
    queryFilters.outcome = 'won';
  } else if (filters?.outcome === 'lost') {
    queryFilters.outcome = 'lost';
  }

  return queryFilters;
};

const findTicketById = (items, ticketId) => {
  if (!ticketId || !Array.isArray(items)) {
    return null;
  }
  return items.find((ticket) => ticket.id === ticketId) ?? null;
};

export const useChatController = ({ tenantId, currentUser } = {}) => {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [queueAlerts, setQueueAlerts] = useState([]);

  const queryClient = useQueryClient();

  const apiFilters = useMemo(
    () => buildApiFilters({ filters, currentUser }),
    [filters, currentUser]
  );

  const ticketsQuery = useTicketsQuery({
    filters: apiFilters,
    includeMetrics: true,
    enabled: Boolean(tenantId),
  });

  const tickets = ticketsQuery.data?.items ?? [];
  const metrics = ticketsQuery.data?.metrics ?? null;

  useEffect(() => {
    if (tickets.length === 0) {
      setSelectedTicketId((previous) => (previous && findTicketById(tickets, previous) ? previous : null));
      return;
    }

    setSelectedTicketId((previous) => {
      if (previous && findTicketById(tickets, previous)) {
        return previous;
      }
      return tickets[0]?.id ?? null;
    });
  }, [tickets]);

  const selectedTicket = useMemo(
    () => findTicketById(tickets, selectedTicketId),
    [selectedTicketId, tickets]
  );

  const messagesQuery = useMessagesQuery({
    ticketId: selectedTicketId,
    enabled: Boolean(selectedTicketId),
    pageSize: DEFAULT_MESSAGES_PAGE_SIZE,
  });

  const conversation = useConversationState({
    ticket: selectedTicket,
    messagesPages: messagesQuery.data?.pages,
    notes: selectedTicket?.notes ?? [],
  });

  const sendMessageMutation = useSendMessage({ fallbackTicketId: selectedTicketId });
  const notesMutation = useNotesMutation({ fallbackTicketId: selectedTicketId });
  const statusMutation = useTicketStatusMutation({ fallbackTicketId: selectedTicketId });
  const assignMutation = useTicketAssignMutation({ fallbackTicketId: selectedTicketId });

  const handleTicketInvalidation = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['chat', 'tickets'] });
  }, [queryClient]);

  const handleMessageCreated = useCallback(
    (payload) => {
      const ticketId = payload?.ticketId;
      const message = payload?.message;
      if (!ticketId || !message) {
        return;
      }

      const queryKey = ['chat', 'messages', ticketId, DEFAULT_MESSAGES_PAGE_SIZE];
      queryClient.setQueryData(queryKey, (current) => {
        if (!current || !Array.isArray(current.pages)) {
          return current;
        }

        const alreadyExists = current.pages.some((page) =>
          Array.isArray(page?.items) && page.items.some((item) => item?.id === message.id || (item?.externalId && item.externalId === message.externalId))
        );

        if (alreadyExists) {
          return current;
        }

        const [firstPage = {}, ...restPages] = current.pages;
        const existingItems = Array.isArray(firstPage.items) ? firstPage.items : [];
        const nextItems = [message, ...existingItems].slice(0, DEFAULT_MESSAGES_PAGE_SIZE);

        return {
          ...current,
          pages: [{ ...firstPage, items: nextItems }, ...restPages],
        };
      });

      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', ticketId] });
    },
    [queryClient]
  );

  const handleQueueMissing = useCallback((payload) => {
    setQueueAlerts((current) => {
      const timestamp = Date.now();
      const filtered = current.filter(
        (entry) =>
          entry.payload?.instanceId !== payload?.instanceId &&
          timestamp - entry.timestamp < 5 * 60 * 1000
      );
      return [{ payload, timestamp }, ...filtered].slice(0, 5);
    });
  }, []);

  const handleMessageUpdated = useCallback(
    (payload) => {
      if (!payload || typeof payload !== 'object') {
        return;
      }

      const message = payload.message ?? payload;
      if (!message || typeof message !== 'object') {
        return;
      }

      const ticketId = payload.ticketId ?? message.ticketId;
      if (!ticketId) {
        return;
      }

      const queryKey = ['chat', 'messages', ticketId, DEFAULT_MESSAGES_PAGE_SIZE];
      queryClient.setQueryData(queryKey, (current) => {
        if (!current || !Array.isArray(current.pages)) {
          return current;
        }

        let hasChanges = false;

        const nextPages = current.pages.map((page) => {
          if (!page || !Array.isArray(page.items)) {
            return page;
          }

          let pageChanged = false;
          const items = page.items.map((item) => {
            if (!item) {
              return item;
            }

            const matches =
              item.id === message.id ||
              (item.externalId && message.externalId && item.externalId === message.externalId);

            if (!matches) {
              return item;
            }

            pageChanged = true;
            hasChanges = true;

            return {
              ...item,
              ...message,
              metadata: message.metadata ?? item.metadata ?? null,
            };
          });

          return pageChanged ? { ...page, items } : page;
        });

        if (!hasChanges) {
          return current;
        }

        return {
          ...current,
          pages: nextPages,
        };
      });

      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', ticketId] });
    },
    [queryClient]
  );

  const realtime = useRealtimeTickets({
    tenantId,
    userId: currentUser?.id,
    ticketId: selectedTicketId,
    enabled: Boolean(tenantId),
    onTicketUpdated: handleTicketInvalidation,
    onMessageCreated: handleMessageCreated,
    onMessageUpdated: handleMessageUpdated,
    onQueueMissing: handleQueueMissing,
  });

  const typingIndicator = useTypingIndicator({ socket: realtime.socket });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const interval = window.setInterval(() => {
      setQueueAlerts((current) =>
        current.filter((entry) => Date.now() - entry.timestamp < 5 * 60 * 1000)
      );
    }, 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const socket = realtime.socket;
    if (!socket) {
      return undefined;
    }

    const handleRealtimeMessage = (incoming) => {
      if (!incoming || typeof incoming !== 'object') {
        return;
      }

      const message = incoming.message ?? incoming;
      if (!message || typeof message !== 'object') {
        return;
      }

      const ticketId = incoming.ticketId ?? message.ticketId;
      if (!ticketId) {
        return;
      }

      const queryKey = ['chat', 'messages', ticketId, DEFAULT_MESSAGES_PAGE_SIZE];
      queryClient.setQueryData(queryKey, (current) => {
        if (!current || !Array.isArray(current.pages)) {
          return current;
        }

        const alreadyExists = current.pages.some((page) =>
          Array.isArray(page?.items) &&
          page.items.some((item) => item?.id === message.id || (item?.externalId && item.externalId === message.externalId))
        );

        if (alreadyExists) {
          return current;
        }

        const [firstPage = {}, ...restPages] = current.pages;
        const existingItems = Array.isArray(firstPage.items) ? firstPage.items : [];
        const nextItems = [message, ...existingItems].slice(0, DEFAULT_MESSAGES_PAGE_SIZE);

        return {
          ...current,
          pages: [{ ...firstPage, items: nextItems }, ...restPages],
        };
      });

      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', ticketId] });
    };

    socket.on('messages.new', handleRealtimeMessage);

    return () => {
      socket.off('messages.new', handleRealtimeMessage);
    };
  }, [queryClient, realtime.socket]);

  const whatsAppLimits = useWhatsAppLimits({ enabled: Boolean(tenantId) });

  const selectTicket = useCallback((ticketId) => {
    setSelectedTicketId(ticketId);
  }, []);

  const updateFilters = useCallback((updater) => {
    setFilters((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      return {
        ...current,
        ...next,
      };
    });
  }, []);

  const updateSearch = useCallback((value) => {
    setFilters((current) => ({ ...current, search: value }));
  }, []);

  const canUseScopeMine = currentUser?.id ? true : false;
  const effectiveScope = scopeSupportsUser(filters.scope) && !canUseScopeMine ? 'team' : filters.scope;

  return {
    tenantId,
    currentUser,
    filters: {
      ...filters,
      scope: effectiveScope,
    },
    setFilters: updateFilters,
    setSearch: updateSearch,
    ticketsQuery,
    tickets,
    metrics,
    whatsAppLimits,
    selectedTicketId,
    selectedTicket,
    selectTicket,
    messagesQuery,
    conversation,
    sendMessageMutation,
    notesMutation,
    statusMutation,
    assignMutation,
    realtime,
    typingIndicator,
    queueAlerts,
  };
};

export default useChatController;
