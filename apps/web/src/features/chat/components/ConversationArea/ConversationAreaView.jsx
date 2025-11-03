import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils.js';
import ConversationHeader from './ConversationHeader.jsx';
import { AiModeControlMenu } from './AiModeMenu.jsx';
import ContactDetailsPanel from './ContactDetailsPanel.jsx';
import PrimaryActionBanner from './PrimaryActionBanner.jsx';
import MessageTimeline from './MessageTimeline.jsx';
import Composer from './Composer.jsx';
import ConversationDetailsDrawer from './ConversationDetailsDrawer.jsx';
import useTicketStageInfo from './hooks/useTicketStageInfo.js';
import { usePhoneActions } from '../../hooks/usePhoneActions.js';

const ComposerSection = forwardRef(
  (
    {
      notice,
      disabled,
      composerApiRef,
      onSend,
      onTemplate,
      onCreateNote,
      onTyping,
      isSending,
      sendError,
      aiConfidence,
      aiError,
      aiMode,
      aiModeChangeDisabled,
      onAiModeChange,
      aiStreaming,
    },
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
        aiConfidence={aiConfidence}
        aiError={aiError}
        aiMode={aiMode}
        aiModeChangeDisabled={aiModeChangeDisabled}
        onAiModeChange={onAiModeChange}
        aiStreaming={aiStreaming}
      />
    </footer>
  ),
);

ComposerSection.displayName = 'ComposerSection';

export const ConversationAreaView = ({ timeline, composer, header }) => {
  const {
    items: timelineItems,
    hasMore,
    isLoadingMore,
    onLoadMore,
    typingAgents = [],
    scrollRef,
    showNewMessagesHint,
    onScrollToBottom,
    composerOffset,
  } = timeline ?? {};

  const {
    ref: composerRef,
    apiRef: composerApiRef,
    notice: composerNotice,
    disabled = false,
    onSend,
    onTemplate,
    onCreateNote,
    onTyping,
    aiState,
    isSending = false,
    sendError,
    aiMode,
    aiModeChangeDisabled,
    onAiModeChange,
    aiStreaming,
  } = composer ?? {};

  const [detailsState, setDetailsState] = useState({ open: false, intent: null });
  const nextStepEditorRef = useRef(null);

  const headerProps = header?.props ?? {};
  const headerComponents = header?.components ?? {};
  const ticket = headerProps?.ticket ?? null;

  const handleDetailsRequest = useCallback(
    (intent = {}) => {
      setDetailsState({ open: true, intent });
    },
    [],
  );

  const handleDetailsOpenChange = useCallback((open) => {
    setDetailsState((prev) => ({
      open,
      intent: open ? prev.intent : null,
    }));
  }, []);

  useEffect(() => {
    if (!detailsState.open) return;
    if (detailsState.intent?.focus === 'nextStep') {
      const target = nextStepEditorRef.current;
      if (target && typeof target.focus === 'function') {
        target.focus();
      }
    }
  }, [detailsState.open, detailsState.intent]);

  const drawerTitle = useMemo(() => {
    const contactName = ticket?.contact?.name ?? ticket?.subject ?? 'Contato';
    return `Detalhes de ${contactName}`;
  }, [ticket?.contact?.name, ticket?.subject]);

  const mergedHeaderProps = useMemo(
    () => ({
      ...headerProps,
      nextStepEditorRef,
    }),
    [headerProps, nextStepEditorRef],
  );

  const { stageKey } = useTicketStageInfo(ticket);
  const rawPhone = ticket?.contact?.phone ?? ticket?.metadata?.contactPhone ?? null;
  const onSendSMS = headerProps?.onSendSMS;
  const onContactFieldSave = headerProps?.onContactFieldSave;
  const onEditContact = headerProps?.onEditContact;
  const onDealFieldSave = headerProps?.onDealFieldSave;
  const nextStepValue = headerProps?.nextStepValue;
  const onNextStepSave = headerProps?.onNextStepSave;

  const phoneActions = usePhoneActions(rawPhone, {
    missingPhoneMessage: 'Nenhum telefone disponível para este lead.',
  });

  const handleCall = useCallback(() => {
    phoneActions('call');
  }, [phoneActions]);

  const handleSendSms = useCallback(() => {
    phoneActions('sms');
    onSendSMS?.(rawPhone);
  }, [onSendSMS, phoneActions, rawPhone]);

  return (
    <section className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-visible">
        <div className="relative z-10">
          <ConversationHeader
            {...mergedHeaderProps}
            components={{
              PrimaryActionBanner,
              AiModeMenu: AiModeControlMenu,
              ...headerComponents,
            }}
            detailsOpen={detailsState.open}
            onRequestDetails={handleDetailsRequest}
            renderSummary={(summary) => (
              <header
                className={cn(
                  'sticky top-0 z-10 border-b border-[color:var(--color-inbox-border)] bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-quiet)_96%,transparent)] px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-quiet)_85%,transparent)] sm:px-5 sm:py-3',
                )}
              >
                <div className="mx-auto w-full max-w-[48rem]">{summary}</div>
              </header>
            )}
          />
        </div>

        <div
          id="ticketViewport"
          ref={scrollRef}
          className="relative z-0 flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto overscroll-contain [scrollbar-gutter:stable_both-edges]"
        >
          <div className="min-h-0 min-w-0 px-4 py-4 sm:px-5 sm:py-5 mx-auto w-full max-w-[48rem]">
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
          onSend={onSend}
          onTemplate={onTemplate}
          onCreateNote={onCreateNote}
          onTyping={onTyping}
          isSending={isSending}
          sendError={sendError}
          aiConfidence={aiState?.confidence ?? null}
          aiError={aiState?.error ?? null}
          aiMode={aiMode}
          aiModeChangeDisabled={aiModeChangeDisabled}
          onAiModeChange={onAiModeChange}
        />
      </div>
      {showNewMessagesHint ? (
        <div
          className="pointer-events-none absolute left-1/2 z-30 -translate-x-1/2"
          style={{ bottom: composerOffset }}
        >
          <button
            type="button"
            onClick={onScrollToBottom}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-[color:var(--surface-overlay-inbox-bold)]/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-inbox-foreground)] shadow-[var(--shadow-lg)] transition hover:bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-bold)_92%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-shell)]"
          >
            Novas mensagens
            <span className="text-[color:var(--color-inbox-foreground-muted)]">▼</span>
          </button>
        </div>
      ) : null}
      <ConversationDetailsDrawer
        open={detailsState.open}
        onOpenChange={handleDetailsOpenChange}
        title={drawerTitle}
      >
        <ContactDetailsPanel
          ticket={ticket}
          onContactFieldSave={onContactFieldSave}
          onEditContact={onEditContact}
          onCall={handleCall}
          onSendSms={handleSendSms}
          nextStepValue={nextStepValue}
          onNextStepSave={onNextStepSave}
          nextStepEditorRef={nextStepEditorRef}
          stageKey={stageKey}
          onDealFieldSave={onDealFieldSave}
        />
      </ConversationDetailsDrawer>
    </section>
  );
};

export default ConversationAreaView;
