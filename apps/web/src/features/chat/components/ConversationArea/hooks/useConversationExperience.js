import { useCallback, useEffect, useMemo, useRef } from 'react';
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

  const { timelineItems, hasMore, isLoadingMore, handleLoadMore, lastEntryKey } = useTicketMessages(messagesQuery);
  const { composerHeight } = useComposerMetrics(composerRef, ticketId);
  const { typingAgents, broadcastTyping } = useWhatsAppPresence({ typingIndicator, ticketId });
  const slaClock = useSLAClock(ticket);

  useEffect(() => {
    ai.reset();
  }, [ai.reset, queueId, tenantId, ticketId]);

  useConversationScroll({
    scrollRef,
    ticketId,
    lastEntryKey,
    typingAgentsCount: typingAgents.length,
    scrollToBottom,
    onLoadMore: handleLoadMore,
  });

  const handleComposerSend = useCallback(
    (payload) => {
      onSendMessage?.(payload);
      aiReplyStream.reset();
    },
    [aiReplyStream, onSendMessage],
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
    () => buildAiContextTimeline(timelineItems),
    [timelineItems],
  );

  const aiMetadata = useMemo(
    () => ({
      ticketId: ticket?.id ?? null,
      contactId: ticket?.contact?.id ?? null,
      leadId: ticket?.lead?.id ?? null,
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
      onGenerateProposal,
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
      timeline: conversation?.timeline ?? [],
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
      onGenerateProposal,
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
      items: timelineItems,
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
    },
    header: {
      props: headerProps,
    },
  };
};

export default useConversationExperience;
