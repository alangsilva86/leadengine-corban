import { useCallback, useEffect, useMemo, useRef, useState, useId } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible.jsx';
import { cn, formatPhoneNumber, buildInitials } from '@/lib/utils.js';
import { useClipboard } from '@/hooks/use-clipboard.js';
import { toast } from 'sonner';
import { ChevronDown, FileText, IdCard, Phone } from 'lucide-react';
import emitInboxTelemetry from '../../utils/telemetry.js';
import { formatDateTime } from '../../utils/datetime.js';
import QuickComposer from './QuickComposer.jsx';
import { usePhoneActions } from '../../hooks/usePhoneActions.js';
import CallResultDialog from './CallResultDialog.jsx';
import LossReasonDialog from './LossReasonDialog.jsx';
import { CommandBar } from './CommandBar.jsx';

export const GENERATE_PROPOSAL_ANCHOR_ID = 'command-generate-proposal';

const LOSS_REASONS = [
  { value: 'sem_interesse', label: 'Sem interesse' },
  { value: 'orcamento', label: 'Sem orçamento disponível' },
  { value: 'concorrencia', label: 'Fechou com a concorrência' },
  { value: 'documentacao', label: 'Documentação incompleta' },
  { value: 'outro', label: 'Outro' },
];

const STATUS_LABELS = {
  OPEN: 'Aberto',
  PENDING: 'Pendente',
  ASSIGNED: 'Em atendimento',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
};

