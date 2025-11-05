import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Archive, CheckCircle2, CircleDashed, Clock3, HelpCircle, UserCheck } from 'lucide-react';
import emitInboxTelemetry from '../../utils/telemetry.js';
import { usePhoneActions } from '../../hooks/usePhoneActions.js';
import CallResultDialog from './CallResultDialog.jsx';
import OutcomeDialog from './OutcomeDialog.jsx';
import useTicketJro from '../../hooks/useTicketJro.js';
import PrimaryActionBanner, { PrimaryActionButton } from './PrimaryActionBanner.jsx';
import useTicketStageInfo from './hooks/useTicketStageInfo.js';
import { DEFAULT_AI_MODE, AI_MODE_OPTIONS, isValidAiMode } from './aiModes.js';
import { getTicketIdentity } from '../../utils/ticketIdentity.js';
import useInstancePresentation from '../../hooks/useInstancePresentation.js';

export const GENERATE_PROPOSAL_ANCHOR_ID = 'command-generate-proposal';

const LOSS_REASONS = [
  { value: 'sem_interesse', label: 'Sem interesse' },
  { value: 'orcamento', label: 'Sem orçamento disponível' },
  { value: 'concorrencia', label: 'Fechou com a concorrência' },
  { value: 'documentacao', label: 'Documentação incompleta' },
  { value: 'outro', label: 'Outro' },
];

const LOSS_REASON_HELPERS = LOSS_REASONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const STATUS_PRESENTATION = {
  OPEN: { label: 'Aberto', tone: 'info', icon: CircleDashed },
  PENDING: { label: 'Pendente', tone: 'warning', icon: Clock3 },
  ASSIGNED: { label: 'Em atendimento', tone: 'info', icon: UserCheck },
  RESOLVED: { label: 'Resolvido', tone: 'success', icon: CheckCircle2 },
  CLOSED: { label: 'Fechado', tone: 'neutral', icon: Archive },
};

const INDICATOR_TONES = {
  info: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted',
  warning: 'border-warning-soft-border bg-warning-soft text-warning-strong',
  danger: 'border-status-error-border bg-status-error-surface text-status-error-foreground',
  neutral: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted',
  success: 'border-success-soft-border bg-success-soft text-success-strong',
};

const AI_HANDOFF_CONFIDENCE_THRESHOLD = 0.5;

const AI_CONFIDENCE_TONES = {
  high: 'border-success-soft-border bg-success-soft text-success-strong',
  medium: 'border-warning-soft-border bg-warning-soft text-warning-strong',
  low: 'border-status-error-border bg-status-error-surface text-status-error-foreground',
  unknown: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted',
};

const PRIMARY_ACTION_PRESETS = {
  initialContact: {
    whatsapp: { id: 'send-initial-wa', label: 'Enviar 1ª mensagem (WhatsApp)' },
    validateContact: { id: 'validate-contact', label: 'Validar contato' },
    fallback: { id: 'call-now', label: 'Ligar agora' },
  },
  keepEngagement: {
    whatsapp: { id: 'send-wa', label: 'Enviar mensagem (WhatsApp)' },
    validateContact: { id: 'validate-contact', label: 'Validar contato' },
    fallback: { id: 'call-now', label: 'Ligar agora' },
  },
  qualify: {
    default: { id: 'qualify', label: 'Registrar próximo passo' },
  },
  proposal: {
    default: { id: 'generate-proposal', label: 'Gerar proposta' },
  },
  documentation: {
    default: { id: 'send-steps', label: 'Enviar passo a passo' },
  },
  followUp: {
    whatsapp: { id: 'send-followup', label: 'Enviar follow-up' },
    fallback: { id: 'call-followup', label: 'Ligar (follow-up)' },
  },
  closeDeal: {
    default: { id: 'close-register', label: 'Registrar resultado' },
  },
};

