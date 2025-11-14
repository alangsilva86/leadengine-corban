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
import { STAGE_LABELS, getTicketStage, getStageValue } from '../utils/stage.js';

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
}) => {
  const disabled = Boolean(composerDisabled);
  const composerNotice = disabled && composerDisabledReason ? composerDisabledReason : null;

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
  const ticketLeadId =
    (ticket?.lead && ticket.lead.id) ??
    ticket?.leadId ??
    ticket?.metadata?.leadId ??
    null;
  const lastSimulationId = useMemo(() => {
    if (!Array.isArray(ticket?.salesTimeline)) {
      return null;
    }
    for (let index = ticket.salesTimeline.length - 1; index >= 0; index -= 1) {
      const entry = ticket.salesTimeline[index];
      const type = typeof entry?.type === 'string' ? entry.type : '';
      if (!type) continue;
      const kind = type.split('.')[0];
      if (type === 'simulation.created' || kind === 'simulation') {
        const payload = entry.payload ?? {};
        return (
          payload.simulationId ??
          payload.simulation_id ??
          payload.id ??
          (typeof entry.id === 'string' ? entry.id : null)
        );
      }
    }
    return null;
  }, [ticket?.salesTimeline]);
  const lastProposalId = useMemo(() => {
    if (!Array.isArray(ticket?.salesTimeline)) {
      return null;
    }
    for (let index = ticket.salesTimeline.length - 1; index >= 0; index -= 1) {
      const entry = ticket.salesTimeline[index];
      const type = typeof entry?.type === 'string' ? entry.type : '';
      if (!type) {
        continue;
      }
      const kind = type.split('.')[0];
      if (type === 'proposal.created' || kind === 'proposal') {
        const payload = entry.payload ?? {};
        return payload.proposalId ?? payload.id ?? (typeof entry.id === 'string' ? entry.id : null);
      }
    }
    return null;
  }, [ticket?.salesTimeline]);
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
    if (!ensureSalesAvailable()) {
      return;
    }

    setSalesDialog({
      type: 'simulation',
      defaults: {
        stage: defaultStageValue,
        leadId: ticketLeadId ?? '',
      },
    });
  }, [defaultStageValue, ensureSalesAvailable, ticketLeadId]);
  const handleOpenProposal = useCallback(() => {
    if (!ensureSalesAvailable()) {
      return;
    }

    setSalesDialog({
      type: 'proposal',
      defaults: {
        stage: defaultStageValue,
        leadId: ticketLeadId ?? '',
        simulationId: lastSimulationId ?? '',
      },
    });
  }, [defaultStageValue, ensureSalesAvailable, lastSimulationId, ticketLeadId]);
  const handleOpenDeal = useCallback(() => {
    if (!ensureSalesAvailable()) {
      return;
    }

    setSalesDialog({
      type: 'deal',
      defaults: {
        stage: defaultStageValue,
        leadId: ticketLeadId ?? '',
        simulationId: lastSimulationId ?? '',
        proposalId: lastProposalId ?? '',
      },
    });
  }, [defaultStageValue, ensureSalesAvailable, lastProposalId, lastSimulationId, ticketLeadId]);
  const handleSubmitSimulation = useCallback(
    async (input) => {
      if (!createSimulation || !ticketId) {
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
          },
          stageOptions,
          isSubmitting: salesDialog.type === 'proposal' ? isCreatingProposal : isCreatingSimulation,
          disabled: salesBlocked,
          disabledReason: resolvedSalesReason,
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
          },
          stageOptions,
          isSubmitting: isCreatingDeal,
          disabled: salesBlocked,
          disabledReason: resolvedSalesReason,
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
        openSimulation: handleOpenSimulation,
        openProposal: handleOpenProposal,
        openDeal: handleOpenDeal,
      },
      simulationModal: simulationModalProps,
      dealDrawer: dealDrawerProps,
    },
  };
};

export default useConversationExperience;
