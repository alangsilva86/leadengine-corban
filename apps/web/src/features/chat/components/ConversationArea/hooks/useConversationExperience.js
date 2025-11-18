import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import useAiSuggestions from '../../../hooks/useAiSuggestions.js';
import { normalizeConfidence } from '../../../utils/aiSuggestions.js';
import useChatAutoscroll from '../../../hooks/useChatAutoscroll.js';
import useAiReplyStream from '../../../hooks/useAiReplyStream.js';
import emitInboxTelemetry from '../../../utils/telemetry.js';
import { buildAiContextTimeline } from '../../../utils/aiTimeline.js';
import { useTicketMessages } from './useTicketMessages.js';
import { useWhatsAppPresence } from './useWhatsAppPresence.js';
import { useSLAClock } from './useSLAClock.js';
import { useConversationScroll } from './useConversationScroll.js';
import { useComposerMetrics } from './useComposerMetrics.js';
import useWhatsAppInstances from '@/features/whatsapp/hooks/useWhatsAppInstances.jsx';
import {
  STAGE_LABELS,
  getTicketStage,
  getStageValue,
  formatStageLabel,
  normalizeStage,
  applyStageSalesHints,
  getSalesStageOrder,
} from '../utils/stage.js';

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const describeInstanceStatus = (status, connected) => {
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : null;
  const map = {
    connected: { label: 'Conectada', tone: 'success' },
    connecting: { label: 'Conectando', tone: 'info' },
    disconnected: { label: 'Desconectada', tone: 'warning' },
    qr_required: { label: 'QR necessário', tone: 'warning' },
    error: { label: 'Erro', tone: 'danger' },
  };
  if (normalized && map[normalized]) {
    return map[normalized];
  }
  return connected ? map.connected : { label: 'Indefinido', tone: 'muted' };
};

const normalizeSalesTimelineEvent = (entry, fallbackIndex = 0) => {
  if (!entry) {
    return null;
  }

  const rawType = typeof entry.type === 'string' ? entry.type : '';
  const [kind] = rawType.split('.');
  if (!kind || (kind !== 'simulation' && kind !== 'proposal' && kind !== 'deal')) {
    return null;
  }

  const payload = entry.payload && typeof entry.payload === 'object' ? entry.payload : {};
  const stageSource =
    payload.stage ?? entry.stage ?? payload.stageValue ?? payload.stage_key ?? null;
  const normalizedStage = normalizeStage(stageSource);
  const stageKey = normalizedStage !== 'DESCONHECIDO' ? normalizedStage : null;
  const stageLabel = stageKey ? formatStageLabel(stageKey) : null;
  const stageValue = stageKey ? getStageValue(stageKey) : null;

  const resourceIdCandidate =
    payload.simulationId ??
    payload.simulation_id ??
    payload.proposalId ??
    payload.proposal_id ??
    payload.dealId ??
    payload.deal_id ??
    payload.id ??
    entry.id ??
    null;

  return {
    id: entry.id ?? `${kind}-${fallbackIndex}`,
    type: kind,
    stageKey,
    stageLabel,
    stageValue,
    calculationSnapshot: payload.calculationSnapshot ?? payload.snapshot ?? null,
    metadata: payload.metadata ?? entry.metadata ?? null,
    resourceId: typeof resourceIdCandidate === 'string' ? resourceIdCandidate : null,
    createdAt: entry.createdAt ?? entry.timestamp ?? entry.date ?? null,
    closedAt: payload.closedAt ?? payload.closed_at ?? null,
    raw: entry,
  };
};

const extractLatestSalesEvents = (timeline) => {
  const result = { simulation: null, proposal: null, deal: null };
  if (!Array.isArray(timeline)) {
    return result;
  }

  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const normalized = normalizeSalesTimelineEvent(timeline[index], index);
    if (!normalized) {
      continue;
    }

    if (normalized.type === 'simulation' && !result.simulation) {
      result.simulation = normalized;
      continue;
    }

    if (normalized.type === 'proposal' && !result.proposal) {
      result.proposal = normalized;
      continue;
    }

    if (normalized.type === 'deal' && !result.deal) {
      result.deal = normalized;
    }
  }

  return result;
};

