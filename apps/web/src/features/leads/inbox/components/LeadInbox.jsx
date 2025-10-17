import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, MessageSquare, Trophy, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { GlassPanel } from '@/components/ui/glass-panel.jsx';
import NoticeBanner from '@/components/ui/notice-banner.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { cn } from '@/lib/utils.js';

import useInboxLiveUpdates from '@/features/whatsapp-inbound/sockets/useInboxLiveUpdates.js';
import { useLeadAllocations } from '../hooks/useLeadAllocations.js';
import useInboxViewState from '../hooks/useInboxViewState.js';
import { useManualConversationLauncher } from '../hooks/useManualConversationLauncher.js';
import {
  SAVED_FILTERS_STORAGE_KEY,
  SAVED_VIEWS_STORAGE_KEY,
  SAVED_VIEWS_LIMIT,
  THIRTY_DAYS_MS,
  NO_QUEUE_VALUE,
  defaultFilters,
  TIME_WINDOW_OPTIONS,
  normalizeFilters,
  serializeFilters,
  filterAllocationsWithFilters,
  loadStoredFilters,
  loadStoredViews,
  resolveQueueValue,
} from '../utils/filtering.js';
import InboxHeader from './InboxHeader.jsx';
import InboxActions from './InboxActions.jsx';
import InboxList from './InboxList.jsx';
import GlobalFiltersBar from './GlobalFiltersBar.jsx';
import LeadConversationPanel from './LeadConversationPanel.jsx';
import LeadProfilePanel from './LeadProfilePanel.jsx';
import ManualConversationCard from './ManualConversationCard.jsx';

const InboxPageContainer = ({ children, className }) => (
  <div className={cn('flex h-[100dvh] min-h-0 w-full flex-1 flex-col', className)}>
    {children}
  </div>
);

const statusMetrics = [
  { key: 'total', label: 'Total recebido' },
  { key: 'contacted', label: 'Em conversa', accent: 'text-status-whatsapp', icon: <MessageSquare className="h-4 w-4 text-status-whatsapp" /> },
  { key: 'won', label: 'Ganhos', accent: 'text-success', icon: <Trophy className="h-4 w-4 text-success" /> },
  { key: 'lost', label: 'Perdidos', accent: 'text-status-error', icon: <XCircle className="h-4 w-4 text-status-error" /> },
];

const formatSummaryValue = (value) => value ?? 0;

const statusToastCopy = {
  contacted: {
    loading: 'Atualizando status para "Em conversa"…',
    success: 'Lead marcado como em conversa.',
    error: 'Não foi possível marcar o lead como em conversa.',
  },
  won: {
    loading: 'Registrando venda…',
    success: 'Venda registrada com sucesso.',
    error: 'Não foi possível registrar a venda.',
  },
  lost: {
    loading: 'Encerrando atendimento…',
    success: 'Lead marcado como sem interesse.',
    error: 'Não foi possível atualizar o status do lead.',
  },
  default: {
    loading: 'Atualizando lead…',
    success: 'Lead atualizado com sucesso.',
    error: 'Falha ao atualizar este lead.',
  },
};

const MANUAL_CONVERSATION_TOAST_ID = 'manual-conversation';

