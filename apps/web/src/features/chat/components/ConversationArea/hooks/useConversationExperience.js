import { useCallback, useEffect, useMemo, useRef } from 'react';
import useAiSuggestions from '../../../hooks/useAiSuggestions.js';
import { formatAiSuggestionNote, normalizeConfidence } from '../../../utils/aiSuggestions.js';
import useChatAutoscroll from '../../../hooks/useChatAutoscroll.js';
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
}) => {
  const disabled = Boolean(composerDisabled);
  const composerNotice = disabled && composerDisabledReason ? composerDisabledReason : null;

  const ai = useAiSuggestions();
  const { scrollRef, scrollToBottom, isNearBottom } = useChatAutoscroll();
  const composerRef = useRef(null);
  const composerApiRef = useRef(null);
  const ticketId = ticket?.id ?? null;

  const { timelineItems, hasMore, isLoadingMore, handleLoadMore, lastEntryKey } = useTicketMessages(messagesQuery);
  const { composerHeight, composerOffset } = useComposerMetrics(composerRef, ticketId);
  const { typingAgents, broadcastTyping } = useWhatsAppPresence({ typingIndicator, ticketId });
  const slaClock = useSLAClock(ticket);

  useEffect(() => {
    ai.reset();
  }, [ai, ticketId]);

  useConversationScroll({
    scrollRef,
    ticketId,
    lastEntryKey,
    typingAgentsCount: typingAgents.length,
    scrollToBottom,
    onLoadMore: handleLoadMore,
  });

  const handleRequestSuggestion = useCallback(async () => {
    if (!ticket) return null;
    try {
      const result = await ai.requestSuggestions({ ticket, timeline: conversation?.timeline ?? [] });
      if (result) {
        const note = formatAiSuggestionNote(result);
        if (note) {
          onCreateNote?.(note);
        }
      }
      return result ?? null;
    } catch (error) {
      console.warn('AI suggestion request failed', error);
      return null;
    }
  }, [ai, conversation?.timeline, onCreateNote, ticket]);

  const handleComposerSend = useCallback(
    (payload) => {
      onSendMessage?.(payload);
    },
    [onSendMessage],
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

  const aiAssistant = useMemo(
    () => ({
      requestSuggestions: ai.requestSuggestions,
      isLoading: ai.isLoading,
      data: ai.data ?? null,
      error: ai.error ?? null,
      reset: ai.reset,
    }),
    [ai.data, ai.error, ai.isLoading, ai.requestSuggestions, ai.reset],
  );

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
      typingAgents,
      composerHeight,
      onCreateNote,
      timeline: conversation?.timeline ?? [],
      aiAssistant,
    }),
    [
      aiAssistant,
      composerHeight,
      conversation,
      currentUser,
      handleAttachFileFromHeader,
      handleFocusComposer,
      isRegisteringResult,
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
      typingAgents,
    ],
  );

  return {
    timeline: {
      items: timelineItems,
      hasMore,
      isLoadingMore,
      onLoadMore: handleLoadMore,
      typingAgents,
      scrollRef,
      showNewMessagesHint: !isNearBottom,
      onScrollToBottom: handleScrollToBottom,
      composerOffset,
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
      onRequestSuggestion: handleRequestSuggestion,
      aiState,
      isSending,
      sendError,
    },
    header: {
      props: headerProps,
    },
  };
};

export default useConversationExperience;
