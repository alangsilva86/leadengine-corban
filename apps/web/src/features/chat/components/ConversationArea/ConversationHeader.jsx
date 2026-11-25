import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ClipboardList, FileText, PanelRight, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';
import emitInboxTelemetry from '../../utils/telemetry.js';
import { usePhoneActions } from '../../hooks/usePhoneActions.js';
import { ACTIONS_BY_ID } from '../../actions/inventory';
import { getTicketIdentity } from '../../utils/ticketIdentity.js';
import CallResultDialog from './CallResultDialog.jsx';
import OutcomeDialog from './OutcomeDialog.jsx';
import AssignTicketPopover from './AssignTicketPopover.jsx';
import HeaderIdentity from './header/HeaderIdentity.jsx';
import HeaderStatus from './header/HeaderStatus.jsx';
import TicketTimeChip from './header/TicketTimeChip.jsx';
import HeaderPrimaryAction, { PrimaryActionButton } from './header/HeaderPrimaryAction.jsx';
import HeaderOverflow from './header/HeaderOverflow.jsx';
import useTicketLeadStage from './hooks/useTicketLeadStage.js';
import { DEFAULT_AI_MODE } from './aiModes.js';
import { LOSS_REASONS, LOSS_REASON_HELPERS } from './lossReasons.js';
import { getOutcomeModeForStage, isResultStage } from '../../utils/leadStage.js';
import {
  isTicketClosed,
  isWhatsAppTicket,
  resolveTicketAssignee,
  resolveTicketInstanceId,
  resolveWaitingState,
  resolveWindowState,
} from './utils/presentation.js';

export const GENERATE_PROPOSAL_ANCHOR_ID = 'command-generate-proposal';

/**
 * Uma única ação principal, pelo estado da conversa:
 * sem responsável → "Assumir conversa"; IA no comando → "Assumir da IA";
 * janela de 24 h encerrada → "Enviar modelo"; lead em Liquidação, Ganho ou Perdido com a conversa
 * aberta → "Registrar resultado" (encerra a conversa com o resultado).
 */
export const resolveHeaderPrimaryAction = ({
  ticket,
  assignee,
  aiMode,
  windowState,
  stage,
  canAssign,
  canTakeOver,
  canOpenTemplates,
}) => {
  if (!ticket || isTicketClosed(ticket)) return null;
  if (!assignee && canAssign) {
    return { id: 'assign-self', label: 'Assumir conversa', shortLabel: 'Assumir', icon: UserCheck };
  }
  if (aiMode === 'auto' && canTakeOver) {
    return { id: 'take-over-ai', label: 'Assumir da IA', shortLabel: 'Assumir', icon: UserCheck };
  }
  if (windowState?.state === 'closed' && canOpenTemplates) {
    return { id: 'send-template', label: 'Enviar modelo', shortLabel: 'Modelo', icon: FileText };
  }
  if (isResultStage(stage)) {
    return { id: 'register-result', label: 'Registrar resultado', shortLabel: 'Resultado', icon: ClipboardList };
  }
  return null;
};

