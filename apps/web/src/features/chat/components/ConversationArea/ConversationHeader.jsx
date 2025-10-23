import { useCallback, useEffect, useMemo, useRef, useState, useId } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { cn, formatPhoneNumber, buildInitials } from '@/lib/utils.js';
import { useClipboard } from '@/hooks/use-clipboard.js';
import { toast } from 'sonner';
import { ChevronDown, Phone, Edit3, Copy as CopyIcon, UserCheck, AlertTriangle, MessageCircle, Mail } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import emitInboxTelemetry from '../../utils/telemetry.js';
import { formatDateTime } from '../../utils/datetime.js';
import QuickComposer from './QuickComposer.jsx';
import { usePhoneActions } from '../../hooks/usePhoneActions.js';
import CallResultDialog from './CallResultDialog.jsx';
import LossReasonDialog from './LossReasonDialog.jsx';
import { CommandBar } from './CommandBar.jsx';
import useTicketJro from '../../hooks/useTicketJro.js';

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

const PRIMARY_ACTION_PRESETS = {
  initialContact: {
    whatsapp: { id: 'send-initial-wa', label: 'Enviar 1ª mensagem (WhatsApp)' },
    fallback: { id: 'call-now', label: 'Ligar agora' },
  },
  keepEngagement: {
    whatsapp: { id: 'send-wa', label: 'Enviar mensagem (WhatsApp)' },
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
    bar: 'bg-[color:var(--accent-inbox-primary)]',
    pill: 'bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_16%,transparent)] text-[color:var(--accent-inbox-primary)]',
  },
  yellow: {
    bar: 'bg-amber-400',
    pill: 'bg-amber-100 text-amber-700',
  },
  orange: {
    bar: 'bg-orange-500',
    pill: 'bg-orange-200 text-orange-700',
  },
  overdue: {
    bar: 'bg-red-500 animate-pulse',
    pill: 'bg-red-100 text-red-700 animate-pulse',
  },
};

const PRIMARY_BUTTON_TONE = {
  neutral: 'bg-[color:var(--accent-inbox-primary)] text-white hover:bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_88%,transparent)]',
  yellow: 'bg-amber-500 text-white hover:bg-amber-500/90',
  orange: 'bg-orange-500 text-white hover:bg-orange-500/90',
  overdue: 'bg-red-500 text-white hover:bg-red-500/90 animate-pulse',
};

