import { useCallback, useEffect, useMemo, useRef } from 'react';
import useAiSuggestions from '../../../hooks/useAiSuggestions.js';
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
  aiMode,
  aiConfidence,
  onTakeOver,
  onGiveBackToAi,
  onAiModeChange,
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
    if (!ticket) return;
    try {
      await ai.requestSuggestions({ ticket, timeline: conversation?.timeline ?? [] });
    } catch (error) {
      console.warn('AI suggestion request failed', error);
    }
  }, [ai, conversation?.timeline, ticket]);

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

  const handleApplySuggestion = useCallback(
    (suggestion) => {
      onSendMessage?.({ content: suggestion });
      ai.reset();
    },
    [ai, onSendMessage],
  );

  const handleDiscardSuggestion = useCallback(() => {
    ai.reset();
  }, [ai]);

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom({ behavior: 'smooth', force: true });
  }, [scrollToBottom]);

  const handleAttachFileFromHeader = useCallback(() => {
    composerApiRef.current?.openAttachmentDialog?.();
  }, []);

  const handleFocusComposer = useCallback(() => {
    composerApiRef.current?.focusInput?.();
  }, []);

  const aiState = useMemo(
    () => ({
      suggestions: ai.suggestions,
      isLoading: ai.isLoading,
    }),
    [ai.isLoading, ai.suggestions],
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
      aiMode,
      aiConfidence,
      onTakeOver,
      onGiveBackToAi,
      onAiModeChange,
      composerHeight,
    }),
    [
      composerHeight,
      conversation,
      currentUser,
      handleAttachFileFromHeader,
      handleFocusComposer,
      isRegisteringResult,
      nextStepValue,
      onAssign,
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
      aiMode,
      aiConfidence,
      onTakeOver,
      onGiveBackToAi,
      onAiModeChange,
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
      onApplySuggestion: handleApplySuggestion,
      onDiscardSuggestion: handleDiscardSuggestion,
      isSending,
      sendError,
    },
    header: {
      props: headerProps,
    },
  };
};

export default useConversationExperience;
