import { forwardRef } from 'react';
import { cn } from '@/lib/utils.js';
import ConversationHeader from './ConversationHeader.jsx';
import MessageTimeline from './MessageTimeline.jsx';
import Composer from './Composer.jsx';

const ComposerSection = forwardRef(
  (
    { notice, disabled, composerApiRef, onSend, onTemplate, onCreateNote, onTyping, isSending, sendError, onRequestSuggestion, aiSuggestions, aiLoading, onApplySuggestion, onDiscardSuggestion },
    elementRef,
  ) => (
    <footer
      ref={elementRef}
      className="sticky bottom-0 z-0 border-t border-[color:var(--color-inbox-border)] bg-[color:var(--surface-overlay-inbox-quiet)] px-4 py-3 sm:px-5 sm:py-4"
    >
      {notice ? (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-[0_6px_20px_-12px_rgba(217,119,6,0.55)]">
          <p className="font-medium">{notice.title ?? 'Envio indisponível'}</p>
          {notice.description ? <p className="mt-1 text-amber-800">{notice.description}</p> : null}
        </div>
      ) : null}
      <Composer
        ref={composerApiRef}
        disabled={disabled}
        onSend={onSend}
        onTemplate={onTemplate}
        onCreateNote={onCreateNote}
        onTyping={onTyping}
        isSending={isSending}
        sendError={sendError}
        onRequestSuggestion={onRequestSuggestion}
        aiLoading={aiLoading}
        aiSuggestions={aiSuggestions}
        onApplySuggestion={onApplySuggestion}
        onDiscardSuggestion={onDiscardSuggestion}
      />
    </footer>
  ),
);

ComposerSection.displayName = 'ComposerSection';

export const ConversationAreaView = ({
  ticket,
  timelineItems,
  hasMore,
  isLoadingMore,
  onLoadMore,
  typingAgents,
  headerProps,
  scrollRef,
  showNewMessagesHint,
  onScrollToBottom,
  composerOffset,
  composerHeight,
  composerRef,
  composerApiRef,
  composerNotice,
  disabled,
  onComposerSend,
  onComposerTemplate,
  onComposerCreateNote,
  onComposerTyping,
  onComposerRequestSuggestion,
  aiState,
  onApplySuggestion,
  onDiscardSuggestion,
  isSending,
  sendError,
}) => (
  <section className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-visible">
      <div className="relative z-10">
        <ConversationHeader
          {...headerProps}
          ticket={ticket}
          typingAgents={typingAgents}
          composerHeight={composerHeight}
          renderSummary={(summary) => (
            <header
              className={cn(
                'sticky top-0 z-10 border-b border-[color:var(--color-inbox-border)] bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-quiet)_96%,transparent)] px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-quiet)_85%,transparent)] sm:px-5 sm:py-3',
              )}
            >
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
            onLoadMore={onLoadMore}
            typingAgents={typingAgents}
          />
        </div>
      </div>

      <ComposerSection
        ref={composerRef}
        notice={composerNotice}
        disabled={disabled}
        composerApiRef={composerApiRef}
        onSend={onComposerSend}
        onTemplate={onComposerTemplate}
        onCreateNote={onComposerCreateNote}
        onTyping={onComposerTyping}
        isSending={isSending}
        sendError={sendError}
        onRequestSuggestion={onComposerRequestSuggestion}
        aiSuggestions={aiState?.suggestions ?? []}
        aiLoading={aiState?.isLoading ?? false}
        onApplySuggestion={onApplySuggestion}
        onDiscardSuggestion={onDiscardSuggestion}
      />
    </div>
    {showNewMessagesHint ? (
      <button
        type="button"
        onClick={onScrollToBottom}
        className="pointer-events-auto absolute left-1/2 z-30 -translate-x-1/2 rounded-full bg-[color:var(--surface-overlay-inbox-bold)] px-4 py-2 text-xs font-medium text-[color:var(--color-inbox-foreground)] shadow-[var(--shadow-md)] transition hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-bold)_92%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-shell)]"
        style={{ bottom: composerOffset }}
      >
        Novas mensagens
      </button>
    ) : null}
  </section>
);

export default ConversationAreaView;