const CHANNEL_PRESENTATION = {
  WHATSAPP: {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: MessageCircle,
    className:
      'border-[color:var(--color-status-whatsapp-border)] bg-[color:var(--color-status-whatsapp-surface)] text-[color:var(--color-status-whatsapp-foreground)]',
  },
  VOICE: {
    id: 'voice',
    label: 'Telefone',
    icon: Phone,
    className: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground',
  },
  EMAIL: {
    id: 'email',
    label: 'E-mail',
    icon: Mail,
    className: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground',
  },
  DEFAULT: {
    id: 'unknown',
    label: 'Canal não identificado',
    icon: MessageCircle,
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

const parseDateValue = (value) => {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const formatRelativeTime = (value) => {
  const date = parseDateValue(value);
  if (!date) {
    return null;
  }

  try {
    return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
  } catch {
    return null;
  }
};

const getLastInteractionTimestamp = (timeline) => {
  if (!timeline) {
    return null;
  }

  const inboundDate = parseDateValue(timeline.lastInboundAt);
  const outboundDate = parseDateValue(timeline.lastOutboundAt);
  const direction = timeline.lastDirection ?? null;

  if (direction === 'INBOUND' && inboundDate) {
    return inboundDate;
  }

  if (direction === 'OUTBOUND' && outboundDate) {
    return outboundDate;
  }

  if (inboundDate && outboundDate) {
    return inboundDate > outboundDate ? inboundDate : outboundDate;
  }

  return inboundDate ?? outboundDate ?? null;
};

const normalizeStage = (value) => {
  if (!value) return 'DESCONHECIDO';
  const canonical = value
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  return canonical || 'DESCONHECIDO';
};

const getStatusInfo = (status) => {
  const normalized = status ? String(status).toUpperCase() : 'OPEN';
  return {
    label: STATUS_LABELS[normalized] ?? normalized,
    tone: STATUS_TONE[normalized] ?? 'neutral',
  };
};

const useInlineEditor = (initialValue, onSave, debounceMs = 500) => {
  const [draft, setDraft] = useState(initialValue ?? '');
  const [status, setStatus] = useState('idle');
  const timeoutRef = useRef(null);
  const lastSavedRef = useRef(initialValue ?? '');

  useEffect(() => {
    setDraft(initialValue ?? '');
    lastSavedRef.current = initialValue ?? '';
    setStatus('idle');
  }, [initialValue]);

  useEffect(() => () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
  }, []);

  const scheduleSave = useCallback(
    (nextValue) => {
      if (!onSave) {
        return;
      }

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      if ((nextValue ?? '') === (lastSavedRef.current ?? '')) {
        setStatus('idle');
        return;
      }

      setStatus('saving');
      timeoutRef.current = window.setTimeout(async () => {
        try {
          await onSave(nextValue ?? '');
          lastSavedRef.current = nextValue ?? '';
          setStatus('saved');
          window.setTimeout(() => setStatus('idle'), 1500);
        } catch (error) {
          console.error('Failed to save inline field', error);
          setStatus('error');
        }
      }, debounceMs);
    },
    [debounceMs, onSave]
  );

  const handleChange = useCallback(
    (valueOrEvent) => {
      const next = valueOrEvent?.target ? valueOrEvent.target.value : valueOrEvent;
      setDraft(next);
      scheduleSave(next);
    },
    [scheduleSave]
  );

  return { draft, status, handleChange, setDraft };
};

const CopyButton = ({ value, label }) => {
  const { copy } = useClipboard();

  const handleCopy = useCallback(async () => {
    if (!value) {
      toast.info('Não há dados para copiar.');
      return;
    }

    const content = typeof value === 'string' ? value : String(value);
    const success = await copy(content, {
      successMessage: `${label} copiado.`,
      emptyMessage: null,
    });

    if (!success) {
      toast.error('Não foi possível copiar.');
    }
  }, [copy, label, value]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-foreground-muted hover:text-foreground"
          onClick={handleCopy}
        >
          <CopyIcon className="h-4 w-4" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Copiar {label}</TooltipContent>
    </Tooltip>
  );
};

const InlineField = ({
  label,
  value,
  placeholder,
  onSave,
  formatter,
  copyable = false,
  type = 'text',
  disabled = false,
}) => {
  const { draft, status, handleChange } = useInlineEditor(value ?? '', onSave);
  const labelId = useId();
  const formattedValue = formatter ? formatter(draft) : draft;

  return (
    <div className="flex flex-col gap-1" role="group" aria-labelledby={labelId}>
      <div className="flex items-center justify-between gap-2">
        <span id={labelId} className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
          {label}
        </span>
        {status === 'saving' ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-amber-600">salvando…</span>
        ) : null}
        {status === 'saved' ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-600">salvo</span>
        ) : null}
        {status === 'error' ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-destructive">erro</span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={formattedValue}
          onChange={handleChange}
          placeholder={placeholder}
          type={type}
          disabled={disabled || !onSave}
          className={cn(
            'h-9 flex-1 rounded-lg border-surface-overlay-glass-border bg-transparent text-sm',
            status === 'error' && 'border-destructive focus-visible:ring-destructive'
          )}
        />
        {copyable ? <CopyButton value={draft} label={label.toLowerCase()} /> : null}
      </div>
    </div>
  );
};

const NextStepEditor = ({ value, onSave }) => {
  const { draft, status, handleChange } = useInlineEditor(value ?? '', onSave, 700);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Próximo passo</span>
        {status === 'saving' ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-amber-600">salvando…</span>
        ) : null}
        {status === 'saved' ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-600">salvo</span>
        ) : null}
        {status === 'error' ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-destructive">erro</span>
        ) : null}
      </div>
      <Textarea
        value={draft}
        onChange={handleChange}
        placeholder="Descreva o próximo passo combinado"
        className={cn(
          'min-h-[90px] rounded-xl border-surface-overlay-glass-border bg-transparent text-sm',
          status === 'error' && 'border-destructive focus-visible:ring-destructive'
        )}
      />
    </div>
  );
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

