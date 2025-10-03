import ConversationHeader from './ConversationHeader.jsx';
import MessageTimeline from './MessageTimeline.jsx';
import QuickActionsBar from './QuickActionsBar.jsx';
import Composer from './Composer.jsx';

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
}) => {
  const disabled = ticket?.window?.isOpen === false;

  return (
    <div className="flex h-full flex-col gap-4">
      <ConversationHeader
        ticket={ticket}
        onMarkWon={onMarkWon}
        onMarkLost={onMarkLost}
        onAssign={onAssign}
        onGenerateProposal={onGenerateProposal}
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
        onSend={(content) => onSendMessage?.(content)}
        onTemplate={(template) => {
          if (!template) return;
          const text = template.body ?? template.content ?? template;
          onSendMessage?.(text);
        }}
        onCreateNote={(note) => onCreateNote?.(note)}
        onTyping={() => typingIndicator?.broadcastTyping?.({ ticketId: ticket?.id })}
      />
    </div>
  );
};

export default ConversationArea;
