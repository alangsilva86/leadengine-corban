import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils.js';
import ConversationHeader from './ConversationHeader.jsx';
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
              ...headerComponents,
            }}
            detailsOpen={detailsState.open}
            onRequestDetails={handleDetailsRequest}
            renderSummary={(summary) => (
              <header
                className={cn(
                  'sticky top-0 z-20 border-b border-[color:var(--color-inbox-border)]/60 bg-[color:color-mix(in_srgb,var(--surface-shell)_92%,transparent)]/95 px-4 py-2 backdrop-blur-md shadow-[0_6px_20px_-18px_rgba(2,6,23,0.9)] supports-[backdrop-filter]:bg-[color:color-mix(in_srgb,var(--surface-shell)_88%,transparent)] sm:px-5',
                )}
              >
                <div className="mx-auto w-full max-w-[52rem] py-1">{summary}</div>
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
              showNewMessagesHint={showNewMessagesHint}
              onScrollToBottom={onScrollToBottom}
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
          aiStreaming={aiStreaming}
        />
      </div>
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