const getTicketStage = (ticket) => {
  const stage =
    ticket?.pipelineStep ??
    ticket?.metadata?.pipelineStep ??
    ticket?.stage ??
    null;
  return normalizeStage(stage);
};

const STAGE_LABELS = {
  NOVO: 'Novo',
  CONECTADO: 'Conectado',
  QUALIFICACAO: 'Qualificação',
  PROPOSTA: 'Proposta',
  DOCUMENTACAO: 'Documentação',
  DOCUMENTOS_AVERBACAO: 'Documentos/Averbação',
  AGUARDANDO: 'Aguardando',
  AGUARDANDO_CLIENTE: 'Aguardando Cliente',
  LIQUIDACAO: 'Liquidação',
  APROVADO_LIQUIDACAO: 'Aprovado/Liquidação',
  RECICLAR: 'Reciclar',
  DESCONHECIDO: 'Desconhecido',
};

const formatFallbackStageLabel = (stageKey) =>
  stageKey
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0) + segment.slice(1).toLowerCase())
    .join(' ');

const formatStageLabel = (stageKey) => {
  const normalized = normalizeStage(stageKey);
  if (STAGE_LABELS[normalized]) {
    return STAGE_LABELS[normalized];
  }

  if (normalized === 'DESCONHECIDO') {
    return STAGE_LABELS.DESCONHECIDO;
  }

  return formatFallbackStageLabel(normalized);
};

const resolvePrimaryAction = ({ stageKey, hasWhatsApp }) => {
  const preset = PRIMARY_ACTION_MAP[stageKey] ?? PRIMARY_ACTION_MAP[`${stageKey}_`];
  if (!preset) {
    return null;
  }

  if (preset.whatsapp && hasWhatsApp) {
    return preset.whatsapp;
  }

  return preset.default ?? preset.fallback ?? null;
};

const getAssigneeLabel = (ticket) => {
  const assignee = ticket?.assignee ?? ticket?.assignedTo ?? null;
  if (!assignee) {
    return { label: 'Disponível', tone: 'neutral', assignee: null };
  }

  const name = assignee.name ?? assignee.displayName ?? assignee.email ?? 'Responsável';
  return {
    label: name,
    tone: 'info',
    assignee,
  };
};

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

const JroIndicator = ({ jro }) => {
  const tone = JRO_TONE_CLASSES[jro.state] ?? JRO_TONE_CLASSES.neutral;

  return (
    <div className="flex w-full flex-col gap-1">
      <div className={cn('flex items-center gap-2 text-xs font-medium', tone.pill)}>
        {jro.label}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-overlay-quiet">
        <div
          className={cn('h-full rounded-full transition-[width] duration-500 ease-out', tone.bar)}
          style={{ width: `${Math.round(jro.progress * 100)}%` }}
        />
      </div>
    </div>
  );
};

const Chip = ({ tone = 'neutral', className, children, ...props }) => (
  <span
    className={cn(
      'inline-flex min-h-[28px] items-center justify-center rounded-full px-3 text-[12px] font-medium leading-none tracking-wide',
      CHIP_STYLES[tone] ?? CHIP_STYLES.neutral,
      className
    )}
    {...props}
  >
    {children}
  </span>
);

const useStageInfo = (ticket) => {
  const stageKey = getTicketStage(ticket);
  const primaryAction = useMemo(() => {
    const leadHasWhatsApp = Boolean(
      ticket?.contact?.phone ??
        (Array.isArray(ticket?.contact?.phones) && ticket.contact.phones.length > 0) ??
        ticket?.metadata?.contactPhone
    );
    return resolvePrimaryAction({ stageKey, hasWhatsApp: leadHasWhatsApp });
  }, [stageKey, ticket?.contact?.phone, ticket?.contact?.phones, ticket?.metadata?.contactPhone]);

  return { stageKey, primaryAction };
};

