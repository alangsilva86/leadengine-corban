import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils.js';
import { Button } from '@/components/ui/button.jsx';
import ConversationHeader from './ConversationHeader.jsx';
import ContactDetailsPanel from './ContactDetailsPanel.jsx';
import PrimaryActionBanner from './PrimaryActionBanner.jsx';
import MessageTimeline from './MessageTimeline.jsx';
import Composer from './Composer.jsx';
import ConversationDetailsDrawer from './ConversationDetailsDrawer.jsx';
import SimulationModal from './SimulationModal.jsx';
import DealDrawer from './DealDrawer.jsx';
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
      instanceSelector,
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
          {notice.requestId ? (
            <p className="mt-1 text-xs text-amber-700/80">
              ID da falha: <code>{notice.requestId}</code>
            </p>
          ) : null}
          {notice.actionLabel ? (
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => notice.onAction?.()}
              >
                {notice.actionLabel}
              </Button>
            </div>
          ) : null}
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
        instanceSelector={instanceSelector}
      />
    </footer>
  ),
);

ComposerSection.displayName = 'ComposerSection';

export const ConversationAreaView = ({ timeline, composer, header, sales }) => {
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
    instanceSelector,
  } = composer ?? {};

  const salesHandlers = sales?.handlers ?? {};
  const openSimulation = typeof salesHandlers.openSimulation === 'function' ? salesHandlers.openSimulation : null;
  const openProposal = typeof salesHandlers.openProposal === 'function' ? salesHandlers.openProposal : null;
  const openDeal = typeof salesHandlers.openDeal === 'function' ? salesHandlers.openDeal : null;
  const salesDisabled = Boolean(sales?.disabled);
  const salesDisabledReason = sales?.disabledReason ?? null;
  const simulationModal = sales?.simulationModal ?? null;
  const dealDrawer = sales?.dealDrawer ?? null;

  const [detailsState, setDetailsState] = useState({ open: false, intent: null });
  const nextStepEditorRef = useRef(null);
  const contextSectionRef = useRef(null);

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
        return;
      }
    }

    if (detailsState.intent?.focus === 'context') {
      const target = contextSectionRef.current;
      if (target) {
        if (typeof target.scrollIntoView === 'function') {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (typeof target.focus === 'function') {
          target.focus({ preventScroll: true });
        }
      }
    }
  }, [detailsState.intent, detailsState.open]);

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
              <div className="px-4 py-2 sm:px-5">
                <div className="mx-auto w-full max-w-[52rem]">{summary}</div>
              </div>
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
          contextSectionRef={contextSectionRef}
          onOpenSimulation={openSimulation}
          onOpenProposal={openProposal}
          onOpenDeal={openDeal}
          salesActionsDisabled={salesDisabled}
          salesDisabledReason={salesDisabledReason}
          salesJourney={sales?.journey ?? null}
        />
      </ConversationDetailsDrawer>
      {simulationModal ? <SimulationModal {...simulationModal} /> : null}
      {dealDrawer ? <DealDrawer {...dealDrawer} /> : null}
    </section>
  );
};

export default ConversationAreaView;
