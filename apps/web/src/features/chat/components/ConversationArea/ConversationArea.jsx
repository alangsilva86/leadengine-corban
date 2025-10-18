import { useMemo, useEffect } from 'react';
import ConversationHeader from './ConversationHeader.jsx';
import MessageTimeline from './MessageTimeline.jsx';
import Composer from './Composer.jsx';
import useAiSuggestions from '../../hooks/useAiSuggestions.js';

export const ConversationArea = ({
  ticket,
  conversation,
  messagesQuery,
  onSendMessage,
  onCreateNote,
  onRegisterResult,
  onAssign,
  onGenerateProposal,
  onScheduleFollowUp,
  isRegisteringResult = false,
  typingIndicator,
  isSending,
  sendError,
}) => {
  const disabled = false;
  const ai = useAiSuggestions();

  const timelineItems = useMemo(() => {
    const pages = messagesQuery.data?.pages ?? [];
    const messages = [];
    for (const page of pages) {
      if (!page || !Array.isArray(page.items)) {
        continue;
      }
      for (const message of page.items) {
        messages.push(message);
      }
    }

    messages.sort((a, b) => {
      const left = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const right = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return left - right;
    });

    return messages.map((entry) => ({
      type: 'message',
      id: entry.id,
      date: entry.createdAt ? new Date(entry.createdAt) : undefined,
      payload: entry,
    }));
  }, [messagesQuery.data?.pages]);

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
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="sticky top-0 z-10 border-b border-[color:var(--color-inbox-border)] bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-quiet)_96%,transparent)] px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-quiet)_85%,transparent)] sm:px-6 sm:py-5">
        <ConversationHeader
          ticket={ticket}
          onRegisterResult={onRegisterResult}
          onAssign={onAssign}
          onGenerateProposal={onGenerateProposal}
          onScheduleFollowUp={onScheduleFollowUp}
          isRegisteringResult={isRegisteringResult}
          typingAgents={typingIndicator?.agentsTyping ?? []}
        />
      </div>

      <div className="flex-1 min-h-0">
        <MessageTimeline
          items={timelineItems}
          loading={messagesQuery.isFetchingNextPage}
          hasMore={Boolean(messagesQuery.hasNextPage)}
          onLoadMore={() => messagesQuery.fetchNextPage?.()}
          typingAgents={typingIndicator?.agentsTyping ?? []}
        />
      </div>

      <div className="sticky bottom-0 z-10 border-t border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] px-4 py-4 sm:px-6 sm:py-5">
        <Composer
          disabled={disabled}
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
    </section>
  );
};

export default ConversationArea;