const PRIMARY_ACTION_MAP = {
  NOVO: PRIMARY_ACTION_PRESETS.initialContact,
  CONECTADO: PRIMARY_ACTION_PRESETS.keepEngagement,
  QUALIFICACAO: PRIMARY_ACTION_PRESETS.qualify,
  PROPOSTA: PRIMARY_ACTION_PRESETS.proposal,
  DOCUMENTACAO: PRIMARY_ACTION_PRESETS.documentation,
  DOCUMENTOS_AVERBACAO: PRIMARY_ACTION_PRESETS.documentation,
  AGUARDANDO: PRIMARY_ACTION_PRESETS.followUp,
  AGUARDANDO_CLIENTE: PRIMARY_ACTION_PRESETS.followUp,
  LIQUIDACAO: PRIMARY_ACTION_PRESETS.closeDeal,
  APROVADO_LIQUIDACAO: PRIMARY_ACTION_PRESETS.closeDeal,
  RECICLAR: PRIMARY_ACTION_PRESETS.followUp,
};

const JRO_TONE_CLASSES = {
  neutral: {
    text: 'text-[color:var(--accent-inbox-primary)]',
    bar: 'bg-[color:var(--accent-inbox-primary)]',
    chip: 'bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_14%,transparent)]/80',
  },
  yellow: {
    text: 'text-amber-300',
    bar: 'bg-amber-400',
    chip: 'bg-amber-300/10',
  },
  orange: {
    text: 'text-orange-300',
    bar: 'bg-orange-400',
    chip: 'bg-orange-300/10',
  },
  overdue: {
    text: 'text-red-400',
    bar: 'bg-red-500',
    chip: 'bg-red-400/10',
    pulse: 'animate-pulse',
  },
};

const PRIMARY_BUTTON_TONE = {
  neutral: 'bg-[color:var(--accent-inbox-primary)] text-white hover:bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_88%,transparent)]',
  yellow: 'bg-amber-500 text-white hover:bg-amber-500/90',
  orange: 'bg-orange-500 text-white hover:bg-orange-500/90',
  overdue: 'bg-red-500 text-white hover:bg-red-500/90 animate-pulse',
};

const DEAL_STAGE_KEYS = new Set(['LIQUIDACAO', 'APROVADO_LIQUIDACAO']);
const CHANNEL_PRESENTATION = {
  WHATSAPP: {
    id: 'whatsapp',
    label: 'WhatsApp',
    className:
      'border-[color:var(--color-status-whatsapp-border)] bg-[color:var(--color-status-whatsapp-surface)] text-[color:var(--color-status-whatsapp-foreground)]',
  },
  VOICE: {
    id: 'voice',
    label: 'Telefone',
    className: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground',
  },
  EMAIL: {
    id: 'email',
    label: 'E-mail',
    className: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground',
  },
  DEFAULT: {
    id: 'unknown',
    label: 'Canal não identificado',
    className: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted',
  },
};

