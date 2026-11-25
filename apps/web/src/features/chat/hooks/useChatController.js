import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import useTicketsQuery from '../api/useTicketsQuery.js';
import useMessagesQuery from '../api/useMessagesQuery.js';
import useSendMessage from '../api/useSendMessage.js';
import useNotesMutation from '../api/useNotesMutation.js';
import useTicketStatusMutation from '../api/useTicketStatusMutation.js';
import useTicketAssignMutation from '../api/useTicketAssignMutation.js';
import useRealtimeTickets from './useRealtimeTickets.js';
import useConversationState from './useConversationState.js';
import useTypingIndicator from './useTypingIndicator.js';
import useDebouncedValue from './useDebouncedValue.js';
import mergeTicketIntoList from '../utils/updateTicketsList.js';
import { resolveProviderMessageId } from '../utils/messageIdentity.js';

const DEFAULT_FILTERS = {
  scope: 'team',
  state: 'open',
  window: 'all',
  search: '',
  outcome: null,
  instanceId: null,
  campaignId: null,
  productType: null,
  strategy: null,
  // Etapa do lead (id do contrato `LeadStage`).
  stage: null,
};

const DEFAULT_MESSAGES_PAGE_SIZE = 40;
const TICKETS_PAGE_SIZE = 40;
const POLLING_INTERVAL_MS = 15000;
const SEARCH_DEBOUNCE_MS = 300;

/** Filtros rápidos aplicados sobre as conversas já carregadas (a API ainda não os oferece). */
const QUICK_FILTERS = {
  unread: (ticket) => (ticket?.timeline?.unreadInboundCount ?? 0) > 0,
  awaiting: (ticket) => ticket?.timeline?.lastDirection === 'INBOUND',
};

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

  if (filters?.instanceId) {
    queryFilters.sourceInstance = filters.instanceId;
  }

  if (filters?.campaignId) {
    queryFilters.campaignId = filters.campaignId;
  }

  if (filters?.productType) {
    queryFilters.productType = filters.productType;
  }

  if (filters?.strategy) {
    queryFilters.strategy = filters.strategy;
  }

  if (filters?.stage) {
    queryFilters.stage = filters.stage;
  }

  return queryFilters;
};

const findTicketById = (items, ticketId) => {
  if (!ticketId || !Array.isArray(items)) {
    return null;
  }
  return items.find((ticket) => ticket.id === ticketId) ?? null;
};

const EMPTY_TICKETS = [];

