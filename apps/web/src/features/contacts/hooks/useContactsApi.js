import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost } from '@/lib/api.js';

/*
 * Rotas reais da API (apps/api/src/routes):
 *   GET    /api/contacts                      lista paginada (page, limit, sortBy, sortOrder, search, status, tags…)
 *   POST   /api/contacts                      cria contato
 *   GET    /api/contacts/tags                 [{ tag, count }]
 *   GET    /api/contacts/:id                  detalhe
 *   PATCH  /api/contacts/:id                  atualiza
 *   POST   /api/contacts/actions/bulk         { contactIds, status?, addTags?, removeTags?, block? }
 *   POST   /api/contacts/merge                { targetId, sourceIds } (somente ADMIN)
 *   GET    /api/contacts/:id/interactions     histórico
 *   POST   /api/contacts/:id/interactions     { channel, direction, summary }
 *   GET    /api/tasks/:contactId/tasks        tarefas do contato
 *   POST   /api/tasks/:contactId/tasks        { title, description? }
 *   PATCH  /api/tasks/tasks/:taskId           { status }
 *   GET    /api/crm/opportunities?contactId=  oportunidades do contato
 *   GET    /api/crm/leads                     leads do funil (para cruzar etapa/valor/responsável)
 */

const DEFAULT_PAGE_SIZE = 50;

const buildContactsQueryKey = (filters) => ['contacts', 'list', { filters }];

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
    if (key === 'limit' || value === undefined || value === null) {
      return;
    }
    if (Array.isArray(value)) {
      if (value.length > 0) {
        params.set(key, value.join(','));
      }
      return;
    }
    params.set(key, `${value}`);
  });

  return params.toString();
};

/** A API devolve { items, total, page, limit, totalPages, hasNext } (sem objeto `pagination`). */
const parsePaginatedPayload = (payload, fallbackLimit = DEFAULT_PAGE_SIZE) => {
  const data = payload?.data ?? payload ?? {};
  const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  const meta = data?.pagination ?? data ?? {};

  const page = Number(meta.page) || 1;
  const limit = Number(meta.limit) || fallbackLimit;
  const total = typeof meta.total === 'number' ? meta.total : null;
  const totalPages = typeof meta.totalPages === 'number' ? meta.totalPages : null;
  const hasNext =
    typeof meta.hasNext === 'boolean'
      ? meta.hasNext
      : totalPages !== null
        ? page < totalPages
        : items.length === limit;

  return { items, pagination: { page, limit, total, totalPages, hasNext } };
};

const unwrap = (response) => response?.data ?? response ?? null;

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
      return { ...parsePaginatedPayload(response, pageSize), page: pageParam };
    },
    placeholderData: (previous) => previous,
  });
};

export const useContactTagsQuery = ({ enabled = true } = {}) =>
  useQuery({
    queryKey: ['contacts', 'tags'],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const data = unwrap(await apiGet('/api/contacts/tags'));
      const list = Array.isArray(data) ? data : [];
      return list
        .map((entry) => (typeof entry === 'string' ? { tag: entry, count: null } : entry))
        .filter((entry) => entry?.tag)
        .sort((a, b) => a.tag.localeCompare(b.tag, 'pt-BR'));
    },
  });

/**
 * Índice contactId → lead mais recente do funil (etapa, valor, responsável).
 * A lista de contatos não traz esses dados; cruzamos com /api/crm/leads (até MAX_PAGES páginas).
 */
const LEAD_INDEX_MAX_PAGES = 4;

export const useContactLeadIndex = ({ enabled = true } = {}) =>
  useQuery({
    queryKey: ['crm', 'leads-index'],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const index = new Map();
      let cursor = null;
      let complete = false;
      for (let page = 0; page < LEAD_INDEX_MAX_PAGES; page += 1) {
        const params = new URLSearchParams({ filters: '{}' });
        if (cursor) params.set('cursor', cursor);
        const data = unwrap(await apiGet(`/api/crm/leads?${params}`));
        const items = Array.isArray(data?.items) ? data.items : [];
        items.forEach((lead) => {
          if (lead?.contactId && !index.has(lead.contactId)) {
            index.set(lead.contactId, lead);
          }
        });
        cursor = data?.nextCursor ?? null;
        if (!cursor) {
          complete = true;
          break;
        }
      }
      return { index, complete };
    },
  });

