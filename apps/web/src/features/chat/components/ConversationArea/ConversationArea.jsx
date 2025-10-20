import { useMemo, useEffect, useCallback, useRef, useState } from 'react';
import ConversationHeader from './ConversationHeader.jsx';
import MessageTimeline from './MessageTimeline.jsx';
import Composer from './Composer.jsx';
import useAiSuggestions from '../../hooks/useAiSuggestions.js';
import useChatAutoscroll from '../../hooks/useChatAutoscroll.js';

const conversationScrollMemory = new Map();

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
  onSendTemplate,
  onCreateNextStep,
  onRegisterCallResult,
  isRegisteringResult = false,
  typingIndicator,
  isSending,
  sendError,
  composerDisabled = false,
  composerDisabledReason = null,
}) => {
  const disabled = Boolean(composerDisabled);
  const composerNotice = disabled && composerDisabledReason ? composerDisabledReason : null;
  const ai = useAiSuggestions();
  const { scrollRef, scrollToBottom, isNearBottom } = useChatAutoscroll();
  const [composerOffset, setComposerOffset] = useState(96);
  const composerRef = useRef(null);
  const ticketId = ticket?.id ?? null;

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

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = messagesQuery;
  const hasMore = Boolean(hasNextPage);
  const isLoadingMore = isFetchingNextPage;
  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) {
      return;
    }

    fetchNextPage?.();
  }, [hasMore, isLoadingMore, fetchNextPage]);

  const lastEntryKey = timelineItems?.length ? timelineItems[timelineItems.length - 1]?.id ?? timelineItems.length : 0;

  useEffect(() => {
    scrollToBottom();
  }, [lastEntryKey, typingIndicator?.agentsTyping?.length, scrollToBottom]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;

    const savedPosition = ticketId ? conversationScrollMemory.get(ticketId) : undefined;

    requestAnimationFrame(() => {
      if (typeof savedPosition === 'number') {
        element.scrollTop = savedPosition;
      } else {
        scrollToBottom({ force: true });
      }
    });
  }, [scrollRef, scrollToBottom, ticketId]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;

    const handleScroll = () => {
      if (ticketId) {
        conversationScrollMemory.set(ticketId, element.scrollTop);
      }
      if (element.scrollTop < 80) {
        handleLoadMore();
      }
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (ticketId) {
        conversationScrollMemory.set(ticketId, element.scrollTop);
      }
      element.removeEventListener('scroll', handleScroll);
    };
  }, [scrollRef, handleLoadMore, ticketId]);

  useEffect(() => {
    const element = composerRef.current;
    if (!element) return undefined;

    const updateOffset = () => {
      setComposerOffset(element.offsetHeight + 16);
    };

    updateOffset();

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(updateOffset);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ticketId]);

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom({ behavior: 'smooth', force: true });
  }, [scrollToBottom]);
  const showNewMessagesHint = !isNearBottom;

  return (
    <section className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-visible">
        <div className="relative z-10">
          <ConversationHeader
            ticket={ticket}
            onRegisterResult={onRegisterResult}
            onAssign={onAssign}
            onGenerateProposal={onGenerateProposal}
            onScheduleFollowUp={onScheduleFollowUp}
            onSendTemplate={onSendTemplate}
            onCreateNextStep={onCreateNextStep}
            onRegisterCallResult={onRegisterCallResult}
            isRegisteringResult={isRegisteringResult}
            typingAgents={typingIndicator?.agentsTyping ?? []}
            renderSummary={(summary) => (
              <header className="sticky top-0 z-10 border-b border-[color:var(--color-inbox-border)] bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-quiet)_96%,transparent)] px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-quiet)_85%,transparent)] sm:px-5 sm:py-3">
                {summary}
              </header>
            )}
          />
        </div>

        <div
          id="ticketViewport"
          ref={scrollRef}
          className="relative z-0 flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto overscroll-contain [scrollbar-gutter:stable_both-edges]"
        >
          <div className="min-h-0 min-w-0 px-4 py-4 sm:px-5 sm:py-5">
            <MessageTimeline
              items={timelineItems}
              loading={isLoadingMore}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
              typingAgents={typingIndicator?.agentsTyping ?? []}
            />
          </div>
        </div>

        <footer
          ref={composerRef}
          className="sticky bottom-0 z-0 border-t border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] px-4 py-3 sm:px-5 sm:py-4"
        >
          {composerNotice ? (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-[0_6px_20px_-12px_rgba(217,119,6,0.55)]">
              <p className="font-medium">{composerNotice.title ?? 'Envio indisponível'}</p>
              {composerNotice.description ? (
                <p className="mt-1 text-amber-800">{composerNotice.description}</p>
              ) : null}
            </div>
          ) : null}
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
        </footer>
      </div>
      {showNewMessagesHint ? (
        <button
          type="button"
          onClick={handleScrollToBottom}
          className="pointer-events-auto absolute left-1/2 z-30 -translate-x-1/2 rounded-full bg-[color:var(--surface-overlay-inbox-bold)] px-4 py-2 text-xs font-medium text-[color:var(--color-inbox-foreground)] shadow-[var(--shadow-md)] transition hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-bold)_92%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-shell)]"
          style={{ bottom: composerOffset }}
        >
          Novas mensagens
        </button>
      ) : null}
    </section>
  );
};

export default ConversationArea;
