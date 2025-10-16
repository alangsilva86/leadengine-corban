export const SAVED_FILTERS_STORAGE_KEY = 'leadengine_inbox_filters_v1';
export const SAVED_VIEWS_STORAGE_KEY = 'leadengine_inbox_saved_views_v1';
export const SAVED_VIEWS_LIMIT = 10;
export const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;
export const NO_QUEUE_VALUE = '__none__';

export const defaultFilters = {
  status: 'all',
  queue: 'all',
  timeWindow: 'any',
  search: '',
  minScore: null,
  minMargin: null,
  hasPhoneOnly: false,
};

export const TIME_WINDOW_OPTIONS = [
  { value: 'any', label: 'Qualquer período' },
  { value: 'today', label: 'Hoje' },
  { value: 'last3d', label: 'Últimos 3 dias' },
  { value: 'last7d', label: 'Últimos 7 dias' },
  { value: 'older', label: 'Mais antigos que 7 dias' },
];

export const ensureDate = (input) => {
  if (!input) return null;

  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return input;
  }

  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
};

const resolveReferenceDate = (allocation) => {
  const candidates = [
    allocation?.lastMessageAt,
    allocation?.lastInteractionAt,
    allocation?.updatedAt,
    allocation?.createdAt,
    allocation?.allocatedAt,
    allocation?.firstMessageAt,
  ];

  for (const candidate of candidates) {
    const date = ensureDate(candidate);
    if (date) {
      return date;
    }
  }

  return null;
};

const matchesWindow = (date, window) => {
  if (window === 'any') {
    return true;
  }

  if (!date) {
    return false;
  }

  const now = new Date();
  const diffMs = Math.abs(now.getTime() - date.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  switch (window) {
    case 'today':
      return date.toDateString() === now.toDateString();
    case 'last3d':
      return diffDays <= 3;
    case 'last7d':
      return diffDays <= 7;
    case 'older':
      return diffDays > 7;
    default:
      return true;
  }
};

export const resolveQueueValue = (allocation) => {
  const label =
    allocation?.queue?.name ??
    allocation?.queueName ??
    allocation?.queue_label ??
    allocation?.queue ??
    null;
  if (!label) {
    return { value: NO_QUEUE_VALUE, label: 'Sem fila definida' };
  }
  return { value: String(label), label: String(label) };
};

export const normalizeFilters = (value) => {
  if (!value || typeof value !== 'object') {
    return { ...defaultFilters };
  }

  return {
    status: value.status && typeof value.status === 'string' ? value.status : defaultFilters.status,
    queue: value.queue && typeof value.queue === 'string' ? value.queue : defaultFilters.queue,
    timeWindow:
      value.timeWindow && typeof value.timeWindow === 'string'
        ? value.timeWindow
        : defaultFilters.timeWindow,
    search: typeof value.search === 'string' ? value.search : defaultFilters.search,
    minScore:
      typeof value.minScore === 'number' && Number.isFinite(value.minScore)
        ? value.minScore
        : null,
    minMargin:
      typeof value.minMargin === 'number' && Number.isFinite(value.minMargin)
        ? value.minMargin
        : null,
    hasPhoneOnly: Boolean(value.hasPhoneOnly),
  };
};

export const serializeFilters = (value) => {
  const filters = normalizeFilters(value);
  return JSON.stringify([
    filters.status,
    filters.queue,
    filters.timeWindow,
    filters.search.trim().toLowerCase(),
    filters.minScore ?? null,
    filters.minMargin ?? null,
    filters.hasPhoneOnly,
  ]);
};

export const filterAllocationsWithFilters = (allocations, rawFilters) => {
  const filters = normalizeFilters(rawFilters);
  const searchTerm = filters.search.trim().toLowerCase();

  return allocations.filter((allocation) => {
    if (filters.status !== 'all' && allocation.status !== filters.status) {
      return false;
    }

    const { value: queueValue } = resolveQueueValue(allocation);
    if (filters.queue !== 'all' && queueValue !== filters.queue) {
      return false;
    }

    if (filters.hasPhoneOnly) {
      const phone = typeof allocation.phone === 'string' ? allocation.phone.replace(/\D/g, '') : '';
      if (!phone) {
        return false;
      }
    }

    if (typeof filters.minScore === 'number') {
      const score = typeof allocation.score === 'number' ? allocation.score : null;
      if (score === null || score < filters.minScore) {
        return false;
      }
    }

    if (typeof filters.minMargin === 'number') {
      const margin =
        typeof allocation.netMargin === 'number'
          ? allocation.netMargin
          : typeof allocation.margin === 'number'
            ? allocation.margin
            : null;
      if (margin === null || margin < filters.minMargin) {
        return false;
      }
    }

    if (!matchesWindow(resolveReferenceDate(allocation), filters.timeWindow)) {
      return false;
    }

    if (searchTerm) {
      const haystackParts = [allocation.fullName, allocation.document, allocation.phone];
      if (Array.isArray(allocation.registrations)) {
        haystackParts.push(allocation.registrations.join(' '));
      }
      const haystack = haystackParts
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(searchTerm)) {
        return false;
      }
    }

    return true;
  });
};

export const normalizeSavedView = (view) => {
  if (!view || typeof view !== 'object') {
    return null;
  }

  const id = typeof view.id === 'string' ? view.id : null;
  const name = typeof view.name === 'string' ? view.name.trim() : '';

  if (!id || !name) {
    return null;
  }

  const createdAt =
    typeof view.createdAt === 'number' && Number.isFinite(view.createdAt)
      ? view.createdAt
      : Date.now();
  const lastUsedAt =
    typeof view.lastUsedAt === 'number' && Number.isFinite(view.lastUsedAt)
      ? view.lastUsedAt
      : null;

  return {
    id,
    name,
    filters: normalizeFilters(view.filters),
    createdAt,
    lastUsedAt,
  };
};

export const pruneStaleViews = (views, now = Date.now()) => {
  if (!Array.isArray(views)) {
    return [];
  }

  return views
    .map(normalizeSavedView)
    .filter(Boolean)
    .filter((view) => {
      const reference = view.lastUsedAt ?? view.createdAt;
      return !reference || now - reference <= THIRTY_DAYS_MS;
    });
};

export const loadStoredFilters = () => {
  if (typeof window === 'undefined') {
    return { ...defaultFilters };
  }

  try {
    const raw = window.localStorage.getItem(SAVED_FILTERS_STORAGE_KEY);
    if (!raw) {
      return { ...defaultFilters };
    }
    return normalizeFilters(JSON.parse(raw));
  } catch (error) {
    console.warn('Não foi possível restaurar filtros da Inbox', error);
    return { ...defaultFilters };
  }
};

export const persistStoredFilters = (filters) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(
      SAVED_FILTERS_STORAGE_KEY,
      JSON.stringify(normalizeFilters(filters))
    );
  } catch (error) {
    console.warn('Não foi possível persistir filtros da Inbox', error);
  }
};

export const loadStoredViews = () => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SAVED_VIEWS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return pruneStaleViews(parsed);
  } catch (error) {
    console.warn('Não foi possível restaurar views salvas da Inbox', error);
    return [];
  }
};

export const persistStoredViews = (views) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(
      SAVED_VIEWS_STORAGE_KEY,
      JSON.stringify(pruneStaleViews(views))
    );
  } catch (error) {
    console.warn('Não foi possível persistir views salvas da Inbox', error);
  }
};
