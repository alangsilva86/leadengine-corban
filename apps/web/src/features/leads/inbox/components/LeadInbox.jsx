import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Trophy, XCircle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import NoticeBanner from '@/components/ui/notice-banner.jsx';

import { useLeadAllocations } from '../hooks/useLeadAllocations.js';
import useInboxLiveUpdates from '@/features/whatsapp-inbound/sockets/useInboxLiveUpdates.js';
import InboxHeader from './InboxHeader.jsx';
import InboxActions from './InboxActions.jsx';
import InboxList from './InboxList.jsx';
import GlobalFiltersBar from './GlobalFiltersBar.jsx';

const SAVED_FILTERS_STORAGE_KEY = 'leadengine_inbox_filters_v1';
const SAVED_VIEWS_STORAGE_KEY = 'leadengine_inbox_saved_views_v1';
const SAVED_VIEWS_LIMIT = 10;
const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;
const NO_QUEUE_VALUE = '__none__';

const defaultFilters = {
  status: 'all',
  queue: 'all',
  timeWindow: 'any',
  search: '',
  minScore: null,
  minMargin: null,
  hasPhoneOnly: false,
};

const normalizeFilters = (value) => {
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

const serializeFilters = (value) => {
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

const ensureDate = (input) => {
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

const resolveQueueValue = (allocation) => {
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

const filterAllocationsWithFilters = (allocations, rawFilters) => {
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
      const haystackParts = [
        allocation.fullName,
        allocation.document,
        allocation.phone,
      ];
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

const TIME_WINDOW_OPTIONS = [
  { value: 'any', label: 'Qualquer período' },
  { value: 'today', label: 'Hoje' },
  { value: 'last3d', label: 'Últimos 3 dias' },
  { value: 'last7d', label: 'Últimos 7 dias' },
  { value: 'older', label: 'Mais antigos que 7 dias' },
];

const loadStoredFilters = () => {
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

const normalizeSavedView = (view) => {
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

const loadStoredViews = () => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SAVED_VIEWS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const now = Date.now();
    return parsed
      .map(normalizeSavedView)
      .filter(Boolean)
      .filter((view) => {
        const reference = view.lastUsedAt ?? view.createdAt;
        return !reference || now - reference <= THIRTY_DAYS_MS;
      });
  } catch (error) {
    console.warn('Não foi possível restaurar views salvas da Inbox', error);
    return [];
  }
};

const statusMetrics = [
  { key: 'total', label: 'Total recebido' },
  { key: 'contacted', label: 'Em conversa' },
  { key: 'won', label: 'Ganhos', accent: 'text-emerald-600', icon: <Trophy className="h-4 w-4" /> },
  { key: 'lost', label: 'Perdidos', accent: 'text-destructive', icon: <XCircle className="h-4 w-4" /> },
];

const formatSummaryValue = (value) => value ?? 0;

export const LeadInbox = ({
  selectedAgreement,
  campaign,
  onboarding,
  onSelectAgreement,
  onBackToWhatsApp,
}) => {
  const agreementId = selectedAgreement?.id;
  const campaignId = campaign?.id;

  const initialFilters = useMemo(() => loadStoredFilters(), []);
  const initialViews = useMemo(() => loadStoredViews(), []);

  const [filters, setFilters] = useState(initialFilters);
  const [savedViews, setSavedViews] = useState(initialViews);
  const [activeViewId, setActiveViewId] = useState(() => {
    const serialized = serializeFilters(initialFilters);
    const matchingView = initialViews.find((view) => serializeFilters(view.filters) === serialized);
    return matchingView?.id ?? null;
  });
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(null);

  const {
    allocations,
    summary,
    loading,
    error,
    warningMessage,
    rateLimitInfo,
    refresh,
    updateAllocationStatus,
    lastUpdatedAt,
    nextRefreshAt,
  } = useLeadAllocations({ agreementId, campaignId, instanceId: campaign?.instanceId });

  const { connected: realtimeConnected, connectionError } = useInboxLiveUpdates({
    tenantId: selectedAgreement?.tenantId ?? campaign?.tenantId ?? null,
    enabled: Boolean(agreementId || campaignId),
    onLead: () => {
      refresh();
    },
  });

  useEffect(() => {
    setSavedViews((current) => {
      const now = Date.now();
      const pruned = current.filter((view) => {
        const reference = view.lastUsedAt ?? view.createdAt;
        return !reference || now - reference <= THIRTY_DAYS_MS;
      });
      return pruned.length === current.length ? current : pruned;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(SAVED_FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      console.warn('Não foi possível persistir filtros da Inbox', error);
    }
  }, [filters]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(savedViews));
    } catch (error) {
      console.warn('Não foi possível persistir views salvas da Inbox', error);
    }
  }, [savedViews]);

  const previousContextRef = useRef({
    agreementId: agreementId ?? null,
    campaignId: campaignId ?? null,
  });

  useEffect(() => {
    const previous = previousContextRef.current;
    const current = {
      agreementId: agreementId ?? null,
      campaignId: campaignId ?? null,
    };

    const hasChanged =
      previous.agreementId !== current.agreementId || previous.campaignId !== current.campaignId;

    if (hasChanged && (previous.agreementId !== null || previous.campaignId !== null)) {
      setFilters({ ...defaultFilters });
      setActiveViewId(null);
    }

    previousContextRef.current = current;
  }, [agreementId, campaignId]);

  const stageIndex = onboarding?.stages?.findIndex((stage) => stage.id === 'inbox') ?? onboarding?.activeStep ?? 3;
  const totalStages = onboarding?.stages?.length ?? 0;
  const stepNumber = stageIndex >= 0 ? stageIndex + 1 : 4;
  const stepLabel = totalStages ? `Passo ${Math.min(stepNumber, totalStages)} de ${totalStages}` : `Passo ${stepNumber}`;

  useEffect(() => {
    if (!nextRefreshAt) {
      setAutoRefreshSeconds(null);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000));
      setAutoRefreshSeconds(remaining);
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [nextRefreshAt]);

  const queueOptions = useMemo(() => {
    const counts = new Map();

    allocations.forEach((allocation) => {
      const { value, label } = resolveQueueValue(allocation);
      if (!counts.has(value)) {
        counts.set(value, { value, label, count: 0 });
      }
      counts.get(value).count += 1;
    });

    const entries = Array.from(counts.values()).sort((a, b) =>
      a.label.localeCompare(b.label, 'pt-BR')
    );

    return [
      { value: 'all', label: 'Todas as filas', count: allocations.length },
      ...entries,
    ];
  }, [allocations]);

  const filteredAllocations = useMemo(
    () => filterAllocationsWithFilters(allocations, filters),
    [allocations, filters]
  );

  const savedViewsWithCount = useMemo(
    () =>
      savedViews.map((view) => ({
        ...view,
        count: filterAllocationsWithFilters(allocations, view.filters).length,
      })),
    [allocations, savedViews]
  );

  const serializedFilters = useMemo(() => serializeFilters(filters), [filters]);

  const matchingSavedView = useMemo(
    () => savedViews.find((view) => serializeFilters(view.filters) === serializedFilters) ?? null,
    [savedViews, serializedFilters]
  );

  useEffect(() => {
    if (matchingSavedView && activeViewId !== matchingSavedView.id) {
      setActiveViewId(matchingSavedView.id);
    }
    if (!matchingSavedView && activeViewId) {
      setActiveViewId(null);
    }
  }, [activeViewId, matchingSavedView]);

  const canSaveCurrentView = savedViews.length < SAVED_VIEWS_LIMIT && !matchingSavedView;

  const handleUpdateFilters = useCallback(
    (partial) => {
      setFilters((current) => {
        const next = normalizeFilters({ ...current, ...partial });
        if (activeViewId) {
          const activeView = savedViews.find((view) => view.id === activeViewId);
          if (!activeView || serializeFilters(activeView.filters) !== serializeFilters(next)) {
            setActiveViewId(null);
          }
        }
        return next;
      });
    },
    [activeViewId, savedViews]
  );

  const handleResetFilters = useCallback(() => {
    setFilters({ ...defaultFilters });
    setActiveViewId(null);
  }, []);

  const handleSelectSavedView = useCallback((view) => {
    setFilters(normalizeFilters(view.filters));
    setActiveViewId(view.id);
    setSavedViews((current) =>
      current.map((item) =>
        item.id === view.id ? { ...item, lastUsedAt: Date.now() } : item
      )
    );
  }, []);

  const handleSaveCurrentView = useCallback(() => {
    if (!canSaveCurrentView) {
      if (matchingSavedView) {
        setActiveViewId(matchingSavedView.id);
      }
      return;
    }

    const defaultName = `Visão ${savedViews.length + 1}`;
    const input = typeof window !== 'undefined' ? window.prompt('Nome da visão', defaultName) : null;
    if (!input) {
      return;
    }

    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }

    const newView = {
      id: `view-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: trimmed.slice(0, 48),
      filters: normalizeFilters(filters),
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    };

    setSavedViews((current) => {
      const next = [...current, newView];
      if (next.length > SAVED_VIEWS_LIMIT) {
        next.shift();
      }
      return next;
    });
    setActiveViewId(newView.id);
  }, [canSaveCurrentView, filters, matchingSavedView, savedViews.length]);

  const handleDeleteSavedView = useCallback(
    (view) => {
      setSavedViews((current) => current.filter((item) => item.id !== view.id));
      if (activeViewId === view.id) {
        setActiveViewId(null);
      }
    },
    [activeViewId]
  );

  const openWhatsApp = (allocation) => {
    const phone = allocation.phone?.replace(/\D/g, '');
    if (!phone) return;
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <InboxHeader
        stepLabel={stepLabel}
        selectedAgreement={selectedAgreement}
        campaign={campaign}
        onboarding={onboarding}
      />

      <Card>
        <CardHeader className="flex flex-wrap items-center gap-4">
          <div>
            <CardTitle>Resumo</CardTitle>
            <CardDescription>Distribuição dos leads que já chegaram ao seu WhatsApp.</CardDescription>
          </div>
          <div className="ml-auto flex items-center gap-6 text-sm">
            {statusMetrics.map(({ key, label, accent, icon }) => (
              <div key={key} className="flex flex-col items-start gap-1">
                <p className="flex items-center gap-1 text-muted-foreground">
                  {icon ? icon : null}
                  {label}
                </p>
                <p className={`text-lg font-semibold ${accent ?? ''}`}>{formatSummaryValue(summary[key])}</p>
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <GlobalFiltersBar
            filters={filters}
            onUpdateFilters={handleUpdateFilters}
            onResetFilters={handleResetFilters}
            queueOptions={queueOptions}
            windowOptions={TIME_WINDOW_OPTIONS}
            savedViews={savedViewsWithCount}
            activeViewId={activeViewId}
            onSelectSavedView={handleSelectSavedView}
            onSaveCurrentView={handleSaveCurrentView}
            onDeleteSavedView={handleDeleteSavedView}
            canSaveView={canSaveCurrentView}
            viewLimit={SAVED_VIEWS_LIMIT}
          />

          <InboxActions
            loading={loading}
            onRefresh={refresh}
            onExport={() => {
              const params = new URLSearchParams();
              if (campaignId) params.set('campaignId', campaignId);
              if (agreementId) params.set('agreementId', agreementId);
              if (filters.status !== 'all') {
                params.set('status', filters.status);
              }
              if (campaign?.instanceId) {
                params.set('instanceId', campaign.instanceId);
              }
              window.open(`/api/lead-engine/allocations/export?${params.toString()}`, '_blank');
            }}
            rateLimitInfo={rateLimitInfo}
            autoRefreshSeconds={autoRefreshSeconds}
            lastUpdatedAt={lastUpdatedAt}
          />

          {!realtimeConnected && !connectionError ? (
            <NoticeBanner variant="info">
              Conectando ao tempo real para receber novos leads automaticamente…
            </NoticeBanner>
          ) : null}

          {connectionError ? (
            <NoticeBanner variant="warning" icon={<AlertCircle className="h-4 w-4" />}>
              Tempo real indisponível: {connectionError}. Continuamos monitorando via atualização automática.
            </NoticeBanner>
          ) : null}

          {error ? (
            <NoticeBanner variant="danger" icon={<AlertCircle className="h-4 w-4" />}>
              {error}
            </NoticeBanner>
          ) : null}

          {!error && warningMessage ? (
            <NoticeBanner variant="warning" icon={<AlertCircle className="h-4 w-4" />}>
              {warningMessage}
            </NoticeBanner>
          ) : null}

          <InboxList
            allocations={allocations}
            filteredAllocations={filteredAllocations}
            loading={loading}
            selectedAgreement={selectedAgreement}
            campaign={campaign}
            onOpenWhatsApp={openWhatsApp}
            onUpdateStatus={updateAllocationStatus}
            onBackToWhatsApp={onBackToWhatsApp}
            onSelectAgreement={onSelectAgreement}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadInbox;