const PrimaryActionButton = ({ action, jroState, onExecute, disabled }) => {
  if (!action) {
    return null;
  }
  const toneClass = PRIMARY_BUTTON_TONE[jroState] ?? PRIMARY_BUTTON_TONE.neutral;

  return (
    <Button
      type="button"
      onClick={onExecute}
      disabled={disabled}
      className={cn(
        'flex shrink-0 items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold shadow-[var(--shadow-md)]',
        toneClass,
      )}
    >
      <span>{action.label}</span>
    </Button>
  );
};

const ContactSummary = ({ ticket }) => {
  const timeline = ticket?.timeline ?? {};
  const lastInbound = timeline.lastInboundAt ? formatDateTime(timeline.lastInboundAt) : '—';
  const lastOutbound = timeline.lastOutboundAt ? formatDateTime(timeline.lastOutboundAt) : '—';
  const lastDirection = timeline.lastDirection ?? null;
  const lastChannel =
    timeline.lastChannel ??
    timeline.lastMessageChannel ??
    (lastDirection === 'INBOUND' ? timeline.lastInboundChannel : timeline.lastOutboundChannel) ??
    timeline.lastInboundChannel ??
    timeline.lastOutboundChannel ??
    timeline.channel ??
    ticket?.channel ??
    ticket?.metadata?.lastChannel ??
    null;

  const channelInfo = useMemo(() => resolveChannelInfo(lastChannel), [lastChannel]);

  const lastInteractionDate = useMemo(
    () => getLastInteractionTimestamp(timeline),
    [timeline.lastDirection, timeline.lastInboundAt, timeline.lastOutboundAt],
  );

  const relativeTime = useMemo(() => formatRelativeTime(lastInteractionDate), [lastInteractionDate]);

  const directionActor = useMemo(() => {
    if (lastDirection === 'INBOUND') {
      return 'Cliente';
    }
    if (lastDirection === 'OUTBOUND') {
      return 'Equipe';
    }
    return null;
  }, [lastDirection]);

  const directionLabel = useMemo(() => {
    switch (lastDirection) {
      case 'INBOUND':
        return 'Cliente aguardando resposta';
      case 'OUTBOUND':
        return 'Aguardando cliente';
      default:
        return 'Sem interações recentes';
    }
  }, [lastDirection]);

  const directionSummary = useMemo(() => {
    if (directionActor && relativeTime) {
      return `${directionActor} • ${relativeTime}`;
    }

    if (directionActor) {
      return directionActor;
    }

    if (relativeTime) {
      return relativeTime;
    }

    return 'Sem interações registradas';
  }, [directionActor, relativeTime]);

  const ChannelIcon = channelInfo.icon;

  return (
    <div className="grid gap-3 text-sm">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Última interação</span>
        <div className="flex flex-wrap items-center gap-2 text-foreground">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium',
              channelInfo.className,
            )}
          >
            <ChannelIcon className="h-3.5 w-3.5" aria-hidden data-testid={`channel-icon-${channelInfo.id}`} />
            {channelInfo.label}
          </span>
          <span className="text-sm text-foreground">{directionLabel}</span>
        </div>
        <span className="text-xs text-foreground-muted">{directionSummary}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground-muted uppercase tracking-wide">Cliente</span>
          <span className="text-sm text-foreground">{lastInbound}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground-muted uppercase tracking-wide">Equipe</span>
          <span className="text-sm text-foreground">{lastOutbound}</span>
        </div>
      </div>
    </div>
  );
};

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
  onContactFieldSave,
  nextStepValue,
  onNextStepSave,
  onFocusComposer,
  currentUser,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeDialog, setActiveDialog] = useState(null);
  const dialogReturnFocusRef = useRef(null);
  const jro = useTicketJro(ticket);
  const { stageKey, primaryAction } = useStageInfo(ticket);

  useEffect(() => {
    if (!ticket) return;
    setIsExpanded(false);
    const frame = requestAnimationFrame(() => setIsExpanded(false));
    return () => cancelAnimationFrame(frame);
  }, [ticket?.id]);

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

  const phoneDisplay = formatPhoneNumber(ticket?.contact?.phone || ticket?.metadata?.contactPhone);
  const rawPhone = ticket?.contact?.phone || ticket?.metadata?.contactPhone || null;
  const document = ticket?.contact?.document ?? null;
  const email = ticket?.contact?.email ?? ticket?.metadata?.contactEmail ?? null;

  const statusInfo = useMemo(() => getStatusInfo(ticket?.status), [ticket?.status]);
  const origin = useMemo(() => getOriginLabel(ticket), [ticket]);
  const stageLabel = useMemo(() => formatStageLabel(stageKey), [stageKey]);

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
    [closeDialog, onRegisterCallResult]
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
    [closeDialog, onRegisterResult]
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
    }),
    [
      handleCall,
      handleSendSms,
      isRegisteringResult,
      onAttachFile,
      onAssign,
      onEditContact,
      onGenerateProposal,
      onRegisterCallResult,
      onRegisterResult,
      onScheduleFollowUp,
      openDialog,
      rawPhone,
      ticket,
    ]
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
      case 'qualify':
        onScheduleFollowUp?.(ticket);
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
  }, [handleCall, onEditContact, onFocusComposer, onGenerateProposal, onScheduleFollowUp, onSendTemplate, openDialog, primaryAction, ticket]);

  const assigneeInfo = useMemo(() => getAssigneeLabel(ticket), [ticket]);
  const handleAssign = useCallback(() => {
    if (!ticket) return;
    onAssign?.(ticket);
  }, [onAssign, ticket]);

  const summaryContent = (
    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-start lg:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarFallback>{buildInitials(name, 'CT')}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold leading-tight text-foreground">{title}</h3>
            {shortId ? (
              <span className="inline-flex items-center rounded-md bg-surface-overlay-quiet px-2 py-0.5 text-[11px] font-medium uppercase text-foreground-muted">
                #{shortId}
              </span>
            ) : null}
            <Chip tone={statusInfo.tone}>{statusInfo.label}</Chip>
            {stageKey ? <Chip tone="neutral">{stageLabel}</Chip> : null}
            {origin ? <Chip tone="neutral">{origin}</Chip> : null}
          </div>
          <div className="mt-2">
            <JroIndicator jro={jro} />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {(() => {
            const assigneeBadge = (
              <Badge
                variant="outline"
                className="flex min-w-0 max-w-[200px] items-center gap-1 border-surface-overlay-glass-border text-xs text-foreground"
              >
                <UserCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">
                  {assigneeInfo.label}
                </span>
              </Badge>
            );

            if (currentUser?.id && (ticket?.assignee?.id ?? ticket?.assignedTo?.id) !== currentUser.id) {
              return (
                <>
                  {assigneeBadge}
                  <Button type="button" size="xs" variant="outline" onClick={handleAssign} className="shrink-0">
                    Assumir
                  </Button>
                </>
              );
            }

            const tooltipLabel = assigneeInfo.assignee
              ? `Responsável: ${assigneeInfo.label}`
              : 'Disponível para atendimento';

            return (
              <Tooltip>
                <TooltipTrigger asChild>{assigneeBadge}</TooltipTrigger>
                <TooltipContent>
                  <span className="text-xs font-medium text-foreground">{tooltipLabel}</span>
                </TooltipContent>
              </Tooltip>
            );
          })()}
        </div>
        <div className="shrink-0">
          <TypingIndicator agents={typingAgents} />
        </div>
        <PrimaryActionButton
          action={primaryAction}
          jroState={jro.state}
          onExecute={handlePrimaryAction}
          disabled={!primaryAction}
        />
        <CommandBar
          context={commandContext}
          className="w-auto shrink-0 flex-nowrap gap-1 border-none bg-transparent p-0 shadow-none"
        />
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground hover:bg-surface-overlay-strong"
            aria-label={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}
          >
            <ChevronDown
              className={cn('h-4 w-4 transition-transform duration-200', isExpanded ? 'rotate-180' : 'rotate-0')}
              aria-hidden
            />
          </Button>
        </CollapsibleTrigger>
      </div>
    </div>
  );

  const contactContent = (
    <div className="flex flex-col gap-4 rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/70 p-4">
      <h4 className="text-sm font-semibold text-foreground">Contato</h4>
      <InlineField
        label="Nome"
        value={ticket?.contact?.name ?? ''}
        placeholder="Nome completo"
        onSave={onContactFieldSave ? (value) => onContactFieldSave('name', value) : undefined}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <InlineField
          label="Telefone"
          value={ticket?.contact?.phone ?? ticket?.metadata?.contactPhone ?? ''}
          placeholder="(00) 00000-0000"
          onSave={onContactFieldSave ? (value) => onContactFieldSave('phone', value) : undefined}
          formatter={formatPhoneNumber}
          copyable
        />
        <InlineField
          label="Documento"
          value={document ?? ''}
          placeholder="000.000.000-00"
          onSave={onContactFieldSave ? (value) => onContactFieldSave('document', value) : undefined}
          copyable
        />
        <InlineField
          label="E-mail"
          value={email ?? ''}
          placeholder="nome@exemplo.com"
          onSave={onContactFieldSave ? (value) => onContactFieldSave('email', value) : undefined}
          type="email"
          copyable
        />
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">Ações de contato</span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleCall}>
              <Phone className="mr-2 h-3.5 w-3.5" aria-hidden />
              Ligar agora
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleSendSms}>
              Enviar SMS
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEditContact?.(ticket?.contact?.id ?? null)}
            >
              <Edit3 className="mr-2 h-3.5 w-3.5" aria-hidden />
              Editar contato
            </Button>
          </div>
        </div>
      </div>
      <ContactSummary ticket={ticket} />
      <NextStepEditor value={nextStepValue} onSave={onNextStepSave} />
    </div>
  );

  const attachments = useMemo(() => {
    const source = ticket?.metadata?.attachments ?? ticket?.attachments ?? null;
    if (Array.isArray(source)) return source.filter(Boolean);
    if (source && typeof source === 'object') return Object.values(source).filter(Boolean);
    return [];
  }, [ticket?.attachments, ticket?.metadata?.attachments]);

  const detailsContent = (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      {contactContent}
      <div className="flex min-h-0 flex-col gap-4">
        <div className="rounded-2xl border border-dashed border-surface-overlay-glass-border bg-surface-overlay-quiet/60 p-4 text-xs text-foreground-muted">
          <div className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            <span className="font-semibold">Anexos recentes</span>
          </div>
          {attachments.length ? (
            <ul className="mt-2 space-y-2">
              {attachments.slice(0, 5).map((item, index) => {
                const key = item?.id ?? item?.name ?? item?.fileName ?? item?.url ?? index;
                const label = item?.name ?? item?.fileName ?? item?.filename ?? item?.originalName ?? 'Anexo';
                return (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-surface-overlay-glass-border bg-surface-overlay-quiet px-3 py-2 text-sm text-foreground"
                  >
                    <span className="min-w-0 flex-1 truncate [overflow-wrap:anywhere]">{label}</span>
                    <span className="text-xs text-foreground-muted">
                      {item?.size ? `${Math.round(item.size / 1024)} KB` : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm">Nenhum anexo disponível para este ticket.</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderedSummary = renderSummary
    ? renderSummary(summaryContent, { isExpanded, onOpenChange: setIsExpanded })
    : summaryContent;

  const renderedDetails = (
    <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
      <div className="mt-4 max-h-[calc(100vh-18rem)] overflow-y-auto overscroll-contain pr-1 sm:pr-2 [scrollbar-gutter:stable]">
        {detailsContent}
      </div>
    </CollapsibleContent>
  );

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className="relative z-10 flex flex-col gap-4 rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-strong px-4 py-3 shadow-[0_6px_24px_rgba(15,23,42,0.3)] backdrop-blur"
    >
      {renderedSummary}
      {renderedDetails}
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
    </Collapsible>
  );
};

export { normalizeStage, resolvePrimaryAction, formatStageLabel, PRIMARY_ACTION_MAP, PrimaryActionButton };
export default ConversationHeader;