const normalizeChannel = (value) => {
  if (!value) return null;

  const normalized = String(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toUpperCase();

  if (!normalized) {
    return null;
  }

  if (normalized === 'PHONE' || normalized === 'TELEFONE' || normalized === 'CALL') {
    return 'VOICE';
  }

  if (normalized === 'E-MAIL' || normalized === 'MAIL') {
    return 'EMAIL';
  }

  if (normalized === 'WA') {
    return 'WHATSAPP';
  }

  return normalized;
};

const resolveChannelInfo = (channel) => {
  const normalized = normalizeChannel(channel);
  return CHANNEL_PRESENTATION[normalized] ?? CHANNEL_PRESENTATION.DEFAULT;
};

const getOriginLabel = (ticket) => {
  const origin =
    ticket?.metadata?.origin ??
    ticket?.metadata?.source ??
    ticket?.origin ??
    ticket?.source ??
    null;
  if (!origin) {
    return null;
  }
  return origin;
};

const getStatusInfo = (status) => {
  const normalized = status ? String(status).toUpperCase() : 'OPEN';
  const presentation = STATUS_PRESENTATION[normalized] ?? {
    label: normalized,
    tone: 'neutral',
    icon: HelpCircle,
  };

  return {
    label: presentation.label ?? normalized,
    tone: presentation.tone ?? 'neutral',
    icon: presentation.icon ?? HelpCircle,
  };
};

const ConversationHeader = ({
  ticket,
  onRegisterResult,
  onRegisterCallResult,
  onAssign,
  onSendTemplate,
  onCreateNextStep,
  onGenerateProposal,
  onScheduleFollowUp,
  onSendSMS,
  onAttachFile,
  onEditContact,
  typingAgents = [],
  isRegisteringResult = false,
  renderSummary,
  onContactFieldSave,
  onDealFieldSave,
  nextStepValue,
  onNextStepSave,
  onFocusComposer,
  composerHeight,
  aiMode = DEFAULT_AI_MODE,
  aiConfidence = null,
  aiModeChangeDisabled = false,
  onTakeOver,
  onGiveBackToAi,
  onAiModeChange,
  onCreateNote,
  timeline = [],
  aiAssistant,
  components,
  detailsOpen = false,
  onRequestDetails,
  nextStepEditorRef: externalNextStepEditorRef,
}) => {
  const [activeDialog, setActiveDialog] = useState(null);
  const [outcomeMode, setOutcomeMode] = useState('success');
  const internalNextStepEditorRef = useRef(null);
  const nextStepEditorRef = externalNextStepEditorRef ?? internalNextStepEditorRef;

  const focusNextStepEditor = useCallback(() => {
    const target = nextStepEditorRef.current;
    if (!target || typeof target.focus !== 'function') {
      return false;
    }
    return Boolean(target.focus());
  }, []);

  const revealNextStepEditor = useCallback(() => {
    onRequestDetails?.({ focus: 'nextStep' });
    const timeoutId =
      typeof window !== 'undefined'
        ? window.setTimeout(() => {
            const focused = focusNextStepEditor();
            if (!focused) {
              onFocusComposer?.();
            }
          }, 220)
        : null;

    return () => {
      if (timeoutId && typeof window !== 'undefined') {
        window.clearTimeout(timeoutId);
      }
    };
  }, [focusNextStepEditor, onFocusComposer, onRequestDetails]);

  const dialogReturnFocusRef = useRef(null);
  const jro = useTicketJro(ticket);
  const { stageKey, stageInfo, primaryAction } = useTicketStageInfo(ticket);

  useEffect(() => {
    emitInboxTelemetry('chat.header.viewed', {
      ticketId: ticket?.id ?? null,
    });
  }, [ticket?.id]);

  const identity = useMemo(() => getTicketIdentity(ticket), [ticket]);
  const name = identity.displayName ?? ticket?.subject ?? 'Contato sem nome';
  const company = ticket?.metadata?.company ?? ticket?.contact?.company ?? null;
  const title = company ? `${name} | ${company}` : name;
  const leadIdentifier = ticket?.lead?.id ?? ticket?.id ?? null;
  const shortId = useMemo(() => {
    if (!leadIdentifier) return null;
    const normalized = String(leadIdentifier);
    if (normalized.length <= 8) return normalized.toUpperCase();
    if (normalized.includes('-')) {
      const segments = normalized.split('-');
      return segments[segments.length - 1].slice(0, 8).toUpperCase();
    }
    return normalized.slice(-8).toUpperCase();
  }, [leadIdentifier]);

  const rawPhone = identity.rawPhone ?? ticket?.contact?.phone ?? ticket?.metadata?.contactPhone ?? null;

  const statusInfo = useMemo(() => getStatusInfo(ticket?.status), [ticket?.status]);
  const origin = useMemo(() => getOriginLabel(ticket), [ticket]);
  const originInfo = useMemo(() => (origin ? resolveChannelInfo(origin) : null), [origin]);
  const instanceId =
    ticket?.metadata?.sourceInstance ??
    ticket?.instanceId ??
    ticket?.metadata?.instanceId ??
    null;
  const instancePresentation = useInstancePresentation(instanceId);

  const phoneAction = usePhoneActions(rawPhone, {
    missingPhoneMessage: 'Nenhum telefone disponível para este lead.',
  });

  const handleCall = useCallback(() => {
    phoneAction('call');
  }, [phoneAction]);

  const handleSendSms = useCallback(() => {
    phoneAction('sms');
    onSendSMS?.(rawPhone);
  }, [onSendSMS, phoneAction, rawPhone]);

  const openDialog = useCallback((dialog, { returnFocus } = {}) => {
    dialogReturnFocusRef.current = returnFocus ?? null;
    if (dialog === 'register-result') {
      setOutcomeMode('success');
    }
    setActiveDialog(dialog);
  }, []);

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
          metadata: {
            installment,
            netAmount,
            term,
            product,
            bank,
          },
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
        canGenerateProposal: Boolean(ticket),
        canAssign: Boolean(ticket),
        canRegisterResult: Boolean(ticket),
        canCall: Boolean(rawPhone),
        canSendSms: Boolean(rawPhone),
        canQuickFollowUp: Boolean(ticket),
        canAttachFile: true,
        canEditContact: Boolean(ticket?.contact?.id),
      },
      phoneNumber: rawPhone ?? null,
      loadingStates: {
        registerResult: isRegisteringResult,
      },
      openDialog,
      analytics: ({ id }) => emitInboxTelemetry('chat.command.execute', { ticketId: ticket?.id ?? null, actionId: id }),
      timeline,
      ai: aiAssistant,
      contactIdentity: identity,
    }),
    [
      aiAssistant,
      identity,
      handleCall,
      handleSendSms,
      isRegisteringResult,
      onAttachFile,
      onAssign,
      onCreateNote,
      onEditContact,
      onGenerateProposal,
      onRegisterCallResult,
      onRegisterResult,
      onScheduleFollowUp,
      openDialog,
      rawPhone,
      timeline,
      ticket,
    ],
  );

  const handlePrimaryAction = useCallback(() => {
    if (!primaryAction) {
      return;
    }

    switch (primaryAction.id) {
      case 'send-initial-wa':
      case 'send-wa':
        onFocusComposer?.();
        break;
      case 'call-now':
      case 'call-followup':
        handleCall();
        break;
      case 'validate-contact':
        onEditContact?.(ticket?.contact?.id ?? null);
        break;
      case 'qualify':
        revealNextStepEditor();
        break;
      case 'generate-proposal':
        onGenerateProposal?.(ticket);
        break;
      case 'send-steps':
        onSendTemplate?.({ id: 'steps' });
        break;
      case 'send-followup':
        onScheduleFollowUp?.(ticket);
        break;
      case 'close-register':
        openDialog('register-result');
        break;
      default:
        break;
    }
  }, [
    handleCall,
    onFocusComposer,
    onGenerateProposal,
    onScheduleFollowUp,
    onSendTemplate,
    openDialog,
    primaryAction,
    revealNextStepEditor,
    ticket,
    onEditContact,
  ]);

  const {
    PrimaryActionBanner: PrimaryActionBannerComponent = PrimaryActionBanner,
  } = components ?? {};

  const summaryContent = (
    <PrimaryActionBannerComponent
      name={name}
      title={title}
      shortId={shortId}
      ticket={ticket}
      statusInfo={statusInfo}
      stageKey={stageKey}
      stageInfo={stageInfo}
      originInfo={originInfo}
      typingAgents={typingAgents}
      primaryAction={primaryAction}
      onPrimaryAction={handlePrimaryAction}
      jro={jro}
      commandContext={commandContext}
      detailsOpen={detailsOpen}
      onRequestDetails={onRequestDetails}
      nextStepValue={nextStepValue}
      aiMode={aiMode}
      aiConfidence={aiConfidence}
      aiModeChangeDisabled={aiModeChangeDisabled}
      onAiModeChange={onAiModeChange}
      onTakeOver={onTakeOver}
      onGiveBackToAi={onGiveBackToAi}
      contactPhone={identity.displayPhone ?? identity.remoteJid ?? null}
      instanceId={instanceId}
      instancePresentation={instancePresentation}
    />
  );

  const renderedSummary = renderSummary
    ? renderSummary(summaryContent)
    : summaryContent;

  return (
    <section className="relative z-10 flex flex-col gap-4 px-2 py-2 sm:px-0">
      {renderedSummary}
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
    </section>
  );
};

export { ConversationHeader, PrimaryActionButton };
export default ConversationHeader;