export const useCreateContactMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => unwrap(await apiPost('/api/contacts', payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
};

export const useContactDetailsQuery = (contactId, { enabled = true } = {}) =>
  useQuery({
    queryKey: ['contacts', 'details', contactId],
    enabled: enabled && Boolean(contactId),
    queryFn: async () => unwrap(await apiGet(`/api/contacts/${encodeURIComponent(contactId)}`)),
    staleTime: 1000 * 15,
  });

export const useContactInteractionsQuery = (contactId, { enabled = true } = {}) =>
  useQuery({
    queryKey: ['contacts', 'interactions', contactId],
    enabled: enabled && Boolean(contactId),
    queryFn: async () => {
      const response = await apiGet(`/api/contacts/${encodeURIComponent(contactId)}/interactions?limit=50`);
      return parsePaginatedPayload(response, 50).items;
    },
    refetchInterval: 30_000,
  });

export const useContactTasksQuery = (contactId, { enabled = true } = {}) =>
  useQuery({
    queryKey: ['contacts', 'tasks', contactId],
    enabled: enabled && Boolean(contactId),
    queryFn: async () => {
      const response = await apiGet(`/api/tasks/${encodeURIComponent(contactId)}/tasks?limit=50`);
      return parsePaginatedPayload(response, 50).items;
    },
  });

export const useContactOpportunitiesQuery = (contactId, { enabled = true } = {}) =>
  useQuery({
    queryKey: ['crm', 'opportunities', contactId, 'summary'],
    enabled: enabled && Boolean(contactId),
    queryFn: async () => {
      const data = unwrap(await apiGet(`/api/crm/opportunities?${new URLSearchParams({ contactId })}`));
      return Array.isArray(data?.items) ? data.items : [];
    },
  });

export const useUpdateContactMutation = (contactId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) =>
      unwrap(await apiPatch(`/api/contacts/${encodeURIComponent(contactId)}`, payload)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      if (data) {
        queryClient.setQueryData(['contacts', 'details', contactId], (previous) => ({ ...(previous ?? {}), ...data }));
      }
    },
  });
};

/** Ações em massa aceitas pela API: status, addTags, removeTags, block. */
export const useContactBulkMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactIds, status, addTags, removeTags, block }) =>
      unwrap(
        await apiPost('/api/contacts/actions/bulk', {
          contactIds,
          ...(status ? { status } : {}),
          ...(addTags?.length ? { addTags } : {}),
          ...(removeTags?.length ? { removeTags } : {}),
          ...(typeof block === 'boolean' ? { block } : {}),
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
};

/** Mescla contatos duplicados no contato principal (irreversível, somente ADMIN). */
export const useMergeContactsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ targetId, sourceIds }) =>
      unwrap(await apiPost('/api/contacts/merge', { targetId, sourceIds })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['crm'] });
    },
  });
};

export const useContactInteractionMutation = (contactId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ channel, direction, summary }) =>
      unwrap(
        await apiPost(`/api/contacts/${encodeURIComponent(contactId)}/interactions`, {
          channel,
          direction,
          summary,
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', 'interactions', contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts', 'details', contactId] });
    },
  });
};

/**
 * Cria tarefa para um contato. A API aceita { title, description? }.
 * Obs.: `dueAt` é validado como Date (z.date) e o JSON chega como texto, então o prazo não é enviado.
 */
export const useCreateContactTaskMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, title, description }) =>
      unwrap(
        await apiPost(`/api/tasks/${encodeURIComponent(contactId)}/tasks`, {
          title,
          ...(description ? { description } : {}),
        })
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contacts', 'tasks', variables.contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'lead'] });
    },
  });
};

export const useCompleteContactTaskMutation = (contactId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId }) =>
      unwrap(await apiPatch(`/api/tasks/tasks/${encodeURIComponent(taskId)}`, { status: 'COMPLETED' })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', 'tasks', contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'tasks'] });
    },
  });
};
