import { useCallback } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost } from '@/lib/api.js';

const DEFAULT_PAGE_SIZE = 50;

export const buildContactsQueryKey = (filters) => ['contacts', 'list', { filters }];

const normalizeFilters = (filters = {}) => {
  const entries = Object.entries(filters)
    .filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return value !== undefined && value !== null && value !== '';
    })
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return [key, value.map((item) => `${item}`.trim()).filter(Boolean)];
      }
      if (typeof value === 'object' && value !== null) {
        return [key, { ...value }];
      }
      return [key, value];
    });

  return Object.fromEntries(entries);
};

const buildQueryString = (filters = {}) => {
  const params = new URLSearchParams();
  params.set('limit', String(filters.limit ?? DEFAULT_PAGE_SIZE));

  Object.entries(filters).forEach(([key, value]) => {
    if (key === 'limit') {
      return;
    }

    if (value === undefined || value === null) {
      return;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return;
      }
      params.set(key, value.join(','));
      return;
    }

    params.set(key, `${value}`);
  });

  return params.toString();
};

const parsePaginatedPayload = (payload, fallbackLimit = DEFAULT_PAGE_SIZE) => {
  const data = payload?.data ?? payload ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  const pagination = data?.pagination ?? {};

  const currentPage = pagination?.page ?? 1;
  const totalPages = pagination?.totalPages ?? null;
  const limit = pagination?.limit ?? fallbackLimit;
  const hasNext = pagination?.hasNext ?? (totalPages === null ? items.length === limit : currentPage < totalPages);

  return {
    items,
    pagination: {
      page: currentPage,
      limit,
      total: pagination?.total ?? null,
      totalPages,
      hasNext,
    },
  };
};

export const useContactsQuery = ({ filters = {}, pageSize = DEFAULT_PAGE_SIZE, enabled = true } = {}) => {
  const normalizedFilters = normalizeFilters(filters);
  const queryKey = buildContactsQueryKey(normalizedFilters);

  return useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.pagination?.hasNext) {
        return undefined;
      }

      return (lastPage.pagination.page ?? 1) + 1;
    },
    queryFn: async ({ pageParam = 1 }) => {
      const query = buildQueryString({ ...normalizedFilters, page: pageParam, limit: pageSize });
      const response = await apiGet(`/api/contacts?${query}`);
      const parsed = parsePaginatedPayload(response, pageSize);

      return {
        ...parsed,
        page: pageParam,
      };
    },
  });
};

export const useContactDetailsQuery = (contactId, { enabled = true } = {}) =>
  useQuery({
    queryKey: ['contacts', 'details', contactId],
    enabled: enabled && Boolean(contactId),
    queryFn: async () => {
      const response = await apiGet(`/api/contacts/${contactId}`);
      return response?.data ?? response ?? null;
    },
    staleTime: 1000 * 15,
  });

export const useContactTimelineQuery = (contactId, { enabled = true } = {}) =>
  useQuery({
    queryKey: ['contacts', 'timeline', contactId],
    enabled: enabled && Boolean(contactId),
    queryFn: async () => {
      const response = await apiGet(`/api/contacts/${contactId}/timeline`);
      const items = Array.isArray(response?.data) ? response.data : response?.data?.items ?? [];
      return items;
    },
    refetchInterval: 30_000,
  });

export const useContactTasksQuery = (contactId, { enabled = true } = {}) =>
  useQuery({
    queryKey: ['contacts', 'tasks', contactId],
    enabled: enabled && Boolean(contactId),
    queryFn: async () => {
      const response = await apiGet(`/api/contacts/${contactId}/tasks`);
      const items = Array.isArray(response?.data) ? response.data : response?.data?.items ?? [];
      return items;
    },
  });

export const useUpdateContactMutation = (contactId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      const response = await apiPatch(`/api/contacts/${contactId}`, payload);
      return response?.data ?? response ?? null;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.setQueryData(['contacts', 'details', contactId], data);
    },
  });
};

export const useContactBulkMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ action, contactIds, payload }) => {
      const response = await apiPost('/api/contacts/actions/bulk', {
        action,
        contactIds,
        payload,
      });
      return response?.data ?? response ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
};

export const useContactInteractionMutation = (contactId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      const response = await apiPost(`/api/contacts/${contactId}/interactions`, payload);
      return response?.data ?? response ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', 'timeline', contactId] });
    },
  });
};

export const useContactTaskMutation = (contactId) => {
  const queryClient = useQueryClient();

  const invalidateTasks = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['contacts', 'tasks', contactId] });
  }, [contactId, queryClient]);

  const createTask = useMutation({
    mutationFn: async (payload) => {
      const response = await apiPost(`/api/contacts/${contactId}/tasks`, payload);
      return response?.data ?? response ?? null;
    },
    onSuccess: () => {
      invalidateTasks();
    },
  });

  const completeTask = useMutation({
    mutationFn: async ({ taskId, payload }) => {
      const response = await apiPatch(`/api/contacts/${contactId}/tasks/${taskId}`, payload ?? { status: 'done' });
      return response?.data ?? response ?? null;
    },
    onSuccess: () => {
      invalidateTasks();
    },
  });

  return { createTask, completeTask };
};

export const useTriggerWhatsAppMutation = (contactId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const response = await apiPost(`/api/contacts/${contactId}/whatsapp`, payload ?? {});
      return response?.data ?? response ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', 'timeline', contactId] });
    },
  });
};

export const useContactDeduplicateMutation = (contactId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      const response = await apiPost(`/api/contacts/${contactId}/deduplicate`, payload ?? {});
      return response?.data ?? response ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts', 'details', contactId] });
    },
  });
};
