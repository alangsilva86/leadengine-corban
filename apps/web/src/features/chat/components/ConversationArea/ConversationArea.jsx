import { useMemo } from 'react';
import ConversationHeader from './ConversationHeader.jsx';
import MessageTimeline from './MessageTimeline.jsx';
import Composer from './Composer.jsx';
import useAiSuggestions from '../../hooks/useAiSuggestions.js';
import { useEffect } from 'react';

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
  const disabled = ticket?.window?.isOpen === false;
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
    <div className="flex h-full min-h-0 flex-col gap-6">
      <ConversationHeader
        ticket={ticket}
        onRegisterResult={onRegisterResult}
        onAssign={onAssign}
        onGenerateProposal={onGenerateProposal}
        onScheduleFollowUp={onScheduleFollowUp}
        isRegisteringResult={isRegisteringResult}
        typingAgents={typingIndicator?.agentsTyping ?? []}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-[26px] bg-slate-950/20 shadow-inner shadow-slate-950/40 ring-1 ring-white/5 backdrop-blur-xl">
        <MessageTimeline
          items={timelineItems}
          loading={messagesQuery.isFetchingNextPage}
          hasMore={Boolean(messagesQuery.hasNextPage)}
          onLoadMore={() => messagesQuery.fetchNextPage?.()}
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