const STATUS_TONE = {
  OPEN: 'info',
  PENDING: 'info',
  ASSIGNED: 'info',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

const CHIP_STYLES = {
  info: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted',
  warning: 'border-warning-soft-border bg-warning-soft text-warning-strong',
  danger: 'border-status-error-border bg-status-error-surface text-status-error-foreground',
  neutral: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted',
  success: 'border-success-soft-border bg-success-soft text-success-strong',
};

const LOSS_REASON_HELPERS = LOSS_REASONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const formatPotential = (value) => {
  if (value === null || value === undefined) return 'R$ —';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return `R$ ${value}`;
  }
  return `R$ ${numeric.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
};

const formatProbability = (value) => {
  if (value === null || value === undefined) return '—';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value);
  return `${Math.round(numeric)}%`;
};

const getStatusInfo = (status) => {
  const normalized = status ? String(status).toUpperCase() : 'OPEN';
  return {
    label: STATUS_LABELS[normalized] ?? normalized,
    tone: STATUS_TONE[normalized] ?? 'neutral',
  };
};

const buildShortId = (value) => {
  if (!value) return null;
  const normalized = String(value);
  if (normalized.length <= 8) return normalized;
  if (normalized.includes('-')) {
    const segments = normalized.split('-');
    return segments[segments.length - 1].slice(0, 8).toUpperCase();
  }
  return normalized.slice(-8).toUpperCase();
};

const minutesToHoursLabel = (minutes) => {
  if (minutes === undefined || minutes === null) return null;
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.round(minutes / 60);
  return `${hours} h`;
};

const getExpirationInfo = (windowInfo = {}) => {
  const { remainingMinutes, isOpen } = windowInfo;

  if (isOpen === false) {
    return { label: 'Janela expirada', tone: 'danger' };
  }

  if (remainingMinutes === undefined || remainingMinutes === null) {
    return { label: 'Expira em breve', tone: 'warning' };
  }

  if (remainingMinutes <= 120) {
    const label = remainingMinutes <= 60
      ? `Expira em ${remainingMinutes} min`
      : `Expira em ${Math.round(remainingMinutes / 60)} h`;
    return { label, tone: 'danger' };
  }

  if (remainingMinutes < 1440) {
    const label = remainingMinutes <= 180
      ? `Expira em ${Math.round(remainingMinutes / 60)} h`
      : 'Expira em 24h';
    return { label, tone: 'warning' };
  }

  const days = Math.floor(remainingMinutes / 1440);
  return { label: `Expira em ${days}d`, tone: 'warning' };
};

const buildSlaTooltip = (windowInfo = {}) => {
  const lastInteraction = minutesToHoursLabel(windowInfo.lastInteractionMinutes);
  if (!lastInteraction) {
    return 'Prazo para primeira resposta.';
  }
  return `Prazo para primeira resposta. Último contato há ${lastInteraction}.`;
};

const Chip = ({ tone = 'neutral', className, children, ...props }) => (
  <span
    className={cn(
      'inline-flex min-h-[28px] items-center justify-center rounded-full px-3 text-[12px] font-medium leading-none tracking-wide',
      CHIP_STYLES[tone] ?? CHIP_STYLES.neutral,
      className,
    )}
    {...props}>
    {children}
  </span>
);

const TypingIndicator = ({ agents = [] }) => {
  if (!agents.length) return null;
  const label = agents[0]?.userName ?? 'Agente';
  return (
    <div className="inline-flex min-h-[28px] items-center gap-2 rounded-full border border-surface-overlay-glass-border bg-surface-overlay-quiet px-3 text-[12px] text-foreground-muted">
      <div className="flex -space-x-2">
        {agents.slice(0, 3).map((agent) => (
          <Avatar key={agent.userId} className="h-6 w-6 border border-surface-overlay-glass-border">
            <AvatarFallback>{buildInitials(agent.userName, 'AG')}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      <span>{label} digitando…</span>
    </div>
  );
};

const InfoRow = ({
  label,
  children,
  className,
  labelClassName,
  valueClassName,
  ...props
}) => {
  const labelId = useId();

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={cn('flex flex-col gap-1', className)}
      {...props}>
      <span
        id={labelId}
        className={cn('text-xs font-medium uppercase tracking-wide text-foreground-muted', labelClassName)}
      >
        {label}
      </span>
      <div className={cn('text-sm font-medium text-foreground', valueClassName)}>{children ?? '—'}</div>
    </div>
  );
};

export const ConversationCardBody = ({ children, className }) => (
  <div
    className={cn(
      'mt-3 grid gap-4 border-t border-surface-overlay-glass-border pt-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]',
      className,
    )}
  >
    {children}
  </div>
);

ConversationCardBody.Left = function ConversationCardBodyLeft({ children, className }) {
  return <div className={cn('flex flex-col gap-4', className)}>{children}</div>;
};

ConversationCardBody.Right = function ConversationCardBodyRight({ children, className }) {
  return <div className={cn('flex flex-col gap-4', className)}>{children}</div>;
};

export { ConversationCardBody as CardBody };

const SectionLink = ({ actionId, label, onActivate }) => (
  <a
    href={`#command-${actionId}`}
    onClick={(event) => {
      event.preventDefault();
      onActivate(actionId);
    }}
    className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-surface-overlay-glass-border px-3 py-1 text-xs font-medium text-foreground hover:bg-surface-overlay-quiet"
  >
    {label}
  </a>
);

