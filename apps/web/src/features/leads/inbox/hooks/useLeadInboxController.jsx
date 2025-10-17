import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import useInboxLiveUpdates from '@/features/whatsapp-inbound/sockets/useInboxLiveUpdates.js';
import useOnboardingStepLabel from '@/features/onboarding/useOnboardingStepLabel.js';

import { useLeadAllocations } from './useLeadAllocations.js';
import useInboxViewState from './useInboxViewState.js';
import { useManualConversationLauncher } from './useManualConversationLauncher.js';
import { useInboxAutoRefreshTimer } from './useInboxAutoRefreshTimer.js';
import { useInboxCountBroadcast } from './useInboxCountBroadcast.js';
import { useSavedViewPrompt } from './useSavedViewPrompt.js';
import { useWhatsAppLauncher } from './useWhatsAppLauncher.js';
import { filterAllocationsWithFilters, resolveQueueValue } from '../utils/filtering.js';

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

export const useLeadInboxController = ({
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

  const [activeAllocationId, setActiveAllocationId] = useState(null);
  const [leadPanelSwitching, setLeadPanelSwitching] = useState(false);
  const [inboxScrollParent, setInboxScrollParent] = useState(null);
  const inboxScrollViewportRef = useRef(null);
  const inboxListRef = useRef(null);
  const manualConversationCardRef = useRef(null);
  const pendingFocusPhoneRef = useRef(null);
  const previousContextRef = useRef({
    agreementId: agreementId ?? null,
    campaignId: campaignId ?? null,
    instanceId: resolvedInstanceId ?? null,
  });
  const firstActiveSelectionRef = useRef(true);

  const {
    launch: launchManualConversation,
    isPending: manualConversationPending,
  } = useManualConversationLauncher();

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

  const autoRefreshSeconds = useInboxAutoRefreshTimer(nextRefreshAt);

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
  useInboxCountBroadcast(filteredCount);

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

    const index = filteredAllocations.findIndex((item) => item.allocationId === activeAllocationId);

    if (index < 0) {
      return;
    }

    inboxListRef.current?.scrollToIndex?.({
      index,
      align: 'center',
      behavior: 'smooth',
    });
  }, [activeAllocationId, filteredAllocations, inboxScrollParent]);

  const registerInboxScrollViewport = useCallback((node) => {
    const nextNode = node ?? null;
    inboxScrollViewportRef.current = nextNode;
    setInboxScrollParent((current) => (current === nextNode ? current : nextNode));
  }, []);

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

  const { openWhatsAppForAllocation } = useWhatsAppLauncher();

  const handleOpenWhatsApp = useCallback(
    (allocation) => {
      openWhatsAppForAllocation(allocation);
    },
    [openWhatsAppForAllocation]
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
  }, []);

  const handleManualConversationSuccess = useCallback(
    async (result, payload) => {
      toast.success('Conversa iniciada', {
        id: MANUAL_CONVERSATION_TOAST_ID,
        duration: 2500,
        position: 'bottom-right',
      });

      const sanitizedPhone = result?.phone ?? payload?.phone ?? '';
      pendingFocusPhoneRef.current = sanitizedPhone ? sanitizedPhone : null;

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
    [refresh]
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
    if (typeof window !== 'undefined') {
      window.open(`/api/lead-engine/allocations/export?${params.toString()}`, '_blank');
    }
  }, [agreementId, campaignId, filters.status, resolvedInstanceId]);

  const filteredSavedViews = savedViewsWithCount;
  const handleSaveCurrentView = useSavedViewPrompt({
    canSaveView: canSaveCurrentView,
    matchingView: matchingSavedView,
    savedViewsCount: savedViews.length,
    saveCurrentView,
    selectSavedView,
  });

  const inboxFallbackNumber = Math.max(
    1,
    typeof onboarding?.activeStep === 'number' ? onboarding.activeStep + 1 : 4
  );
  const { stepLabel } = useOnboardingStepLabel({
    stages: onboarding?.stages,
    targetStageId: 'inbox',
    fallbackStep: { number: inboxFallbackNumber, label: `Passo ${inboxFallbackNumber}` },
  });

  const showRealtimeConnecting = !realtimeConnected && !connectionError;
  const showRealtimeError = Boolean(connectionError);
  const showErrorNotice = Boolean(error);
  const showWarningNotice = !error && Boolean(warningMessage);
  const hasNotices =
    showRealtimeConnecting || showRealtimeError || showErrorNotice || showWarningNotice;

  return {
    campaign,
    onboarding,
    stepLabel,
    filters,
    onUpdateFilters: handleUpdateFilters,
    onResetFilters: handleResetFilters,
    queueOptions,
    savedViews: filteredSavedViews,
    activeViewId,
    onSelectSavedView: handleSelectSavedView,
    onSaveCurrentView: handleSaveCurrentView,
    onDeleteSavedView: handleDeleteSavedView,
    canSaveView: canSaveCurrentView,
    allocations,
    filteredAllocations,
    loading,
    selectedAgreement,
    onSelectAgreement,
    onBackToWhatsApp,
    onSelectAllocation: handleSelectAllocation,
    activeAllocationId,
    onOpenWhatsApp: handleOpenWhatsApp,
    inboxListRef,
    registerInboxScrollViewport,
    scrollParent: inboxScrollParent,
    hasNotices,
    showRealtimeConnecting,
    showRealtimeError,
    connectionError,
    error,
    warningMessage,
    activeAllocation,
    leadPanelSwitching,
    onUpdateAllocationStatus: handleUpdateAllocationStatus,
    onManualConversationSubmit: handleManualConversationSubmit,
    onManualConversationSuccess: handleManualConversationSuccess,
    manualConversationPending,
    manualConversationCardRef,
    onOpenManualConversationCard: handleOpenManualConversationCard,
    summary,
    autoRefreshSeconds,
    lastUpdatedAt,
    refresh,
    rateLimitInfo,
    onExport: handleExport,
  };
};

export default useLeadInboxController;
