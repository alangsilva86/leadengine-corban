import ConversationHeader from './ConversationHeader.jsx';
import MessageTimeline from './MessageTimeline.jsx';
import QuickActionsBar from './QuickActionsBar.jsx';
import Composer from './Composer.jsx';
import useAiSuggestions from '../../hooks/useAiSuggestions.js';
import { useEffect } from 'react';

export const ConversationArea = ({
  ticket,
  conversation,
  messagesQuery,
  onSendMessage,
  onCreateNote,
  onMarkWon,
  onMarkLost,
  onAssign,
  onGenerateProposal,
  typingIndicator,
  quality,
  isSending,
  sendError,
}) => {
  const disabled = ticket?.window?.isOpen === false;
  const ai = useAiSuggestions();

  const handleRequestSuggestion = async () => {
    if (!ticket) return;
    try {
      await ai.requestSuggestions({ ticket, timeline: conversation?.timeline ?? [] });
    } catch (error) {
      console.warn('AI suggestion request failed', error);
    }
  };

  useEffect(() => {
    ai.reset();
  }, [ticket?.id]);

  return (
    <div className="flex h-full flex-col gap-4">
      <ConversationHeader
        ticket={ticket}
        onMarkWon={onMarkWon}
        onMarkLost={onMarkLost}
        onAssign={onAssign}
        onGenerateProposal={onGenerateProposal}
        typingAgents={typingIndicator?.agentsTyping ?? []}
      />

      <QuickActionsBar
        onReopenWindow={() => onGenerateProposal?.('reopen-window')}
        onMacro={() => onSendMessage?.('Aplicando macro padrão...')}
        quality={quality}
      />

      <MessageTimeline
        items={conversation.timeline}
        loading={messagesQuery.isFetchingNextPage || messagesQuery.isFetchingPreviousPage}
        hasMore={Boolean(messagesQuery.hasPreviousPage)}
        onLoadMore={() => messagesQuery.fetchPreviousPage?.()}
        typingAgents={typingIndicator?.agentsTyping ?? []}
      />

      <Composer
        disabled={disabled && !ticket?.window?.isOpen}
        windowInfo={ticket?.window}
        onSend={(payload) => onSendMessage?.(payload)}
        onTemplate={(template) => {
          if (!template) return;
          const text = template.body ?? template.content ?? template;
          onSendMessage?.({
            content: text,
            template,
          });
        }}
        onCreateNote={(note) => onCreateNote?.(note)}
        onTyping={() => typingIndicator?.broadcastTyping?.({ ticketId: ticket?.id })}
        isSending={isSending}
        sendError={sendError}
        onRequestSuggestion={handleRequestSuggestion}
        aiLoading={ai.isLoading}
        aiSuggestions={ai.suggestions}
        onApplySuggestion={(suggestion) => {
          onSendMessage?.({ content: suggestion });
          ai.reset();
        }}
        onDiscardSuggestion={() => ai.reset()}
      />
    </div>
  );
};

export default ConversationArea;