const ConversationHeader = ({
  ticket,
  currentUser = null,
  onRegisterResult,
  onRegisterCallResult,
  onAssign,
  onGenerateProposal,
  onScheduleFollowUp,
  onSendSMS,
  onAttachFile,
  onEditContact,
  onOpenTemplates,
  typingAgents = [],
  isRegisteringResult = false,
  onFocusComposer,
  aiMode = DEFAULT_AI_MODE,
  aiConfidence = null,
  aiModeChangeDisabled = false,
  onTakeOver,
  onGiveBackToAi,
  onAiModeChange,
  onCreateNote,
  timeline = [],
  aiAssistant,
  detailsOpen = false,
  onRequestDetails,
  onToggleDetails,
  onBack,
  onStageChange,
  pendingStage = null,
  className,
}) => {
  const [activeDialog, setActiveDialog] = useState(null);
  const [outcomeMode, setOutcomeMode] = useState('success');
  const dialogReturnFocusRef = useRef(null);
  const focusMap = useRef(new Map());
  const { stage } = useTicketLeadStage(ticket);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    emitInboxTelemetry('chat.header.viewed', { ticketId: ticket?.id ?? null });
  }, [ticket?.id]);

  const identity = useMemo(() => getTicketIdentity(ticket), [ticket]);
  const name = identity.displayName ?? ticket?.subject ?? 'Contato sem nome';
  const rawPhone = identity.rawPhone ?? ticket?.contact?.phone ?? ticket?.metadata?.contactPhone ?? null;
  const instanceId = resolveTicketInstanceId(ticket);
  const whatsapp = isWhatsAppTicket(ticket);
  const contactId = ticket?.contact?.id ?? ticket?.contactId ?? null;
  const shortId = useMemo(() => {
    const identifier = ticket?.id ?? null;
    if (!identifier) return null;
    const normalized = String(identifier);
    return normalized.length <= 8 ? normalized.toUpperCase() : normalized.slice(-8).toUpperCase();
  }, [ticket?.id]);

  const assignee = useMemo(() => resolveTicketAssignee(ticket, currentUser), [currentUser, ticket]);
  const windowState = useMemo(() => resolveWindowState(ticket, now), [now, ticket]);
  const waiting = useMemo(() => resolveWaitingState(ticket, now), [now, ticket]);

  const phoneAction = usePhoneActions(rawPhone, {
    missingPhoneMessage: 'Este contato não tem telefone cadastrado.',
  });
  const handleCall = useCallback(() => phoneAction('call'), [phoneAction]);
  const handleSendSms = useCallback(() => {
    phoneAction('sms');
    onSendSMS?.(rawPhone);
  }, [onSendSMS, phoneAction, rawPhone]);

  const openDialog = useCallback(
    (dialog, { returnFocus } = {}) => {
      dialogReturnFocusRef.current = returnFocus ?? null;
      if (dialog === 'register-result') {
        // Lead já marcado como Perdido: o diálogo abre direto no registro da perda.
        setOutcomeMode(getOutcomeModeForStage(stage));
      }
      setActiveDialog(dialog);
    },
    [stage],
  );

  const closeDialog = useCallback(() => {
    setActiveDialog(null);
    const target = dialogReturnFocusRef.current;
    if (target && typeof target.focus === 'function') {
      target.focus({ preventScroll: true });
    }
    dialogReturnFocusRef.current = null;
  }, []);

  const handleCallResultSubmit = useCallback(
    ({ outcome, notes }) => {
      onRegisterCallResult?.({ outcome, notes });
      closeDialog();
    },
    [closeDialog, onRegisterCallResult],
  );

  const handleLossReasonSubmit = useCallback(
    async ({ reason, notes }) => {
      if (!onRegisterResult) {
        toast.error('Não foi possível concluir. Tente novamente.');
        return;
      }
      const reasonLabel = LOSS_REASON_HELPERS[reason] ?? reason;
      const finalReason = notes ? `${reasonLabel} — ${notes}` : reasonLabel;
      try {
        await onRegisterResult({ outcome: 'lost', reason: finalReason });
        closeDialog();
      } catch {
        // feedback tratado a montante
      }
    },
    [closeDialog, onRegisterResult],
  );

  const handleSuccessSubmit = useCallback(
    async ({ installment, netAmount, term, product, bank, notes }) => {
      if (!onRegisterResult) {
        toast.error('Não foi possível concluir. Tente novamente.');
        return;
      }
      try {
        await onRegisterResult({
          outcome: 'won',
          metadata: { installment, netAmount, term, product, bank },
          reason: notes,
        });
        closeDialog();
      } catch {
        // feedback tratado a montante
      }
    },
    [closeDialog, onRegisterResult],
  );

  const commandContext = useMemo(
    () => ({
      ticket,
      handlers: {
        onGenerateProposal,
        onAssign,
        onRegisterResult,
        onRegisterCallResult,
        onScheduleFollowUp,
        onAttachFile,
        onEditContact,
        onCall: handleCall,
        onSendSMS: handleSendSms,
        onCreateNote,
      },
      capabilities: {
        canGenerateProposal: Boolean(ticket && onGenerateProposal),
        canAssign: Boolean(ticket),
        canRegisterResult: Boolean(ticket),
        canCall: Boolean(rawPhone),
        canSendSms: Boolean(rawPhone),
        canQuickFollowUp: Boolean(ticket),
        canAttachFile: true,
        canEditContact: Boolean(ticket?.contact?.id),
      },
      phoneNumber: rawPhone ?? null,
      loadingStates: { registerResult: isRegisteringResult },
      openDialog,
      analytics: ({ id }) => emitInboxTelemetry('chat.command.execute', { ticketId: ticket?.id ?? null, actionId: id }),
      timeline,
      ai: aiAssistant,
      contactIdentity: identity,
    }),
    [
      aiAssistant,
      handleCall,
      handleSendSms,
      identity,
      isRegisteringResult,
      onAssign,
      onAttachFile,
      onCreateNote,
      onEditContact,
      onGenerateProposal,
      onRegisterCallResult,
      onRegisterResult,
      onScheduleFollowUp,
      openDialog,
      rawPhone,
      ticket,
      timeline,
    ],
  );

  const primaryAction = resolveHeaderPrimaryAction({
    ticket,
    assignee,
    aiMode,
    windowState,
    stage,
    canAssign: typeof onAssign === 'function',
    canTakeOver: typeof onTakeOver === 'function',
    canOpenTemplates: typeof onOpenTemplates === 'function',
  });

  const handlePrimaryAction = useCallback(
    (event) => {
      if (!primaryAction) return;
      emitInboxTelemetry('chat.header.primary_action', { ticketId: ticket?.id ?? null, actionId: primaryAction.id });
      switch (primaryAction.id) {
        case 'assign-self':
          onAssign?.(ticket, currentUser?.id ?? null);
          break;
        case 'take-over-ai':
          onTakeOver?.();
          onFocusComposer?.();
          break;
        case 'send-template':
          onOpenTemplates?.();
          break;
        case 'register-result':
          openDialog('register-result', { returnFocus: event?.currentTarget ?? null });
          break;
        default:
          break;
      }
    },
    [currentUser?.id, onAssign, onFocusComposer, onOpenTemplates, onTakeOver, openDialog, primaryAction, ticket],
  );

  const assignEntry = useMemo(() => {
    const definition = ACTIONS_BY_ID['assign-owner'];
    return {
      definition,
      canExecute: definition?.canExecute?.(commandContext) ?? true,
      state: definition?.getState?.(commandContext) ?? {},
    };
  }, [commandContext]);

  const typingLabel = typingAgents.length > 0 ? `${typingAgents[0]?.userName ?? 'Alguém da equipe'} digitando…` : null;

  const handleToggleDetails = () => {
    if (onToggleDetails) {
      onToggleDetails();
    } else {
      onRequestDetails?.({});
    }
  };

  return (
    <header
      data-testid="conversation-header-summary"
      className={cn('@container shrink-0 border-b border-border bg-background', className)}
    >
      <div className="flex min-h-14 items-center gap-2 px-3 py-2 @xl:gap-3 @xl:px-4">
      <HeaderIdentity
        name={name}
        phone={identity.displayPhone ?? null}
        instanceId={instanceId}
        isWhatsApp={whatsapp}
        typingLabel={typingLabel}
        onBack={onBack}
      />
      <HeaderStatus
        stage={stage}
        onStageChange={onStageChange}
        pendingStage={pendingStage}
        time={<TicketTimeChip ticket={ticket} windowState={windowState} waiting={waiting} />}
        className="hidden @2xl:flex"
      />
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        {typeof onAssign === 'function' && assignEntry.definition ? (
          <AssignTicketPopover
            entry={assignEntry}
            context={commandContext}
            focusMap={focusMap}
            currentUser={currentUser}
            buttonClassName="hidden @md:inline-flex"
          />
        ) : null}
        <HeaderPrimaryAction
          action={primaryAction}
          onExecute={handlePrimaryAction}
          loading={primaryAction?.id === 'register-result' && isRegisteringResult}
        />
        <HeaderOverflow
          context={commandContext}
          focusMap={focusMap}
          ticket={ticket}
          contactId={contactId}
          shortId={shortId}
          primaryActionId={primaryAction?.id ?? null}
          aiMode={aiMode}
          aiConfidence={aiConfidence}
          aiModeChangeDisabled={aiModeChangeDisabled}
          onAiModeChange={onAiModeChange}
          onTakeOver={onTakeOver}
          onGiveBackToAi={onGiveBackToAi}
          onOpenDetails={ticket?.id ? handleToggleDetails : undefined}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Mostrar detalhes do contato"
              aria-pressed={detailsOpen}
              aria-expanded={detailsOpen}
              className={cn('hidden @md:inline-flex', detailsOpen && 'bg-surface-sunken text-foreground')}
              disabled={!ticket?.id}
              onClick={handleToggleDetails}
            >
              <PanelRight aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{detailsOpen ? 'Fechar painel do contato' : 'Painel do contato'}</TooltipContent>
        </Tooltip>
      </div>
      <OutcomeDialog
        open={activeDialog === 'register-result'}
        mode={outcomeMode}
        onModeChange={(nextMode) => {
          if (!nextMode) {
            closeDialog();
            return;
          }
          setOutcomeMode(nextMode);
          setActiveDialog('register-result');
        }}
        lossOptions={LOSS_REASONS}
        onConfirmLoss={handleLossReasonSubmit}
        onConfirmSuccess={handleSuccessSubmit}
        isSubmitting={isRegisteringResult}
      />
      <CallResultDialog
        open={activeDialog === 'call-result'}
        onOpenChange={(open) => {
          if (open) {
            setActiveDialog('call-result');
          } else {
            closeDialog();
          }
        }}
        onSubmit={handleCallResultSubmit}
      />
      </div>
    </header>
  );
};

export { ConversationHeader, PrimaryActionButton };
export default ConversationHeader;