export const ConversationHeader = ({
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
  renderDetails,
}) => {
  const [isFadeIn, setIsFadeIn] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeDialog, setActiveDialog] = useState(null);
  const dialogReturnFocusRef = useRef(null);
  const { copy: copyToClipboard } = useClipboard();

  useEffect(() => {
    if (!ticket) return;
    setIsFadeIn(false);
    setIsExpanded(false);
    const frame = requestAnimationFrame(() => setIsFadeIn(true));
    return () => cancelAnimationFrame(frame);
  }, [ticket?.id, ticket]);

  useEffect(() => {
    emitInboxTelemetry('chat.header.toggle', {
      ticketId: ticket?.id ?? null,
      open: isExpanded,
    });
  }, [isExpanded, ticket?.id]);

  const name = ticket?.contact?.name ?? ticket?.subject ?? 'Contato sem nome';
  const company = ticket?.metadata?.company ?? ticket?.contact?.company ?? null;
  const title = company ? `${name} | ${company}` : name;
  const leadIdentifier = ticket?.lead?.id ?? ticket?.id ?? null;
  const shortId = useMemo(() => buildShortId(leadIdentifier), [leadIdentifier]);
  const phoneDisplay = formatPhoneNumber(ticket?.contact?.phone || ticket?.metadata?.contactPhone);
  const rawPhone = ticket?.contact?.phone || ticket?.metadata?.contactPhone || null;
  const document = ticket?.contact?.document ?? null;
  const email = ticket?.contact?.email ?? ticket?.metadata?.contactEmail ?? null;

  const statusInfo = useMemo(() => getStatusInfo(ticket?.status), [ticket?.status]);
  const expirationInfo = useMemo(() => getExpirationInfo(ticket?.window), [ticket?.window]);
  const slaTooltip = useMemo(() => buildSlaTooltip(ticket?.window), [ticket?.window]);
  const remainingMinutes = ticket?.window?.remainingMinutes ?? null;
  const lastInteractionLabel = useMemo(
    () => minutesToHoursLabel(ticket?.window?.lastInteractionMinutes),
    [ticket?.window?.lastInteractionMinutes],
  );

  const potential = useMemo(() => formatPotential(ticket?.lead?.value), [ticket?.lead?.value]);
  const probability = useMemo(() => formatProbability(ticket?.lead?.probability), [ticket?.lead?.probability]);
  const stage = useMemo(
    () => ticket?.pipelineStep ?? ticket?.metadata?.pipelineStep ?? '—',
    [ticket?.pipelineStep, ticket?.metadata?.pipelineStep],
  );

  const timeline = ticket?.timeline ?? {};
  const lastInboundLabel = useMemo(() => formatDateTime(timeline.lastInboundAt), [timeline.lastInboundAt]);
  const lastOutboundLabel = useMemo(() => formatDateTime(timeline.lastOutboundAt), [timeline.lastOutboundAt]);
  const directionMeta = useMemo(() => {
    switch (timeline.lastDirection) {
      case 'INBOUND':
        return { tone: 'warning', label: 'Cliente aguardando resposta' };
      case 'OUTBOUND':
        return { tone: 'info', label: 'Aguardando cliente' };
      default:
        return { tone: 'neutral', label: 'Sem interações recentes' };
    }
  }, [timeline.lastDirection]);
  const unreadInboundCount = timeline.unreadInboundCount ?? 0;

  const subtitle = useMemo(() => {
    const parts = [];
    if (stage && stage !== '—') {
      parts.push(`Etapa: ${stage}`);
    }
    if (lastInteractionLabel) {
      parts.push(`Último contato há ${lastInteractionLabel}`);
    }
    if (unreadInboundCount > 0) {
      const hasMany = unreadInboundCount > 1;
      parts.push(`${unreadInboundCount} mensagem${hasMany ? 's' : ''} pendente${hasMany ? 's' : ''}`);
    }
    return parts.join(' • ');
  }, [stage, lastInteractionLabel, unreadInboundCount]);

  const attachments = useMemo(() => {
    const source = ticket?.metadata?.attachments ?? ticket?.attachments ?? null;
    if (Array.isArray(source)) return source.filter(Boolean);
    if (source && typeof source === 'object') return Object.values(source).filter(Boolean);
    return [];
  }, [ticket?.attachments, ticket?.metadata?.attachments]);

  const phoneAction = usePhoneActions(rawPhone, {
    missingPhoneMessage: 'Nenhum telefone disponível para este lead.',
  });

  const handleCall = useCallback(
    (phone) => {
      phoneAction('call', phone);
    },
    [phoneAction],
  );

  const handleSendSms = useCallback(
    (phone) => {
      const executed = phoneAction('sms', phone);
      if (executed) {
        onSendSMS?.(phone);
      }
    },
    [onSendSMS, phoneAction],
  );

  const openDialog = useCallback((dialog, { returnFocus } = {}) => {
    dialogReturnFocusRef.current = returnFocus ?? null;
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

  const handleCopyDocument = useCallback(() => {
    const fallbackMessage =
      document && document !== '—' ? (value) => `Copie manualmente: ${value}` : null;
    copyToClipboard(document, {
      emptyMessage: 'Nenhum documento disponível para copiar.',
      successMessage: 'Documento copiado.',
      errorMessage: 'Não foi possível concluir. Tente novamente.',
      fallbackMessage,
    });
  }, [copyToClipboard, document]);

  const handleGenerateProposal = useCallback(() => {
    onGenerateProposal?.(ticket);
  }, [onGenerateProposal, ticket]);

  useEffect(() => {
    if (!ticket) {
      return undefined;
    }

    const handleShortcut = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const key = event.key?.toLowerCase();
      switch (key) {
        case 'e':
          setIsExpanded((previous) => !previous);
          event.preventDefault();
          break;
        case 'g':
          handleGenerateProposal();
          event.preventDefault();
          break;
        case 'n':
          onAssign?.(ticket);
          event.preventDefault();
          break;
        case 'x':
          onScheduleFollowUp?.(ticket);
          event.preventDefault();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [ticket, onAssign, onScheduleFollowUp, handleGenerateProposal]);

  const handleAssign = useCallback(() => {
    onAssign?.(ticket);
  }, [onAssign, ticket]);

  const handleScheduleFollowUp = useCallback(() => {
    onScheduleFollowUp?.(ticket);
  }, [onScheduleFollowUp, ticket]);

  const handleLossReasonSubmit = useCallback(async ({ reason, notes }) => {
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
  }, [closeDialog, onRegisterResult]);

  const handleCommandLink = useCallback((actionId) => {
    const element = document.getElementById(`command-${actionId}`);
    if (!element) return;
    element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    element.focus({ preventScroll: true });
  }, []);

  const commandCapabilities = useMemo(
    () => ({
      canGenerateProposal: Boolean(ticket),
      canAssign: Boolean(ticket),
      canRegisterResult: Boolean(ticket),
      canCall: Boolean(rawPhone),
      canSendSms: Boolean(rawPhone),
      canQuickFollowUp: Boolean(ticket),
      canAttachFile: true,
      canEditContact: Boolean(ticket?.contact?.id),
    }),
    [ticket, rawPhone],
  );

  const commandContext = useMemo(
    () => ({
      ticket,
      handlers: {
        onGenerateProposal,
        onAssign: handleAssign,
        onRegisterResult,
        onRegisterCallResult: handleCallResultSubmit,
        onScheduleFollowUp: handleScheduleFollowUp,
        onAttachFile,
        onEditContact,
        onCall: handleCall,
        onSendSMS: handleSendSms,
      },
      capabilities: commandCapabilities,
      phoneNumber: rawPhone ?? null,
      loadingStates: {
        registerResult: isRegisteringResult,
      },
      openDialog,
      analytics: ({ id }) => emitInboxTelemetry('chat.command.execute', { ticketId: ticket?.id ?? null, actionId: id }),
    }),
    [
      ticket,
      onGenerateProposal,
      handleAssign,
      onRegisterResult,
      handleCallResultSubmit,
      handleScheduleFollowUp,
      onAttachFile,
      onEditContact,
      handleCall,
      handleSendSms,
      commandCapabilities,
      rawPhone,
      isRegisteringResult,
      openDialog,
    ],
  );

  if (!ticket) {
    return (
      <div className="flex h-24 items-center justify-center rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet text-sm text-foreground-muted shadow-inner shadow-slate-950/40 backdrop-blur">
        Selecione um ticket para visualizar a conversa.
      </div>
    );
  }

  const summaryContent = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-base font-semibold leading-tight text-foreground">{title}</h3>
            {shortId ? (
              <span className="inline-flex items-center rounded-md bg-surface-overlay-quiet px-2 py-0.5 text-[11px] font-medium uppercase text-foreground-muted">
                #{shortId}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={statusInfo.tone} className="px-2.5 py-1 text-[11px]">
              {statusInfo.label}
            </Chip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Chip tone={expirationInfo.tone} className="cursor-default select-none px-2.5 py-1 text-[11px]">
                  {expirationInfo.label}
                </Chip>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start">
                <p className="max-w-[220px] text-xs text-foreground-muted">{slaTooltip}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start">
          <TypingIndicator agents={typingAgents} />
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground hover:bg-surface-overlay-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-overlay-glass-border"
              aria-label={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}
            >
              <ChevronDown
                className={cn('size-4 transition-transform duration-200', isExpanded ? 'rotate-180' : 'rotate-0')}
                aria-hidden
              />
            </button>
          </CollapsibleTrigger>
        </div>
      </div>
      <CommandBar context={commandContext} />
    </div>
  );

  const contactContent = (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoRow label="Telefone">
          <span className="flex items-center gap-2 text-foreground">
            <Phone className="size-4 text-foreground-muted" aria-hidden />
            <span>{phoneDisplay ?? '—'}</span>
          </span>
        </InfoRow>
        <InfoRow label="E-mail">{email ?? '—'}</InfoRow>
        <InfoRow label="Documento">
          <button
            type="button"
            className="inline-flex min-h-[32px] items-center gap-2 rounded-lg border border-surface-overlay-glass-border px-3 text-xs text-foreground-muted hover:bg-surface-overlay-quiet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-overlay-glass-border"
            onClick={handleCopyDocument}
          >
            <IdCard className="size-4" aria-hidden />
            <span>{document ?? '—'}</span>
          </button>
        </InfoRow>
        <InfoRow label="ID do contato">{ticket?.contact?.id ?? '—'}</InfoRow>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
        <span>Precisa agir?</span>
        <SectionLink actionId="generate-proposal" label="Gerar proposta" onActivate={handleCommandLink} />
        <SectionLink actionId="assign-owner" label="Atribuir ticket" onActivate={handleCommandLink} />
        <SectionLink actionId="phone-call" label="Abrir ações de telefone" onActivate={handleCommandLink} />
      </div>
    </div>
  );

  const opportunityContent = (
    <div className="grid gap-3 sm:grid-cols-2">
      <InfoRow label="Potencial">{potential}</InfoRow>
      <InfoRow label="Probabilidade">{probability}</InfoRow>
      <InfoRow label="Etapa atual">{stage}</InfoRow>
      <InfoRow label="Próximo SLA">{remainingMinutes ? `${remainingMinutes} min` : '—'}</InfoRow>
      <div className="sm:col-span-2">
        <SectionLink actionId="register-result" label="Registrar resultado" onActivate={handleCommandLink} />
      </div>
    </div>
  );

  const timelineContent = (
    <div className="flex flex-col gap-3">
      <InfoRow label="Último cliente">{lastInboundLabel ?? '—'}</InfoRow>
      <InfoRow label="Último agente">{lastOutboundLabel ?? '—'}</InfoRow>
      <InfoRow label="Situação">
        <Chip tone={directionMeta.tone}>{directionMeta.label}</Chip>
      </InfoRow>
      <InfoRow label="Pendências">{unreadInboundCount > 0 ? `${unreadInboundCount} mensagens` : 'Nenhuma'}</InfoRow>
    </div>
  );

  const attachmentsContent = attachments.length
    ? (
        <ul className="space-y-2 text-sm text-foreground">
          {attachments.map((item, index) => {
            const key = item?.id ?? item?.name ?? item?.fileName ?? item?.url ?? index;
            const label = item?.name ?? item?.fileName ?? item?.filename ?? item?.originalName ?? 'Anexo';
            return (
              <li
                key={key}
                className="flex items-center justify-between gap-3 rounded-xl border border-surface-overlay-glass-border bg-surface-overlay-quiet px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate [overflow-wrap:anywhere]">{label}</span>
                <span className="text-xs text-foreground-muted">{item?.size ? `${Math.round(item.size / 1024)} KB` : ''}</span>
              </li>
            );
          })}
        </ul>
      )
    : (
        <p className="text-sm text-foreground-muted">Nenhum anexo disponível para este ticket.</p>
      );

  const detailsContent = (
    <>
      <CollapsibleContent
        className={cn(
          'data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden'
        )}
      >
        <div className="max-h-[calc(100vh-20rem)] overflow-y-auto overscroll-contain pr-1 sm:pr-2 [scrollbar-gutter:stable]">
          <div className="mt-3 flex flex-col gap-4 border-t border-surface-overlay-glass-border pt-4">
            <ConversationCardBody>
              <ConversationCardBody.Left>
                <QuickComposer
                  ticket={ticket}
                  onSendTemplate={onSendTemplate}
                  onCreateNextStep={onCreateNextStep}
                />
              </ConversationCardBody.Left>
              <ConversationCardBody.Right>
                <p className="text-xs text-foreground-muted">{subtitle}</p>
                {contactContent}
                <div className="rounded-2xl border border-dashed border-surface-overlay-glass-border bg-surface-overlay-quiet/30 p-3 text-xs text-foreground-muted">
                  <p className="font-medium text-foreground">Atalhos disponíveis</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <SectionLink actionId="quick-followup" label="Agendar follow-up (/t)" onActivate={handleCommandLink} />
                    <SectionLink actionId="attach-file" label="Anexar arquivo" onActivate={handleCommandLink} />
                    <SectionLink actionId="edit-contact" label="Editar contato" onActivate={handleCommandLink} />
                  </div>
                </div>
              </ConversationCardBody.Right>
            </ConversationCardBody>

            <div className="rounded-3xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/70 p-4">
              <h3 className="text-sm font-semibold text-foreground">Oportunidade</h3>
              <div className="mt-3">{opportunityContent}</div>
            </div>

            <div className="rounded-3xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/70 p-4">
              <h3 className="text-sm font-semibold text-foreground">Timeline resumida</h3>
              <div className="mt-3">{timelineContent}</div>
              <SectionLink
                actionId="register-result"
                label="Registrar novo resultado"
                onActivate={handleCommandLink}
              />
            </div>

            <div className="rounded-3xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/70 p-4">
              <h3 className="text-sm font-semibold text-foreground">Anexos recentes</h3>
              <div className="mt-3">{attachmentsContent}</div>
              <SectionLink actionId="attach-file" label="Adicionar novo anexo" onActivate={handleCommandLink} />
            </div>
          </div>
        </div>
      </CollapsibleContent>
      <LossReasonDialog
        open={activeDialog === 'register-result'}
        onOpenChange={(open) => {
          if (open) {
            setActiveDialog('register-result');
          } else {
            closeDialog();
          }
        }}
        options={LOSS_REASONS}
        onConfirm={handleLossReasonSubmit}
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
    </>
  );

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className={cn(
        'relative z-10 flex flex-col rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-strong px-4 py-3 shadow-[0_6px_24px_rgba(15,23,42,0.3)] backdrop-blur transition-opacity duration-150',
        isFadeIn ? 'opacity-100' : 'opacity-0',
      )}
    >
      {renderSummary ? renderSummary(summaryContent, { isExpanded, onOpenChange: setIsExpanded }) : summaryContent}
      {renderDetails ? renderDetails(detailsContent, { isExpanded, onOpenChange: setIsExpanded }) : detailsContent}
    </Collapsible>
  );
};

export default ConversationHeader;
