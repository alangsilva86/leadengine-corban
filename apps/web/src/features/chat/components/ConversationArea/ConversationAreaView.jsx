import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import ConversationHeader from './ConversationHeader.jsx';
import ContactDetailsPanel from './ContactDetailsPanel.jsx';
import MessageTimeline from './MessageTimeline.jsx';
import Composer from './Composer.jsx';
import ConversationDetailsDrawer from './ConversationDetailsDrawer.jsx';
import useTicketLeadStage from './hooks/useTicketLeadStage.js';
import { usePhoneActions } from '../../hooks/usePhoneActions.js';
import { getTicketIdentity } from '../../utils/ticketIdentity.js';
import { useInboxLayout } from '../layout/InboxLayoutContext.js';

/** Painel do contato fixo (≥1440px): não-modal, ao lado da conversa. */
const ContextPane = ({ title, onClose, children }) => {
  const titleId = useId();
  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label={title}
      className="flex h-full min-h-0 w-[320px] shrink-0 flex-col border-l border-border bg-surface"
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <h2 id={titleId} className="text-sm font-semibold text-foreground">
          Contato
        </h2>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fechar painel do contato">
          <X aria-hidden />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
    </section>
  );
};

export const ConversationAreaView = ({ timeline, composer, header, currentUser = null }) => {
  const {
    items: timelineItems = [],
    hasMore,
    isLoadingMore,
    onLoadMore,
    typingAgents = [],
    scrollRef,
    showNewMessagesHint,
    onScrollToBottom,
    isInitialLoading = false,
    error: timelineError = null,
    onRetry: onRetryTimeline,
    windowState = null,
  } = timeline ?? {};

  const {
    ref: composerRef,
    apiRef: composerApiRef,
    notice: composerNotice,
    disabled = false,
    onSend,
    onCreateNote,
    onTyping,
    aiState,
    isSending = false,
    sendError,
    aiStreaming,
    instanceSelector,
    ticketId,
    contactName,
    windowState: composerWindowState,
    closed,
    onReopen,
    aiAutonomous,
    onTakeOver,
  } = composer ?? {};

  const layout = useInboxLayout();
  const [localDetailsOpen, setLocalDetailsOpen] = useState(false);
  const [detailsIntent, setDetailsIntent] = useState(null);
  const detailsOpen = layout ? Boolean(layout.contextDrawerOpen) : localDetailsOpen;
  const setDetailsOpen = useCallback(
    (open) => {
      if (layout?.setContextOpen) {
        layout.setContextOpen(open);
      } else {
        setLocalDetailsOpen(open);
      }
      if (!open) setDetailsIntent(null);
    },
    [layout],
  );
  const isPaneLayout = Boolean(layout?.isWide);

  const nextStepEditorRef = useRef(null);
  const contextSectionRef = useRef(null);

  const headerProps = header?.props ?? {};
  const ticket = headerProps?.ticket ?? null;

  const handleDetailsRequest = useCallback(
    (intent = {}) => {
      setDetailsIntent(intent);
      setDetailsOpen(true);
    },
    [setDetailsOpen],
  );

  const handleToggleDetails = useCallback(() => {
    setDetailsOpen(!detailsOpen);
  }, [detailsOpen, setDetailsOpen]);

  useEffect(() => {
    if (!detailsOpen || !detailsIntent) return;
    if (detailsIntent.focus === 'nextStep') {
      nextStepEditorRef.current?.focus?.();
      return;
    }
    if (detailsIntent.focus === 'context') {
      const target = contextSectionRef.current;
      target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      target?.focus?.({ preventScroll: true });
    }
  }, [detailsIntent, detailsOpen]);

  const contactDisplayName = useMemo(() => getTicketIdentity(ticket).displayName ?? 'contato', [ticket]);
  const drawerTitle = `Detalhes de ${contactDisplayName}`;

  const { stage } = useTicketLeadStage(ticket);
  const rawPhone = ticket?.contact?.phone ?? ticket?.metadata?.contactPhone ?? null;
  const onSendSMS = headerProps?.onSendSMS;

  const phoneActions = usePhoneActions(rawPhone, {
    missingPhoneMessage: 'Este contato não tem telefone cadastrado.',
  });
  const handleCall = useCallback(() => phoneActions('call'), [phoneActions]);
  const handleSendSms = useCallback(() => {
    phoneActions('sms');
    onSendSMS?.(rawPhone);
  }, [onSendSMS, phoneActions, rawPhone]);

  const detailsPanel = (
    <ContactDetailsPanel
      ticket={ticket}
      onContactFieldSave={headerProps?.onContactFieldSave}
      onCall={handleCall}
      onSendSms={handleSendSms}
      nextStepValue={headerProps?.nextStepValue}
      onNextStepSave={headerProps?.onNextStepSave}
      nextStepEditorRef={nextStepEditorRef}
      stage={stage}
      onStageChange={headerProps?.onStageChange}
      pendingStage={headerProps?.pendingStage ?? null}
      contextSectionRef={contextSectionRef}
    />
  );

  const emptyDescription =
    (windowState ?? composerWindowState)?.state === 'none'
      ? 'O cliente ainda não escreveu. Para iniciar a conversa, use um modelo aprovado.'
      : 'Escreva abaixo para começar a conversa.';

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1">
      <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <ConversationHeader
          {...headerProps}
          currentUser={currentUser ?? headerProps.currentUser ?? null}
          onBack={layout ? layout.onBackToList : headerProps.onBack}
          detailsOpen={detailsOpen}
          onRequestDetails={handleDetailsRequest}
          onToggleDetails={handleToggleDetails}
        />

        <div className="relative min-h-0 flex-1">
          <div
            id="ticketViewport"
            ref={scrollRef}
            className="absolute inset-0 overflow-y-auto overscroll-contain bg-background"
          >
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-3 py-4 sm:px-6">
              <MessageTimeline
                items={timelineItems}
                loading={isLoadingMore}
                hasMore={hasMore}
                onLoadMore={onLoadMore}
                typingAgents={typingAgents}
                isInitialLoading={isInitialLoading}
                error={timelineError}
                onRetry={onRetryTimeline}
                emptyDescription={emptyDescription}
                currentUser={currentUser}
              />
            </div>
          </div>
          {showNewMessagesHint && timelineItems.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onScrollToBottom?.()}
              className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full shadow-md"
            >
              <ArrowDown aria-hidden />
              Ir para as mais recentes
            </Button>
          ) : null}
        </div>

        <footer
          ref={composerRef}
          className="shrink-0 border-t border-border bg-background px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6"
        >
          <div className="mx-auto w-full max-w-3xl">
            <Composer
              ref={composerApiRef}
              ticketId={ticketId}
              contactName={contactName}
              disabled={disabled}
              disabledReason={disabled ? composerNotice : null}
              notice={disabled ? null : composerNotice}
              onSend={onSend}
              onCreateNote={onCreateNote}
              onTyping={onTyping}
              isSending={isSending}
              sendError={sendError}
              aiError={aiState?.error ?? null}
              aiStreaming={aiStreaming}
              instanceSelector={instanceSelector}
              windowState={composerWindowState ?? windowState}
              closed={closed}
              onReopen={onReopen}
              aiAutonomous={aiAutonomous}
              onTakeOver={onTakeOver}
            />
          </div>
        </footer>
      </div>

      {isPaneLayout ? (
        detailsOpen ? (
          <ContextPane title={drawerTitle} onClose={() => setDetailsOpen(false)}>
            {detailsPanel}
          </ContextPane>
        ) : null
      ) : (
        <ConversationDetailsDrawer open={detailsOpen} onOpenChange={setDetailsOpen} title={drawerTitle}>
          {detailsPanel}
        </ConversationDetailsDrawer>
      )}
    </div>
  );
};

export default ConversationAreaView;