export const LeadInbox = ({
  selectedAgreement,
  campaign,
  instanceId: instanceIdProp,
  onboarding,
  onSelectAgreement,
  onBackToWhatsApp,
}) => {
  const agreementId = selectedAgreement?.id;
  const campaignId = campaign?.id;
  const resolvedInstanceId =
    instanceIdProp ??
    campaign?.instanceId ??
    onboarding?.activeCampaign?.instanceId ??
    onboarding?.instanceId ??
    null;
  const resolvedTenantId =
    selectedAgreement?.tenantId ?? campaign?.tenantId ?? onboarding?.tenantId ?? null;

  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(null);
  const [activeAllocationId, setActiveAllocationId] = useState(null);
  const [leadPanelSwitching, setLeadPanelSwitching] = useState(false);
  const inboxScrollViewportRef = useRef(null);
  const {
    launch: launchManualConversation,
    isPending: manualConversationPending,
  } = useManualConversationLauncher();
  const pendingFocusPhoneRef = useRef(null);
  const manualConversationCardRef = useRef(null);

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
  } = useLeadAllocations({ agreementId, campaignId, instanceId: resolvedInstanceId });

  const {
    filters,
    updateFilters,
    resetFilters,
    savedViews,
    savedViewsWithCount,
    activeViewId,
    selectSavedView,
    deleteSavedView,
    saveCurrentView,
    canSaveView: canSaveCurrentView,
    matchingSavedView,
  } = useInboxViewState({ allocations });

  const { connected: realtimeConnected, connectionError } = useInboxLiveUpdates({
    tenantId: resolvedTenantId,
    enabled: Boolean(agreementId || campaignId || resolvedInstanceId),
    onLead: () => {
      refresh();
    },
  });

  const previousContextRef = useRef({
    agreementId: agreementId ?? null,
    campaignId: campaignId ?? null,
    instanceId: resolvedInstanceId ?? null,
  });
  const firstActiveSelectionRef = useRef(true);
  const inboxListRef = useRef(null);
  const [inboxScrollParent, setInboxScrollParent] = useState(null);

  const registerInboxScrollViewport = useCallback((node) => {
    const nextNode = node ?? null;
    inboxScrollViewportRef.current = nextNode;
    setInboxScrollParent((current) => (current === nextNode ? current : nextNode));
  }, []);

  useEffect(() => {
    const previous = previousContextRef.current;
    const current = {
      agreementId: agreementId ?? null,
      campaignId: campaignId ?? null,
      instanceId: resolvedInstanceId ?? null,
    };

    const hasChanged =
      previous.agreementId !== current.agreementId ||
      previous.campaignId !== current.campaignId ||
      previous.instanceId !== current.instanceId;

    if (
      hasChanged &&
      (previous.agreementId !== null || previous.campaignId !== null || previous.instanceId !== null)
    ) {
      resetFilters();
    }

    previousContextRef.current = current;
  }, [agreementId, campaignId, resolvedInstanceId, resetFilters]);

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

  useEffect(() => {
    if (!filteredAllocations.length) {
      setActiveAllocationId(null);
      return;
    }

    setActiveAllocationId((current) => {
      if (current && filteredAllocations.some((item) => item.allocationId === current)) {
        return current;
      }
      return filteredAllocations[0].allocationId;
    });
  }, [filteredAllocations]);

  useEffect(() => {
    if (!pendingFocusPhoneRef.current) {
      return;
    }

    const targetPhone = pendingFocusPhoneRef.current;
    const match = allocations.find((item) => {
      if (!item?.allocationId) {
        return false;
      }
      const digits = String(item?.phone ?? '').replace(/\D/g, '');
      return digits === targetPhone;
    });

    if (match?.allocationId) {
      setActiveAllocationId(match.allocationId);
      pendingFocusPhoneRef.current = null;
    }
  }, [allocations]);

  const activeAllocation = useMemo(
    () => filteredAllocations.find((item) => item.allocationId === activeAllocationId) ?? null,
    [filteredAllocations, activeAllocationId]
  );

  const filteredCount = filteredAllocations.length;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.dispatchEvent(new CustomEvent('leadengine:inbox-count', { detail: filteredCount }));
  }, [filteredCount]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    return () => {
      window.dispatchEvent(new CustomEvent('leadengine:inbox-count', { detail: 0 }));
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    if (!activeAllocationId) {
      setLeadPanelSwitching(false);
      return undefined;
    }

    const viewport = inboxScrollViewportRef.current;
    if (viewport) {
      const rawId = String(activeAllocationId);
      const escapedId = window.CSS?.escape
        ? window.CSS.escape(rawId)
        : rawId.replace(/(["\\])/g, '\\$1');
      const selector = `[data-allocation-id="${escapedId}"]`;
      const activeElement = viewport.querySelector(selector);

      if (activeElement) {
        if (document.activeElement !== activeElement && typeof activeElement.focus === 'function') {
          activeElement.focus({ preventScroll: true });
        }

        if (typeof activeElement.scrollIntoView === 'function') {
          activeElement.scrollIntoView({
            block: 'nearest',
            inline: 'nearest',
            behavior: firstActiveSelectionRef.current ? 'auto' : 'smooth',
          });
        }
      }
    }

    if (firstActiveSelectionRef.current) {
      firstActiveSelectionRef.current = false;
      setLeadPanelSwitching(false);
      return undefined;
    }

    setLeadPanelSwitching(true);
    const timeout = window.setTimeout(() => setLeadPanelSwitching(false), 150);
    return () => window.clearTimeout(timeout);
  }, [activeAllocationId]);

  useEffect(() => {
    if (!activeAllocationId || firstActiveSelectionRef.current || !inboxScrollParent) {
      return;
    }

    const index = filteredAllocations.findIndex(
      (item) => item.allocationId === activeAllocationId
    );

    if (index < 0) {
      return;
    }

    inboxListRef.current?.scrollToIndex?.({
      index,
      align: 'center',
      behavior: 'smooth',
    });
  }, [activeAllocationId, filteredAllocations, inboxScrollParent]);

  const handleUpdateFilters = useCallback(
    (partial) => {
      updateFilters(partial);
    },
    [updateFilters]
  );

  const handleResetFilters = useCallback(() => {
    resetFilters();
  }, [resetFilters]);

  const handleSelectSavedView = useCallback(
    (view) => {
      selectSavedView(view);
    },
    [selectSavedView]
  );

  const handleSaveCurrentView = useCallback(() => {
    if (!canSaveCurrentView) {
      if (matchingSavedView) {
        selectSavedView(matchingSavedView);
      }
      return;
    }

    const defaultName = `Visão ${savedViews.length + 1}`;
    const input = typeof window !== 'undefined' ? window.prompt('Nome da visão', defaultName) : null;
    if (!input) {
      return;
    }

    saveCurrentView(input);
  }, [canSaveCurrentView, matchingSavedView, savedViews.length, saveCurrentView, selectSavedView]);

  const handleDeleteSavedView = useCallback(
    (view) => {
      deleteSavedView(view);
    },
    [deleteSavedView]
  );

  const handleSelectAllocation = useCallback((allocation) => {
    if (!allocation?.allocationId) {
      return;
    }
    setActiveAllocationId((current) => (current === allocation.allocationId ? current : allocation.allocationId));
  }, []);

  const openWhatsAppWindow = useCallback((rawPhone, initialMessage) => {
    const digits = String(rawPhone ?? '').replace(/\D/g, '');
    if (!digits) {
      toast.info('Nenhum telefone disponível para este lead.', {
        description: 'Cadastre um telefone válido para abrir o WhatsApp automaticamente.',
        position: 'bottom-right',
      });
      return false;
    }

    const messageParam =
      typeof initialMessage === 'string' && initialMessage.trim().length > 0
        ? `?text=${encodeURIComponent(initialMessage.trim())}`
        : '';

    window.open(`https://wa.me/${digits}${messageParam}`, '_blank');
    return true;
  }, []);

  const handleOpenWhatsApp = useCallback(
    (allocation) => {
      openWhatsAppWindow(allocation?.phone);
    },
    [openWhatsAppWindow]
  );

  const handleManualConversationSubmit = useCallback(
    async (payload) => {
      toast.loading('Iniciando conversa…', {
        id: MANUAL_CONVERSATION_TOAST_ID,
        position: 'bottom-right',
      });

      try {
        const result = await launchManualConversation(payload);
        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Não foi possível iniciar a conversa.';
        toast.error(message, {
          id: MANUAL_CONVERSATION_TOAST_ID,
          description: 'Verifique os dados e tente novamente.',
          position: 'bottom-right',
        });
        throw error;
      }
    },
    [launchManualConversation]
  );

  const handleOpenManualConversationCard = useCallback(() => {
    manualConversationCardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    manualConversationCardRef.current?.focus?.();
  }, [manualConversationCardRef]);

  const handleManualConversationSuccess = useCallback(
    async (result, payload) => {
      toast.success('Conversa iniciada', {
        id: MANUAL_CONVERSATION_TOAST_ID,
        duration: 2500,
        position: 'bottom-right',
      });

      const sanitizedPhone = result?.phone ?? payload?.phone ?? '';
      pendingFocusPhoneRef.current = sanitizedPhone || null;

      try {
        await refresh();
      } catch (error) {
        console.error('Falha ao recarregar inbox após iniciar conversa manual', error);
      }

      if (result?.lead?.allocationId) {
        setActiveAllocationId(result.lead.allocationId);
        pendingFocusPhoneRef.current = null;
      }

    },
    [refresh, setActiveAllocationId]
  );

  const handleUpdateAllocationStatus = useCallback(
    async (allocationId, status) => {
      if (!allocationId || !status) {
        return;
      }

      const copy = statusToastCopy[status] ?? statusToastCopy.default;
      const toastId = `lead-status-${allocationId}`;

      toast.loading(copy.loading, { id: toastId, position: 'bottom-right' });
      try {
        await updateAllocationStatus(allocationId, status);
        toast.success(copy.success, {
          id: toastId,
          duration: 2000,
          position: 'bottom-right',
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
        });
      } catch (error) {
        toast.error(copy.error, {
          id: toastId,
          description: error?.message ?? 'Tente novamente em instantes.',
          position: 'bottom-right',
        });
      }
    },
    [updateAllocationStatus]
  );

  const handleExport = useCallback(() => {
    const params = new URLSearchParams();
    if (campaignId) params.set('campaignId', campaignId);
    if (agreementId) params.set('agreementId', agreementId);
    if (filters.status !== 'all') {
      params.set('status', filters.status);
    }
    if (resolvedInstanceId) {
      params.set('instanceId', resolvedInstanceId);
    }
    window.open(`/api/lead-engine/allocations/export?${params.toString()}`, '_blank');
  }, [agreementId, campaignId, filters.status, resolvedInstanceId]);

  const showRealtimeConnecting = !realtimeConnected && !connectionError;
  const showRealtimeError = Boolean(connectionError);
  const showErrorNotice = Boolean(error);
  const showWarningNotice = !error && Boolean(warningMessage);
  const hasNotices =
    showRealtimeConnecting || showRealtimeError || showErrorNotice || showWarningNotice;

  return (
    <InboxPageContainer className="gap-6 xl:gap-8">
      <InboxHeader
        stepLabel={stepLabel}
        campaign={campaign}
        onboarding={onboarding}
      />

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="grid h-full min-h-0 gap-6 xl:grid-cols-[minmax(320px,340px)_minmax(0,1fr)_minmax(320px,340px)] xl:gap-7">
          <GlassPanel
            as="section"
            tone="inbox"
            radius="xl"
            shadow="2xl"
            className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
          >
            <div className="flex-shrink-0 border-b border-[color:var(--color-inbox-border)] px-5 py-5">
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
            </div>

            <ScrollArea
              className="flex-1 min-h-0"
              viewportRef={registerInboxScrollViewport}
              viewportClassName="h-full space-y-5 px-5 pb-6 pr-6 pt-5 overscroll-contain scroll-smooth"
              viewportProps={{
                style: { WebkitOverflowScrolling: 'touch', contain: 'content' },
              }}
            >
              <InboxList
                allocations={allocations}
                filteredAllocations={filteredAllocations}
                loading={loading}
                selectedAgreement={selectedAgreement}
                campaign={campaign}
                onBackToWhatsApp={onBackToWhatsApp}
                onSelectAgreement={onSelectAgreement}
                onSelectAllocation={handleSelectAllocation}
                activeAllocationId={activeAllocationId}
                onOpenWhatsApp={handleOpenWhatsApp}
                className="pb-3"
                ref={inboxListRef}
                scrollParent={inboxScrollParent}
              />

              {hasNotices ? (
                <div className="space-y-3 text-sm">
                  {showRealtimeConnecting ? (
                    <NoticeBanner
                      tone="info"
                      className="rounded-2xl"
                    >
                      Conectando ao tempo real para receber novos leads automaticamente…
                    </NoticeBanner>
                  ) : null}

                  {showRealtimeError ? (
                    <NoticeBanner
                      tone="warning"
                      icon={<AlertCircle className="h-4 w-4" />}
                      className="rounded-2xl"
                    >
                      Tempo real indisponível: {connectionError}. Continuamos monitorando via atualização automática.
                    </NoticeBanner>
                  ) : null}

                  {showErrorNotice ? (
                    <NoticeBanner
                      tone="error"
                      icon={<AlertCircle className="h-4 w-4" />}
                      className="rounded-2xl"
                    >
                      {error}
                    </NoticeBanner>
                  ) : null}

                  {showWarningNotice ? (
                    <NoticeBanner
                      tone="warning"
                      icon={<AlertCircle className="h-4 w-4" />}
                      className="rounded-2xl"
                    >
                      {warningMessage}
                    </NoticeBanner>
                  ) : null}
                </div>
              ) : null}
            </ScrollArea>

            <div className="pointer-events-none absolute inset-y-6 -right-4 hidden xl:block">
              <span className="block h-full w-px rounded-full bg-[color:var(--color-inbox-border)] shadow-[1px_0_18px_color-mix(in_srgb,var(--color-inbox-border)_55%,transparent)]" />
            </div>
          </GlassPanel>

          <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
            <LeadConversationPanel
              allocation={activeAllocation}
              onOpenWhatsApp={handleOpenWhatsApp}
              isLoading={loading}
              isSwitching={leadPanelSwitching}
            />

            <div className="pointer-events-none absolute inset-y-6 -right-4 hidden xl:block">
              <span className="block h-full w-px rounded-full bg-[color:var(--color-inbox-border)] shadow-[1px_0_20px_color-mix(in_srgb,var(--color-inbox-border)_60%,transparent)]" />
            </div>
          </div>

          <GlassPanel
            as="aside"
            tone="inbox"
            radius="xl"
            shadow="xl"
            className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
          >
            <ScrollArea
              className="flex-1 min-h-0"
              viewportClassName="h-full space-y-5 px-5 pb-6 pt-5 overscroll-contain"
              viewportProps={{
                style: { WebkitOverflowScrolling: 'touch', contain: 'content' },
              }}
            >
              <Card className="rounded-3xl border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] text-[color:var(--color-inbox-foreground)] shadow-[var(--shadow-xl)]">
                <CardHeader className="space-y-2 pb-2">
                  <CardTitle className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--color-inbox-foreground)]">
                    Resumo
                  </CardTitle>
                  <CardDescription className="text-xs text-[color:var(--color-inbox-foreground-muted)]">
                    Distribuição dos leads recebidos via WhatsApp conectado.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-4">
                    {statusMetrics.map(({ key, label, accent, icon }) => (
                      <div
                        key={key}
                        className="space-y-1 rounded-2xl border border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] px-3 py-3 text-[color:var(--color-inbox-foreground-muted)] shadow-[0_14px_30px_color-mix(in_srgb,var(--color-inbox-border)_48%,transparent)]"
                      >
                        <dt className="flex items-center gap-2 text-xs font-medium text-[color:var(--color-inbox-foreground-muted)]">
                          {icon ? icon : null}
                          <span>{label}</span>
                        </dt>
                        <dd className={cn('text-xl font-semibold text-[color:var(--color-inbox-foreground)]', accent ?? '')}>
                          {formatSummaryValue(summary[key])}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>

              <LeadProfilePanel
                allocation={activeAllocation}
                onUpdateStatus={handleUpdateAllocationStatus}
                onOpenWhatsApp={handleOpenWhatsApp}
                isLoading={loading}
                isSwitching={leadPanelSwitching}
              />

              <ManualConversationCard
                ref={manualConversationCardRef}
                onSubmit={handleManualConversationSubmit}
                onSuccess={handleManualConversationSuccess}
                isSubmitting={manualConversationPending}
              />

              <InboxActions
                loading={loading}
                onRefresh={refresh}
                onExport={handleExport}
                onStartManualConversation={handleOpenManualConversationCard}
                rateLimitInfo={rateLimitInfo}
                autoRefreshSeconds={autoRefreshSeconds}
                lastUpdatedAt={lastUpdatedAt}
              />
            </ScrollArea>
          </GlassPanel>
        </div>
      </div>
    </InboxPageContainer>
  );
};

export {
  SAVED_FILTERS_STORAGE_KEY,
  SAVED_VIEWS_STORAGE_KEY,
  SAVED_VIEWS_LIMIT,
  THIRTY_DAYS_MS,
  NO_QUEUE_VALUE,
  defaultFilters,
  TIME_WINDOW_OPTIONS,
  normalizeFilters,
  serializeFilters,
  filterAllocationsWithFilters,
  loadStoredFilters,
  loadStoredViews,
  resolveQueueValue,
};

export default LeadInbox;
