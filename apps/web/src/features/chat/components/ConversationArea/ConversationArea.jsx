import { useCallback, useEffect, useMemo, useRef } from 'react';
import useAiSuggestions from '../../hooks/useAiSuggestions.js';
import useChatAutoscroll from '../../hooks/useChatAutoscroll.js';
import { useTicketMessages } from './hooks/useTicketMessages.js';
import { useWhatsAppPresence } from './hooks/useWhatsAppPresence.js';
import { useSLAClock } from './hooks/useSLAClock.js';
import { useConversationScroll } from './hooks/useConversationScroll.js';
import { useComposerMetrics } from './hooks/useComposerMetrics.js';
import ConversationAreaView from './ConversationAreaView.jsx';

export const ConversationArea = ({
  ticket,
  conversation,
  messagesQuery,
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
  isRegisteringResult = false,
  typingIndicator,
  isSending,
  sendError,
  composerDisabled = false,
  composerDisabledReason = null,
  onContactFieldSave = async () => {},
  onDealFieldSave = async () => {},
  nextStepValue = '',
  onNextStepSave = async () => {},
  currentUser = null,
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

  const handleAttachFileFromHeader = useCallback(() => {
    composerApiRef.current?.openAttachmentDialog?.();
  }, []);

  const handleFocusComposer = useCallback(() => {
    composerApiRef.current?.focusInput?.();
  }, []);

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom({ behavior: 'smooth', force: true });
  }, [scrollToBottom]);

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

  const aiState = useMemo(
    () => ({
      suggestions: ai.suggestions,
      isLoading: ai.isLoading,
    }),
    [ai.isLoading, ai.suggestions],
  );

  const headerProps = useMemo(
    () => ({
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
    }),
    [
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
    ],
  );

  const showNewMessagesHint = !isNearBottom;

  return (
    <ConversationAreaView
      ticket={ticket}
      timelineItems={timelineItems}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onLoadMore={handleLoadMore}
      typingAgents={typingAgents}
      headerProps={headerProps}
      scrollRef={scrollRef}
      showNewMessagesHint={showNewMessagesHint}
      onScrollToBottom={handleScrollToBottom}
      composerOffset={composerOffset}
      composerHeight={composerHeight}
      composerRef={composerRef}
      composerApiRef={composerApiRef}
      composerNotice={composerNotice}
      disabled={disabled}
      onComposerSend={handleComposerSend}
      onComposerTemplate={handleComposerTemplate}
      onComposerCreateNote={handleComposerCreateNote}
      onComposerTyping={broadcastTyping}
      onComposerRequestSuggestion={handleRequestSuggestion}
      aiState={aiState}
      onApplySuggestion={handleApplySuggestion}
      onDiscardSuggestion={handleDiscardSuggestion}
      isSending={isSending}
      sendError={sendError}
    />
  );
};

export default ConversationArea;
