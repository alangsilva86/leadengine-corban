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
  }, [ai, ticket?.id]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
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

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-[26px] bg-slate-950/20 shadow-inner shadow-slate-950/40 ring-1 ring-white/5 backdrop-blur-xl">
        <MessageTimeline
          items={conversation.timeline}
          loading={messagesQuery.isFetchingNextPage || messagesQuery.isFetchingPreviousPage}
          hasMore={Boolean(messagesQuery.hasPreviousPage)}
          onLoadMore={() => messagesQuery.fetchPreviousPage?.()}
          typingAgents={typingIndicator?.agentsTyping ?? []}
        />
      </div>

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