export const useConversationExperience = ({
  ticket,
  conversation,
  messagesQuery,
  typingIndicator,
  onSendMessage,
  onCreateNote,
  onSendTemplate,
  onCreateNextStep,
  onRegisterResult,
  onRegisterCallResult,
  onAssign,
  onGenerateProposal,
  onScheduleFollowUp,
  onSendSMS,
  onEditContact,
  onContactFieldSave = async () => {},
  onDealFieldSave = async () => {},
  nextStepValue = '',
  onNextStepSave = async () => {},
  isRegisteringResult = false,
  currentUser = null,
  isSending = false,
  sendError = null,
  composerDisabled = false,
  composerDisabledReason = null,
  aiMode,
  aiConfidence,
  aiModeChangeDisabled = false,
  onAiModeChange,
  onTakeOver,
  onGiveBackToAi,
  sales = {},
  composerNotice: composerNoticeProp = null,
}) => {
  const disabled = Boolean(composerDisabled);

  const ticketId = ticket?.id ?? null;
  const tenantId = ticket?.tenantId ?? null;
  const queueId = ticket?.queueId ?? null;
  const ai = useAiSuggestions({ ticketId, tenantId, queueId });
  const { scrollRef, scrollToBottom, isNearBottom } = useChatAutoscroll();
  const composerRef = useRef(null);
  const composerApiRef = useRef(null);
  const aiReplyStream = useAiReplyStream();
  const stageOptions = useMemo(
    () =>
      Object.entries(STAGE_LABELS)
        .filter(([key]) => key !== 'DESCONHECIDO')
        .map(([key, label]) => ({
          key,
          label,
          value: getStageValue(key),
        })),
    [],
  );
  const ticketStageKey = useMemo(() => getTicketStage(ticket), [ticket]);
  const defaultStageValue =
    ticketStageKey && ticketStageKey !== 'DESCONHECIDO' ? getStageValue(ticketStageKey) : '';
  const ticketStageLabel =
    ticketStageKey && ticketStageKey !== 'DESCONHECIDO'
      ? formatStageLabel(ticketStageKey)
      : null;
  const ticketLeadId =
    (ticket?.lead && ticket.lead.id) ??
    ticket?.leadId ??
    ticket?.metadata?.leadId ??
    null;
  const latestSalesEvents = useMemo(
    () => extractLatestSalesEvents(ticket?.salesTimeline ?? []),
    [ticket?.salesTimeline],
  );
  const lastSimulationEvent = latestSalesEvents.simulation;
  const lastProposalEvent = latestSalesEvents.proposal;
  const lastDealEvent = latestSalesEvents.deal;
  const timelineSalesState = useMemo(
    () => ({
      hasSimulation: Boolean(lastSimulationEvent),
      hasProposal: Boolean(lastProposalEvent),
      hasDeal: Boolean(lastDealEvent),
    }),
    [lastDealEvent, lastProposalEvent, lastSimulationEvent],
  );
  const mergedSalesState = useMemo(
    () => applyStageSalesHints(ticketStageKey, timelineSalesState),
    [ticketStageKey, timelineSalesState],
  );
  const { hasSimulation, hasProposal, hasDeal } = mergedSalesState;
  const canOpenSimulation = !hasDeal;
  const canOpenProposal = hasSimulation && !hasDeal;
  const canOpenDeal = hasProposal && !hasDeal;
  const contactName = ticket?.contact?.name ?? ticket?.subject ?? '';
  const salesJourney = useMemo(
    () => ({
      stageKey: ticketStageKey,
      stageLabel: ticketStageLabel,
      nextAction: hasDeal
        ? { id: 'sales-done', label: 'Contrato concluído', disabled: true }
        : hasProposal
          ? { id: 'sales-deal', label: 'Registrar negócio' }
          : hasSimulation
            ? { id: 'sales-proposal', label: 'Gerar proposta' }
            : { id: 'sales-simulate', label: 'Simular proposta' },
      actions: {
        canSimulate: canOpenSimulation,
        canPropose: canOpenProposal,
        canDeal: canOpenDeal,
      },
      events: {
        simulation: lastSimulationEvent,
        proposal: lastProposalEvent,
        deal: lastDealEvent,
      },
    }),
    [
      canOpenDeal,
      canOpenProposal,
      canOpenSimulation,
      hasDeal,
      hasProposal,
      hasSimulation,
      lastDealEvent,
      lastProposalEvent,
      lastSimulationEvent,
      ticketStageKey,
      ticketStageLabel,
    ],
  );
  const salesConfig = sales ?? {};
  const createSimulation = salesConfig.onCreateSimulation ?? salesConfig.createSimulation ?? null;
  const createProposal = salesConfig.onCreateProposal ?? salesConfig.createProposal ?? null;
  const createDeal = salesConfig.onCreateDeal ?? salesConfig.createDeal ?? null;
  const isCreatingSimulation = Boolean(
    salesConfig.isCreatingSimulation ?? salesConfig.simulationPending ?? false,
  );
  const isCreatingProposal = Boolean(
    salesConfig.isCreatingProposal ?? salesConfig.proposalPending ?? false,
  );
  const isCreatingDeal = Boolean(salesConfig.isCreatingDeal ?? salesConfig.dealPending ?? false);
  const queueAlerts = Array.isArray(salesConfig.queueAlerts) ? salesConfig.queueAlerts : [];
  const resolvedSalesReason =
    salesConfig.disabledReason ??
    (queueAlerts.length > 0
      ? 'Fila padrão indisponível. Configure as filas para registrar operações de vendas.'
      : null);
  const salesBlocked = Boolean(salesConfig.disabled) || queueAlerts.length > 0;
  const [salesDialog, setSalesDialog] = useState({ type: null, defaults: {} });
  const resolveTargetStageValue = useCallback(
    (targetStageKey) => {
      if (!targetStageKey) {
        return defaultStageValue;
      }

      const targetOrder = getSalesStageOrder(targetStageKey);
      const currentOrder = getSalesStageOrder(ticketStageKey);

      if (
        ticketStageKey &&
        ticketStageKey !== 'DESCONHECIDO' &&
        targetOrder !== null &&
        currentOrder !== null &&
        currentOrder >= targetOrder
      ) {
        return defaultStageValue;
      }

      return getStageValue(targetStageKey);
    },
    [defaultStageValue, ticketStageKey],
  );
  const closeSalesDialog = useCallback(() => setSalesDialog({ type: null, defaults: {} }), []);
  const ensureSalesAvailable = useCallback(() => {
    if (salesBlocked) {
      if (resolvedSalesReason) {
        toast.warning(resolvedSalesReason);
      } else {
        toast.warning('Operações de vendas indisponíveis no momento.');
      }
      return false;
    }

    if (!ticketId) {
      toast.warning('Selecione um atendimento para registrar operações de vendas.');
      return false;
    }

    return true;
  }, [resolvedSalesReason, salesBlocked, ticketId]);
  const handleOpenSimulation = useCallback(() => {
    if (!ensureSalesAvailable() || !canOpenSimulation) {
      return;
    }

    setSalesDialog({
      type: 'simulation',
      defaults: {
        stage: resolveTargetStageValue('SIMULADO'),
        leadId: ticketLeadId ?? '',
        calculationSnapshot: lastSimulationEvent?.calculationSnapshot ?? null,
        metadata: lastSimulationEvent?.metadata ?? null,
        ticketId,
        contactName,
      },
    });
  }, [
    canOpenSimulation,
    contactName,
    ensureSalesAvailable,
    lastSimulationEvent?.calculationSnapshot,
    lastSimulationEvent?.metadata,
    resolveTargetStageValue,
    ticketId,
    ticketLeadId,
  ]);
  const handleOpenProposal = useCallback(() => {
    if (!ensureSalesAvailable() || !canOpenProposal) {
      return;
    }

    setSalesDialog({
      type: 'proposal',
      defaults: {
        stage: resolveTargetStageValue('PROPOSTA_ENVIADA'),
        leadId: ticketLeadId ?? '',
        simulationId: lastSimulationEvent?.resourceId ?? '',
        calculationSnapshot: lastProposalEvent?.calculationSnapshot ?? null,
        simulationSnapshot: lastSimulationEvent?.calculationSnapshot ?? null,
        metadata: lastProposalEvent?.metadata ?? null,
        ticketId,
        contactName,
      },
    });
  }, [
    canOpenProposal,
    contactName,
    ensureSalesAvailable,
    lastProposalEvent?.calculationSnapshot,
    lastProposalEvent?.metadata,
    lastSimulationEvent?.calculationSnapshot,
    lastSimulationEvent?.resourceId,
    resolveTargetStageValue,
    ticketId,
    ticketLeadId,
  ]);
  const handleOpenDeal = useCallback(() => {
    if (!ensureSalesAvailable() || !canOpenDeal) {
      return;
    }

    setSalesDialog({
      type: 'deal',
      defaults: {
        stage: resolveTargetStageValue('CONCLUIDO'),
        leadId: ticketLeadId ?? '',
        simulationId: lastSimulationEvent?.resourceId ?? '',
        proposalId: lastProposalEvent?.resourceId ?? '',
        calculationSnapshot: lastDealEvent?.calculationSnapshot ?? null,
        metadata: lastDealEvent?.metadata ?? null,
        closedAt: lastDealEvent?.closedAt ?? null,
        proposalSnapshot: lastProposalEvent?.calculationSnapshot ?? null,
      },
    });
  }, [
    canOpenDeal,
    ensureSalesAvailable,
    lastDealEvent?.calculationSnapshot,
    lastDealEvent?.closedAt,
    lastDealEvent?.metadata,
    lastProposalEvent?.calculationSnapshot,
    lastProposalEvent?.resourceId,
    lastSimulationEvent?.resourceId,
    resolveTargetStageValue,
    ticketLeadId,
  ]);
  const handleSubmitSimulation = useCallback(
    async (input) => {
      if (!createSimulation || !ticketId) {
        toast.error('Selecione um ticket para registrar a simulação.');
        return;
      }

      try {
        await createSimulation({
          ticketId,
          calculationSnapshot: input.calculationSnapshot,
          leadId: input.leadId ?? null,
          stage: input.stage ?? null,
          metadata: input.metadata ?? null,
        });
        closeSalesDialog();
      } catch {
        // feedback tratado a montante
      }
    },
    [closeSalesDialog, createSimulation, ticketId],
  );
  const handleSubmitProposal = useCallback(
    async (input) => {
      if (!createProposal || !ticketId) {
        toast.error('Selecione um ticket para registrar a proposta.');
        return;
      }

      try {
        await createProposal({
          ticketId,
          calculationSnapshot: input.calculationSnapshot,
          leadId: input.leadId ?? null,
          simulationId: input.simulationId ?? null,
          stage: input.stage ?? null,
          metadata: input.metadata ?? null,
        });
        closeSalesDialog();
      } catch {
        // feedback tratado a montante
      }
    },
    [closeSalesDialog, createProposal, ticketId],
  );
  const handleSubmitDeal = useCallback(
    async (input) => {
      if (!createDeal || !ticketId) {
        toast.error('Selecione um ticket para registrar o negócio.');
        return;
      }

      try {
        await createDeal({
          ticketId,
          calculationSnapshot: input.calculationSnapshot,
          leadId: input.leadId ?? null,
          simulationId: input.simulationId ?? null,
          proposalId: input.proposalId ?? null,
          stage: input.stage ?? null,
          metadata: input.metadata ?? null,
          closedAt: input.closedAt ?? null,
        });
        closeSalesDialog();
      } catch {
        // feedback tratado a montante
      }
    },
    [closeSalesDialog, createDeal, ticketId],
  );

  const {
    timelineItems: messageTimelineItems,
    hasMore,
    isLoadingMore,
    handleLoadMore,
    lastEntryKey: messageLastEntryKey,
  } = useTicketMessages(messagesQuery);
  const { composerHeight } = useComposerMetrics(composerRef, ticketId);
  const { typingAgents, broadcastTyping } = useWhatsAppPresence({ typingIndicator, ticketId });
  const slaClock = useSLAClock(ticket);
  const {
    instances: whatsappInstances = [],
    loadingInstances = false,
    loadInstances,
    instancesReady = false,
  } = useWhatsAppInstances();
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const requestedInstancesRef = useRef(false);
  const ticketRef = useRef(null);

  useEffect(() => {
    if (requestedInstancesRef.current) {
      return;
    }
    requestedInstancesRef.current = true;
    loadInstances({ forceRefresh: false }).catch(() => {});
  }, [loadInstances]);

  const defaultInstanceId = useMemo(() => {
    if (!ticket || !isRecord(ticket.metadata)) {
      return null;
    }
    const metadata = ticket.metadata;
    const whatsappMeta = isRecord(metadata.whatsapp) ? metadata.whatsapp : {};
    const candidates = [
      whatsappMeta.instanceId,
      metadata.instanceId,
      whatsappMeta.instance_id,
      metadata.instance_id,
      whatsappMeta.instance,
      metadata.whatsappInstanceId,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
    return null;
  }, [ticket]);

  useEffect(() => {
    const currentTicketId = ticket?.id ?? null;
    if (ticketRef.current !== currentTicketId) {
      ticketRef.current = currentTicketId;
      setSelectedInstanceId(defaultInstanceId ?? null);
    }
  }, [defaultInstanceId, ticket?.id]);

  const instanceOptions = useMemo(() => {
    if (!Array.isArray(whatsappInstances)) {
      return [];
    }

    const options = whatsappInstances
      .filter((instance) => instance && typeof instance.id === 'string' && instance.id.trim().length > 0)
      .map((instance) => {
        const status =
          typeof instance.status === 'string' && instance.status.trim().length > 0
            ? instance.status.trim().toLowerCase()
            : null;
        const connected = instance.connected === true || status === 'connected';
        const statusInfo = describeInstanceStatus(status, connected);
        const primaryLabel =
          typeof instance.name === 'string' && instance.name.trim().length > 0
            ? instance.name.trim()
            : typeof instance.displayId === 'string' && instance.displayId.trim().length > 0
              ? instance.displayId.trim()
              : instance.id;
        const phone =
          typeof instance.phoneNumber === 'string' && instance.phoneNumber.trim().length > 0
            ? instance.phoneNumber.trim()
            : typeof instance.metadata === 'object' && instance.metadata !== null
              ? (() => {
                  const meta = instance.metadata;
                  const candidates = [meta?.phoneNumber, meta?.phone, meta?.number, meta?.msisdn];
                  for (const candidate of candidates) {
                    if (typeof candidate === 'string' && candidate.trim().length > 0) {
                      return candidate.trim();
                    }
                  }
                  return null;
                })()
              : null;

        const description =
          phone ??
          (typeof instance.displayId === 'string' && instance.displayId.trim().length > 0
            ? instance.displayId.trim()
            : instance.id);

        return {
          id: instance.id,
          label: primaryLabel,
          description,
          status: status ?? (connected ? 'connected' : 'disconnected'),
          statusLabel: statusInfo.label,
          statusTone: statusInfo.tone,
          connected,
          isDefault: instance.id === defaultInstanceId,
        };
      })
      .sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        if (a.connected && !b.connected) return -1;
        if (!a.connected && b.connected) return 1;
        return a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' });
      });

    return options;
  }, [defaultInstanceId, whatsappInstances]);

  useEffect(() => {
    if (instanceOptions.length === 0) {
      if (selectedInstanceId !== null) {
        setSelectedInstanceId(null);
      }
      return;
    }

    if (selectedInstanceId) {
      const exists = instanceOptions.some((option) => option.id === selectedInstanceId);
      if (!exists) {
        const fallback =
          instanceOptions.find((option) => option.id === defaultInstanceId) ??
          instanceOptions.find((option) => option.connected) ??
          instanceOptions[0] ??
          null;
        const nextId = fallback?.id ?? null;
        if (nextId !== selectedInstanceId) {
          setSelectedInstanceId(nextId);
        }
      }
      return;
    }

    const preferred =
      (defaultInstanceId &&
        instanceOptions.find((option) => option.id === defaultInstanceId)) ??
      instanceOptions.find((option) => option.connected) ??
      instanceOptions[0] ??
      null;
    const nextId = preferred?.id ?? null;
    if (nextId !== selectedInstanceId) {
      setSelectedInstanceId(nextId);
    }
  }, [defaultInstanceId, instanceOptions, selectedInstanceId]);

  const selectedInstanceOption = useMemo(
    () => instanceOptions.find((option) => option.id === selectedInstanceId) ?? null,
    [instanceOptions, selectedInstanceId],
  );

  const defaultInstanceOption = useMemo(
    () => instanceOptions.find((option) => option.id === defaultInstanceId) ?? null,
    [defaultInstanceId, instanceOptions],
  );

  const selectionDiffersFromDefault = useMemo(() => {
    if (!defaultInstanceId || !selectedInstanceOption) {
      return false;
    }
    return selectedInstanceOption.id !== defaultInstanceId;
  }, [defaultInstanceId, selectedInstanceOption]);

  const instanceNotice = useMemo(() => {
    if (instanceOptions.length === 0 && instancesReady) {
      return {
        type: 'error',
        message: 'Nenhuma instância conectada encontrada. Conecte uma instância do WhatsApp para responder.',
      };
    }
    if (!selectedInstanceOption && instanceOptions.length > 0) {
      return {
        type: 'warning',
        message: 'Selecione uma instância para responder esta conversa.',
      };
    }
    if (selectedInstanceOption && !selectedInstanceOption.connected) {
      return {
        type: 'error',
        message: `Instância ${selectedInstanceOption.label} está desconectada. Escolha outra instância ativa antes de enviar.`,
      };
    }
    if (selectionDiffersFromDefault && selectedInstanceOption && selectedInstanceOption.connected) {
      const defaultLabel =
        defaultInstanceOption?.label ??
        defaultInstanceOption?.description ??
        defaultInstanceId ??
        'não definido';
      return {
        type: 'info',
        message: `Respondendo via ${selectedInstanceOption.label}. Instância padrão: ${defaultLabel}.`,
      };
    }
    if (
      defaultInstanceOption &&
      !defaultInstanceOption.connected &&
      !selectionDiffersFromDefault
    ) {
      return {
        type: 'warning',
        message: `Instância padrão (${defaultInstanceOption.label}) está desconectada. Considere selecionar outra instância ativa.`,
      };
    }
    return null;
  }, [
    defaultInstanceId,
    defaultInstanceOption,
    instanceOptions.length,
    instancesReady,
    selectedInstanceOption,
    selectionDiffersFromDefault,
  ]);

  const handleInstanceSelect = useCallback(
    (instanceId) => {
      setSelectedInstanceId(instanceId ?? null);
    },
    [],
  );

  const handleInstanceRefresh = useCallback(() => {
    return loadInstances({ forceRefresh: true }).catch(() => {});
  }, [loadInstances]);

  const composerNotice = useMemo(() => {
    const directNotice = composerNoticeProp ?? (disabled && composerDisabledReason ? composerDisabledReason : null);
    if (!directNotice) {
      return null;
    }
    if (!directNotice.action || directNotice.onAction) {
      return directNotice;
    }
    if (directNotice.action === 'refresh_instances') {
      return {
        ...directNotice,
        onAction: () => handleInstanceRefresh(),
      };
    }
    return directNotice;
  }, [composerNoticeProp, composerDisabledReason, disabled, handleInstanceRefresh]);

  const selectedInstanceConnected =
    selectedInstanceOption?.connected ?? instanceOptions.length === 0;

  const composerInstanceSelector = useMemo(
    () => ({
      options: instanceOptions,
      selectedId: selectedInstanceOption?.id ?? null,
      selectedLabel:
        selectedInstanceOption?.label ?? selectedInstanceOption?.description ?? null,
      selectedStatus: selectedInstanceOption?.status ?? null,
      selectedStatusLabel: selectedInstanceOption?.statusLabel ?? null,
      selectedTone: selectedInstanceOption?.statusTone ?? 'muted',
      selectedConnected: selectedInstanceConnected,
      defaultId: defaultInstanceId ?? null,
      defaultLabel:
        defaultInstanceOption?.label ?? defaultInstanceOption?.description ?? null,
      loading: Boolean(loadingInstances),
      disabled: false,
      onSelect: handleInstanceSelect,
      onRefresh: handleInstanceRefresh,
      notice: instanceNotice,
      isOverride: selectionDiffersFromDefault,
      requireConnected: instanceOptions.length > 0,
      hasInstances: instanceOptions.length > 0,
    }),
    [
      defaultInstanceId,
      defaultInstanceOption,
      handleInstanceRefresh,
      handleInstanceSelect,
      instanceNotice,
      instanceOptions,
      loadingInstances,
      selectedInstanceConnected,
      selectedInstanceOption,
      selectionDiffersFromDefault,
    ],
  );

  useEffect(() => {
    ai.reset();
  }, [ai.reset, queueId, tenantId, ticketId]);

  const combinedTimelineItems = useMemo(() => {
    const conversationTimeline = Array.isArray(conversation?.timeline) ? conversation.timeline : null;
    if (conversationTimeline && conversationTimeline.length > 0) {
      return conversationTimeline;
    }
    return messageTimelineItems;
  }, [conversation?.timeline, messageTimelineItems]);

  const combinedLastEntryKey = useMemo(() => {
    if (combinedTimelineItems.length > 0) {
      const lastEntry = combinedTimelineItems[combinedTimelineItems.length - 1];
      return lastEntry?.id ?? combinedTimelineItems.length;
    }
    return messageLastEntryKey;
  }, [combinedTimelineItems, messageLastEntryKey]);

  useConversationScroll({
    scrollRef,
    ticketId,
    lastEntryKey: combinedLastEntryKey,
    typingAgentsCount: typingAgents.length,
    scrollToBottom,
    onLoadMore: handleLoadMore,
  });

  const handleComposerSend = useCallback(
    (payload) => {
      const basePayload =
        payload && typeof payload === 'object' ? { ...payload } : {};
      const resolvedInstanceId =
        selectedInstanceOption?.id ?? defaultInstanceId ?? null;
      const resolvedInstanceLabel =
        selectedInstanceOption?.label ??
        selectedInstanceOption?.description ??
        defaultInstanceOption?.label ??
        defaultInstanceOption?.description ??
        defaultInstanceId ??
        null;

      if (resolvedInstanceId) {
        basePayload.instanceId = resolvedInstanceId;
      }
      if (resolvedInstanceLabel) {
        basePayload.instanceLabel = resolvedInstanceLabel;
      }
      if (defaultInstanceId) {
        basePayload.defaultInstanceId = defaultInstanceId;
      }

      onSendMessage?.(basePayload);
      aiReplyStream.reset();
    },
    [
      aiReplyStream,
      defaultInstanceId,
      defaultInstanceOption,
      onSendMessage,
      selectedInstanceOption,
    ],
  );

  const handleComposerTemplate = useCallback(
    (template) => {
      if (!template) return;
      const text = template.body ?? template.content ?? template;
      onSendMessage?.({ content: text, template });
    },
    [onSendMessage],
  );

  const handleComposerCreateNote = useCallback(
    (note) => {
      onCreateNote?.(note);
    },
    [onCreateNote],
  );

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom({ behavior: 'smooth', force: true });
  }, [scrollToBottom]);

  const handleAttachFileFromHeader = useCallback(() => {
    composerApiRef.current?.openAttachmentDialog?.();
  }, []);

  const handleFocusComposer = useCallback(() => {
    composerApiRef.current?.focusInput?.();
  }, []);

  const aiState = useMemo(() => {
    const suggestion = ai.data ?? null;
    const confidenceValue =
      typeof suggestion?.confidence === 'number'
        ? suggestion.confidence
        : normalizeConfidence(suggestion?.confidence ?? suggestion?.raw?.confidence ?? null);

    return {
      suggestion,
      confidence: confidenceValue ?? null,
      isLoading: ai.isLoading,
      error: ai.error ?? null,
    };
  }, [ai.data, ai.error, ai.isLoading]);

  const normalizedAiMode = useMemo(() => {
    if (typeof aiMode !== 'string') return 'assist';
    const normalized = aiMode.trim().toLowerCase();
    if (normalized === 'autonomous') return 'auto';
    if (normalized === 'assist' || normalized === 'auto' || normalized === 'manual') {
      return normalized;
    }
    return 'assist';
  }, [aiMode]);

  const requestAiSuggestions = useCallback(
    (payload = {}) => {
      const basePayload = typeof payload === 'object' && payload !== null ? payload : {};

      const mergedPayload = {
        ...basePayload,
        mode: typeof basePayload.mode === 'string' && basePayload.mode.trim()
          ? basePayload.mode
          : normalizedAiMode,
        queueId: basePayload.queueId ?? queueId ?? undefined,
        ticket: basePayload.ticket ?? ticket ?? null,
      };

      if (!mergedPayload.conversationId && ticket?.id) {
        mergedPayload.conversationId = ticket.id;
      }

      return ai.requestSuggestions(mergedPayload);
    },
    [ai.requestSuggestions, normalizedAiMode, queueId, ticket],
  );

  const aiAssistant = useMemo(
    () => ({
      requestSuggestions: requestAiSuggestions,
      isLoading: ai.isLoading,
      data: ai.data ?? null,
      error: ai.error ?? null,
      reset: ai.reset,
      replyStream: aiReplyStream,
      mode: normalizedAiMode,
      queueId,
    }),
    [
      ai.data,
      ai.error,
      ai.isLoading,
      ai.reset,
      aiReplyStream,
      normalizedAiMode,
      queueId,
      requestAiSuggestions,
    ],
  );

  const aiContextTimeline = useMemo(
    () => buildAiContextTimeline(combinedTimelineItems),
    [combinedTimelineItems],
  );

  const aiMetadata = useMemo(
    () => ({
      ticketId: ticket?.id ?? null,
      contactId: ticket?.contact?.id ?? null,
      leadId: ticket?.lead?.id ?? null,
      queueId: ticket?.queueId ?? null,
    }),
    [ticket],
  );

  const simulationModalProps =
    salesDialog.type === 'simulation' || salesDialog.type === 'proposal'
      ? {
          open: true,
          mode: salesDialog.type === 'proposal' ? 'proposal' : 'simulation',
          onOpenChange: (open) => {
            if (!open) {
              closeSalesDialog();
            }
          },
          onSubmit: salesDialog.type === 'proposal' ? handleSubmitProposal : handleSubmitSimulation,
          defaultValues: {
            stage: salesDialog.defaults?.stage ?? '',
            leadId: salesDialog.defaults?.leadId ?? '',
            simulationId: salesDialog.defaults?.simulationId ?? '',
            calculationSnapshot: salesDialog.defaults?.calculationSnapshot ?? null,
            metadata: salesDialog.defaults?.metadata ?? null,
            simulationSnapshot: salesDialog.defaults?.simulationSnapshot ?? null,
            ticketId: salesDialog.defaults?.ticketId ?? null,
            contactName: salesDialog.defaults?.contactName ?? '',
          },
          stageOptions,
          isSubmitting: salesDialog.type === 'proposal' ? isCreatingProposal : isCreatingSimulation,
          disabled: salesBlocked,
          disabledReason: resolvedSalesReason,
          queueAlerts,
        }
      : null;

  const dealDrawerProps =
    salesDialog.type === 'deal'
      ? {
          open: true,
          onOpenChange: (open) => {
            if (!open) {
              closeSalesDialog();
            }
          },
          onSubmit: handleSubmitDeal,
          defaultValues: {
            stage: salesDialog.defaults?.stage ?? '',
            leadId: salesDialog.defaults?.leadId ?? '',
            simulationId: salesDialog.defaults?.simulationId ?? '',
            proposalId: salesDialog.defaults?.proposalId ?? '',
            calculationSnapshot: salesDialog.defaults?.calculationSnapshot ?? null,
            metadata: salesDialog.defaults?.metadata ?? null,
            closedAt: salesDialog.defaults?.closedAt ?? null,
            proposalSnapshot: salesDialog.defaults?.proposalSnapshot ?? null,
          },
          stageOptions,
          isSubmitting: isCreatingDeal,
          disabled: salesBlocked,
          disabledReason: resolvedSalesReason,
          queueAlerts,
        }
      : null;

  const handleGenerateAiReply = useCallback(() => {
    if (!ticket?.id) {
      return;
    }
    void aiReplyStream.start({
      conversationId: ticket.id,
      timeline: aiContextTimeline,
      metadata: aiMetadata,
    });
    emitInboxTelemetry('chat.ai.reply.start', {
      ticketId: ticket.id,
    });
  }, [aiContextTimeline, aiMetadata, aiReplyStream, ticket]);

  const handleCancelAiReply = useCallback(() => {
    aiReplyStream.cancel();
    emitInboxTelemetry('chat.ai.reply.cancel', {
      ticketId: ticket?.id ?? null,
    });
    aiReplyStream.reset();
  }, [aiReplyStream, ticket?.id]);

  useEffect(() => {
    if (
      !composerApiRef.current?.setDraftValue ||
      (aiReplyStream.status !== 'streaming' && aiReplyStream.status !== 'completed')
    ) {
      return;
    }
    composerApiRef.current.setDraftValue(aiReplyStream.message ?? '', { replace: true });
  }, [aiReplyStream.message, aiReplyStream.status]);

  const augmentedTypingAgents = useMemo(() => {
    if (aiReplyStream.status === 'streaming') {
      const alreadyIncludesAi = typingAgents.some((agent) => agent?.id === 'ai-assistant');
      if (alreadyIncludesAi) {
        return typingAgents;
      }
      return [
        ...typingAgents,
        {
          id: 'ai-assistant',
          userName: 'Copiloto IA',
          type: 'ai',
        },
      ];
    }
    return typingAgents;
  }, [aiReplyStream.status, typingAgents]);

  const headerProps = useMemo(
    () => ({
      ticket,
      conversation,
      onRegisterResult,
      onRegisterCallResult,
      onAssign,
      onSendTemplate,
      onCreateNextStep,
      onGenerateProposal: handleOpenProposal,
      onScheduleFollowUp,
      onSendSMS,
      onAttachFile: handleAttachFileFromHeader,
      onEditContact,
      isRegisteringResult,
      onContactFieldSave,
      onDealFieldSave,
      nextStepValue,
      onNextStepSave,
      onFocusComposer: handleFocusComposer,
      currentUser,
      slaClock,
      typingAgents: augmentedTypingAgents,
      composerHeight,
      onCreateNote,
      timeline: combinedTimelineItems,
      aiAssistant,
      aiMode: normalizedAiMode,
      aiConfidence:
        typeof aiConfidence === 'number' && Number.isFinite(aiConfidence)
          ? aiConfidence
          : aiState.confidence ?? null,
      aiModeChangeDisabled: Boolean(aiModeChangeDisabled),
      onAiModeChange,
      onTakeOver,
      onGiveBackToAi,
      onOpenSimulation: canOpenSimulation ? handleOpenSimulation : undefined,
      onOpenDeal: canOpenDeal ? handleOpenDeal : undefined,
    }),
    [
      aiAssistant,
      aiConfidence,
      composerHeight,
      conversation,
      currentUser,
      handleAttachFileFromHeader,
      handleFocusComposer,
      normalizedAiMode,
      aiModeChangeDisabled,
      onAiModeChange,
      onTakeOver,
      onGiveBackToAi,
      isRegisteringResult,
      aiState.confidence,
      nextStepValue,
      onAssign,
      onCreateNote,
      onContactFieldSave,
      onCreateNextStep,
      onDealFieldSave,
      onEditContact,
      handleOpenProposal,
      handleOpenSimulation,
      handleOpenDeal,
      onNextStepSave,
      onRegisterCallResult,
      onRegisterResult,
      onScheduleFollowUp,
      onSendSMS,
      onSendTemplate,
      slaClock,
      ticket,
      queueId,
      augmentedTypingAgents,
    ],
  );

  return {
    timeline: {
      items: combinedTimelineItems,
      hasMore,
      isLoadingMore,
      onLoadMore: handleLoadMore,
      typingAgents: augmentedTypingAgents,
      scrollRef,
      showNewMessagesHint: !isNearBottom,
      onScrollToBottom: handleScrollToBottom,
    },
    composer: {
      ref: composerRef,
      apiRef: composerApiRef,
      notice: composerNotice,
      disabled,
      onSend: handleComposerSend,
      onTemplate: handleComposerTemplate,
      onCreateNote: handleComposerCreateNote,
      onTyping: broadcastTyping,
      aiState,
      isSending,
      sendError,
      aiMode: normalizedAiMode,
      aiModeChangeDisabled: Boolean(aiModeChangeDisabled),
      onAiModeChange,
      aiStreaming: {
        status: aiReplyStream.status,
        error: aiReplyStream.error,
        toolCalls: aiReplyStream.toolCalls,
        onGenerate: handleGenerateAiReply,
        onCancel: handleCancelAiReply,
        reset: aiReplyStream.reset,
      },
      instanceSelector: composerInstanceSelector,
    },
    header: {
      props: headerProps,
    },
    sales: {
      disabled: salesBlocked,
      disabledReason: resolvedSalesReason,
      handlers: {
        openSimulation: canOpenSimulation ? handleOpenSimulation : null,
        openProposal: canOpenProposal ? handleOpenProposal : null,
        openDeal: canOpenDeal ? handleOpenDeal : null,
      },
      simulationModal: simulationModalProps,
      dealDrawer: dealDrawerProps,
      journey: salesJourney,
    },
  };
};

export default useConversationExperience;