export const useChatController = ({ tenantId, currentUser, autoSelect = true } = {}) => {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [quickFilter, setQuickFilter] = useState(null);
  const [pageCount, setPageCount] = useState(1);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [selectedTicketIds, setSelectedTicketIds] = useState([]);
  const [queueAlerts, setQueueAlerts] = useState([]);
  const autoSelectRef = useRef(autoSelect);
  autoSelectRef.current = autoSelect;

  const queryClient = useQueryClient();

  // A busca digitada aparece na hora no campo, mas só consulta a API após 300 ms sem digitar.
  const debouncedSearch = useDebouncedValue(filters.search ?? '', SEARCH_DEBOUNCE_MS);
  const queryFilterSource = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [debouncedSearch, filters]
  );

  const apiFilters = useMemo(
    () => buildApiFilters({ filters: queryFilterSource, currentUser }),
    [queryFilterSource, currentUser]
  );

  // Ao trocar filtros/busca, volta para a primeira página.
  const apiFiltersKey = JSON.stringify(apiFilters);
  useEffect(() => {
    setPageCount(1);
  }, [apiFiltersKey]);

  const handleTicketUpdated = useCallback(
    (payload) => {
      const ticket = payload?.ticket ?? payload;

      if (!ticket || typeof ticket !== 'object' || !ticket.id) {
        return;
      }

      const queries = queryClient.getQueryCache().findAll({ queryKey: ['chat', 'tickets'] });

      queries.forEach(({ queryKey }) => {
        queryClient.setQueryData(queryKey, (current) => mergeTicketIntoList(current, ticket));
      });
    },
    [queryClient]
  );

  const handleMessageCreated = useCallback(
    (payload) => {
      const message = payload?.message ?? payload ?? null;
      if (!message || typeof message !== 'object') {
        return;
      }

      const ticketId = payload?.ticketId ?? message.ticketId ?? payload?.ticket?.id ?? null;
      if (!ticketId) {
        return;
      }

      const queryKey = ['chat', 'messages', ticketId, DEFAULT_MESSAGES_PAGE_SIZE];
      queryClient.setQueryData(queryKey, (current) => {
        if (!current || !Array.isArray(current.pages)) {
          return current;
        }

        const messageProviderId = resolveProviderMessageId(message);

        const alreadyExists = current.pages.some((page) =>
          Array.isArray(page?.items) &&
          page.items.some((item) => {
            if (!item) {
              return false;
            }
            if (item.id === message.id) {
              return true;
            }
            if (item.externalId && message.externalId && item.externalId === message.externalId) {
              return true;
            }
            const itemProviderId = resolveProviderMessageId(item);
            return (
              itemProviderId &&
              messageProviderId &&
              itemProviderId === messageProviderId
            );
          })
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
      queryClient.invalidateQueries({ queryKey: ['chat', 'ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'tickets'] });

      if (payload?.ticket) {
        handleTicketUpdated(payload);
      }
    },
    [handleTicketUpdated, queryClient]
  );

  const handleQueueMissing = useCallback((payload) => {
    setQueueAlerts((current) => {
      const timestamp = Date.now();
      const filtered = current.filter(
        (entry) =>
          entry.payload?.instanceId !== payload?.instanceId &&
          timestamp - entry.timestamp < 5 * 60 * 1000
      );
      return [
        { event: 'whatsapp.queue.missing', payload, timestamp },
        ...filtered,
      ].slice(0, 5);
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
        const messageProviderId = resolveProviderMessageId(message);

        const nextPages = current.pages.map((page) => {
          if (!page || !Array.isArray(page.items)) {
            return page;
          }

          let pageChanged = false;
          const items = page.items.map((item) => {
            if (!item) {
              return item;
            }

            const itemProviderMessageId = resolveProviderMessageId(item);
            const matches =
              item.id === message.id ||
              (item.externalId && message.externalId && item.externalId === message.externalId) ||
              (itemProviderMessageId && messageProviderId && itemProviderMessageId === messageProviderId);

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
      queryClient.invalidateQueries({ queryKey: ['chat', 'ticket', ticketId] });

      if (payload?.ticket) {
        handleTicketUpdated(payload);
      }
    },
    [handleTicketUpdated, queryClient]
  );

  const realtime = useRealtimeTickets({
    tenantId,
    userId: currentUser?.id,
    ticketId: selectedTicketId,
    enabled: Boolean(tenantId),
    onTicketUpdated: handleTicketUpdated,
    onMessageCreated: handleMessageCreated,
    onMessageUpdated: handleMessageUpdated,
    onQueueMissing: handleQueueMissing,
  });

  // Sem tempo real, a lista e a conversa aberta são atualizadas a cada 15 s.
  const realtimeConnected = realtime?.connected === true;
  const pollingInterval = realtimeConnected ? false : POLLING_INTERVAL_MS;

  const ticketsQuery = useTicketsQuery({
    filters: apiFilters,
    includeMetrics: true,
    enabled: Boolean(tenantId),
    limit: TICKETS_PAGE_SIZE * pageCount,
    refetchInterval: pollingInterval,
  });

  const allTickets = ticketsQuery.data?.items ?? EMPTY_TICKETS;
  const metrics = ticketsQuery.data?.metrics ?? null;
  const totalTickets =
    typeof ticketsQuery.data?.total === 'number' ? ticketsQuery.data.total : allTickets.length;
  const hasMoreTickets = Boolean(ticketsQuery.data?.hasNext);
  const isLoadingMoreTickets = ticketsQuery.isFetching && ticketsQuery.isPlaceholderData === true && pageCount > 1;

  const tickets = useMemo(() => {
    const predicate = quickFilter ? QUICK_FILTERS[quickFilter] : null;
    return predicate ? allTickets.filter(predicate) : allTickets;
  }, [allTickets, quickFilter]);

  // Guarda a última versão conhecida da conversa aberta: se ela sair da lista
  // (busca, filtro, atualização), continua aberta — nunca trocamos de cliente
  // por baixo do atendente.
  const selectedSnapshotRef = useRef(null);
  const listedSelectedTicket = useMemo(
    () => findTicketById(allTickets, selectedTicketId),
    [allTickets, selectedTicketId]
  );
  if (listedSelectedTicket) {
    selectedSnapshotRef.current = listedSelectedTicket;
  } else if (!selectedTicketId || selectedSnapshotRef.current?.id !== selectedTicketId) {
    selectedSnapshotRef.current = null;
  }
  const selectedTicket = listedSelectedTicket ?? selectedSnapshotRef.current ?? null;

  const hasLoadedTickets = ticketsQuery.isSuccess === true || Array.isArray(ticketsQuery.data?.items);

  useEffect(() => {
    if (!hasLoadedTickets || ticketsQuery.isPlaceholderData) {
      return;
    }
    // Seleção automática só quando nada está aberto (e apenas em telas largas).
    setSelectedTicketId((previous) => {
      if (previous) {
        return previous;
      }
      if (!autoSelectRef.current) {
        return previous;
      }
      return tickets[0]?.id ?? null;
    });
    setSelectedTicketIds((previous) => {
      const next = previous.filter((id) => findTicketById(allTickets, id));
      if (next.length !== previous.length) {
        return next;
      }
      return previous;
    });
  }, [allTickets, hasLoadedTickets, tickets, ticketsQuery.isPlaceholderData]);

  const messagesQuery = useMessagesQuery({
    ticketId: selectedTicketId,
    enabled: Boolean(selectedTicketId),
    pageSize: DEFAULT_MESSAGES_PAGE_SIZE,
    refetchInterval: pollingInterval,
  });

  const conversation = useConversationState({
    ticket: selectedTicket,
    messagesPages: messagesQuery.data?.pages,
    notes: selectedTicket?.notes ?? EMPTY_TICKETS,
  });

  const sendMessageMutation = useSendMessage({ fallbackTicketId: selectedTicketId });
  const notesMutation = useNotesMutation({ fallbackTicketId: selectedTicketId });
  const statusMutation = useTicketStatusMutation({ fallbackTicketId: selectedTicketId });
  const assignMutation = useTicketAssignMutation({ fallbackTicketId: selectedTicketId });

  const typingIndicator = useTypingIndicator({ socket: realtime?.socket });

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

  // `ticketHint`: conversa vinda de fora da lista (ex.: link do CRM) — fica aberta mesmo
  // que não esteja entre as conversas carregadas.
  const selectTicket = useCallback((ticketId, ticketHint = null) => {
    if (ticketHint && ticketId && ticketHint.id === ticketId) {
      selectedSnapshotRef.current = ticketHint;
    }
    setSelectedTicketId(ticketId ?? null);
  }, []);

  const toggleTicketSelection = useCallback((ticketId) => {
    if (!ticketId) {
      return;
    }
    setSelectedTicketIds((current) => {
      if (current.includes(ticketId)) {
        return current.filter((id) => id !== ticketId);
      }
      return [...current, ticketId];
    });
  }, []);

  const clearTicketSelection = useCallback(() => {
    setSelectedTicketIds([]);
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

  const loadMoreTickets = useCallback(() => {
    setPageCount((current) => current + 1);
  }, []);

  const toggleQuickFilter = useCallback((value) => {
    setQuickFilter((current) => (current === value || !value ? null : value));
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
    allTickets,
    totalTickets,
    hasMoreTickets,
    isLoadingMoreTickets,
    loadMoreTickets,
    quickFilter,
    setQuickFilter: toggleQuickFilter,
    metrics,
    selectedTicketId,
    selectedTicket,
    selectedTicketIds,
    selectTicket,
    toggleTicketSelection,
    clearTicketSelection,
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
