import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { getTicketIdentity } from '../../../utils/ticketIdentity.js';
import { isTicketClosed, resolveTicketInstanceId, resolveWindowState } from '../utils/presentation.js';

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const describeInstanceStatus = (status, connected) => {
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : null;
  const map = {
    connected: { label: 'Conectado', tone: 'success' },
    connecting: { label: 'Conectando', tone: 'info' },
    disconnected: { label: 'Desconectado', tone: 'warning' },
    qr_required: { label: 'Precisa ler o QR Code', tone: 'warning' },
    error: { label: 'Com erro', tone: 'danger' },
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
  onStageChange,
  pendingStage = null,
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
  onReopen,
  onBack,
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

  const {
    timelineItems: messageTimelineItems,
    hasMore,
    isLoadingMore,
    handleLoadMore,
    lastEntryKey: messageLastEntryKey,
  } = useTicketMessages(messagesQuery);
  const { composerHeight } = useComposerMetrics(composerRef, ticketId);
  // Outros atendentes nesta conversa: vão para o aviso acima do composer (não para a timeline/cabeçalho, onde o
  // "digitando…" seria confundido com o cliente).
  const { typingAgents, viewers, broadcastTyping } = useWhatsAppPresence({ typingIndicator, ticketId });
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

  const defaultInstanceId = useMemo(() => resolveTicketInstanceId(ticket), [ticket]);

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
        message: 'Nenhum número de WhatsApp conectado. Conecte um número para responder.',
      };
    }
    if (!selectedInstanceOption && instanceOptions.length > 0) {
      return {
        type: 'warning',
        message: 'Escolha por qual número responder esta conversa.',
      };
    }
    if (selectedInstanceOption && !selectedInstanceOption.connected) {
      return {
        type: 'error',
        message: `O número ${selectedInstanceOption.label} está desconectado. Escolha outro número antes de enviar.`,
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
        message: `Respondendo por ${selectedInstanceOption.label}. Número padrão: ${defaultLabel}.`,
      };
    }
    if (
      defaultInstanceOption &&
      !defaultInstanceOption.connected &&
      !selectionDiffersFromDefault
    ) {
      return {
        type: 'warning',
        message: `O número padrão (${defaultInstanceOption.label}) está desconectado. Considere enviar por outro número.`,
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
      ready: Boolean(instancesReady),
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
      instancesReady,
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
    // Só o "digitando" da IA aparece na timeline; o de outros atendentes não deve rolar a conversa.
    typingAgentsCount: aiReplyStream.status === 'streaming' ? 1 : 0,
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

      return onSendMessage?.(basePayload);
    },
    [
      aiReplyStream,
      defaultInstanceId,
      defaultInstanceOption,
      onSendMessage,
      selectedInstanceOption,
    ],
  );

  // Modelos nunca são enviados sozinhos: abrimos o seletor e o texto vai para o composer.
  const handleOpenTemplates = useCallback(() => {
    composerApiRef.current?.openTemplatePicker?.();
  }, []);

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

  // Cabeçalho e timeline mostram só o Copiloto IA escrevendo.
  const augmentedTypingAgents = useMemo(() => {
    if (aiReplyStream.status === 'streaming') {
      return [
        {
          id: 'ai-assistant',
          userName: 'Copiloto IA',
          type: 'ai',
        },
      ];
    }
    return [];
  }, [aiReplyStream.status]);

  const contactIdentity = useMemo(() => getTicketIdentity(ticket), [ticket]);
  const windowState = useMemo(() => resolveWindowState(ticket), [ticket]);
  const ticketClosed = isTicketClosed(ticket);

  const headerProps = useMemo(
    () => ({
      ticket,
      conversation,
      onRegisterResult,
      onRegisterCallResult,
      onAssign,
      onCreateNextStep,
      onGenerateProposal,
      onScheduleFollowUp,
      onSendSMS,
      onAttachFile: handleAttachFileFromHeader,
      onOpenTemplates: handleOpenTemplates,
      onBack,
      onEditContact,
      isRegisteringResult,
      onContactFieldSave,
      onDealFieldSave,
      nextStepValue,
      onNextStepSave,
      onStageChange,
      pendingStage,
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
      handleOpenTemplates,
      onBack,
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
      onGenerateProposal,
      onNextStepSave,
      onStageChange,
      pendingStage,
      onRegisterCallResult,
      onRegisterResult,
      onScheduleFollowUp,
      onSendSMS,
      slaClock,
      ticket,
      queueId,
      augmentedTypingAgents,
    ],
  );

  return {
    timeline: {
      items: combinedTimelineItems,
      isInitialLoading: Boolean(messagesQuery?.isLoading),
      error: messagesQuery?.isError ? messagesQuery.error ?? null : null,
      onRetry: () => messagesQuery?.refetch?.(),
      windowState,
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
      onCreateNote: handleComposerCreateNote,
      ticketId,
      contactName: contactIdentity.displayName ?? null,
      windowState,
      closed: ticketClosed,
      onReopen,
      aiAutonomous: normalizedAiMode === 'auto' && typeof onTakeOver === 'function',
      onTakeOver,
      onTyping: broadcastTyping,
      teammatesTyping: typingAgents,
      teammatesViewing: viewers,
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
  };
};

export default useConversationExperience;
