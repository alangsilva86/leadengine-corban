import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useId, useImperativeHandle } from 'react';
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
import { cn, formatPhoneNumber, buildInitials } from '@/lib/utils.js';
import { useClipboard } from '@/hooks/use-clipboard.js';
import { toast } from 'sonner';
import {
  Archive,
  BadgeCheck,
  BatteryCharging,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Copy as CopyIcon,
  AlertTriangle,
  Edit3,
  FileCheck2,
  FileSignature,
  FileText,
  HelpCircle,
  Hourglass,
  Link2,
  Mail,
  MessageCircle,
  Phone,
  RefreshCcw,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import emitInboxTelemetry from '../../utils/telemetry.js';
import { formatDateTime } from '../../utils/datetime.js';
import QuickComposer from './QuickComposer.jsx';
import { usePhoneActions } from '../../hooks/usePhoneActions.js';
import CallResultDialog from './CallResultDialog.jsx';
import OutcomeDialog from './OutcomeDialog.jsx';
import { CommandBar } from './CommandBar.jsx';
import useTicketJro from '../../hooks/useTicketJro.js';
import { formatCurrencyField, formatTermField } from '../../utils/deal-fields.js';

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

const NextStepEditor = forwardRef(({ value, onSave }, ref) => {
  const { draft, status, handleChange } = useInlineEditor(value ?? '', onSave, 700);
  const textareaRef = useRef(null);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        const node = textareaRef.current;
        if (!node || typeof node.focus !== 'function') {
          return false;
        }
        node.focus();
        if (typeof node.setSelectionRange === 'function') {
          const length = node.value?.length ?? 0;
          node.setSelectionRange(length, length);
        }
        return true;
      },
    }),
    []
  );

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
        ref={textareaRef}
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
});

NextStepEditor.displayName = 'NextStepEditor';

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

const STAGE_PRESENTATION = {
  NOVO: { icon: Sparkles, tone: 'info' },
  CONECTADO: { icon: Link2, tone: 'info' },
  QUALIFICACAO: { icon: ClipboardList, tone: 'info' },
  PROPOSTA: { icon: FileText, tone: 'info' },
  DOCUMENTACAO: { icon: FileSignature, tone: 'info' },
  DOCUMENTOS_AVERBACAO: { icon: FileCheck2, tone: 'info' },
  AGUARDANDO: { icon: Hourglass, tone: 'warning' },
  AGUARDANDO_CLIENTE: { icon: Clock3, tone: 'warning' },
  LIQUIDACAO: { icon: CircleDollarSign, tone: 'success' },
  APROVADO_LIQUIDACAO: { icon: BadgeCheck, tone: 'success' },
  RECICLAR: { icon: RefreshCcw, tone: 'neutral' },
  DESCONHECIDO: { icon: HelpCircle, tone: 'neutral' },
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

const resolvePrimaryAction = ({ stageKey, hasWhatsApp, needsContactValidation = false }) => {
  const preset = PRIMARY_ACTION_MAP[stageKey] ?? PRIMARY_ACTION_MAP[`${stageKey}_`];
  if (!preset) {
    return null;
  }

  if (preset.whatsapp && hasWhatsApp) {
    return preset.whatsapp;
  }

  if (preset.validateContact && needsContactValidation) {
    return preset.validateContact;
  }

  return preset.default ?? preset.fallback ?? null;
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
  const normalizedProgress = Number.isFinite(jro?.progress)
    ? Math.max(0, Math.min(jro.progress ?? 0, 1))
    : 0;
  const progressPercent = Math.round(normalizedProgress * 100);
  const hasDeadline = Boolean(jro?.deadline);
  const isOverdue = hasDeadline && typeof jro.msRemaining === 'number' && jro.msRemaining < 0;
  const baseTone = JRO_TONE_CLASSES[jro.state] ?? JRO_TONE_CLASSES.neutral;
  const tone = hasDeadline
    ? baseTone
    : {
        text: 'text-foreground-muted',
        bar: 'bg-surface-overlay-glass-border/60',
        chip: 'bg-surface-overlay-glass/10',
      };
  const timeLabel = hasDeadline ? jro.remainingLabel : '--:--:--';
  const displayTime = hasDeadline ? `${isOverdue ? '-' : ''}${timeLabel}` : '--:--:--';
  const readableStatus = !hasDeadline
    ? 'SLA indisponível'
    : isOverdue
      ? `SLA atrasado há ${timeLabel}`
      : `Tempo restante ${timeLabel}`;
  const meterValue = hasDeadline ? progressPercent : 0;
  const ariaLabel = `SLA interno. ${readableStatus}`;

  return (
    <section
      role="group"
      aria-label={ariaLabel}
      title={readableStatus}
      className="rounded-lg bg-surface-overlay-glass/15 px-3 py-2 backdrop-blur-sm"
    >
      <div className="h-[2px] w-full rounded bg-white/10" aria-hidden="true">
        <div
          className={cn(
            'h-full rounded transition-[width] duration-500 ease-out motion-reduce:transition-none',
            tone.bar,
            tone.pulse
          )}
          style={{ width: `${meterValue}%` }}
        />
      </div>
      <meter className="sr-only" min={0} max={100} value={meterValue} aria-label="Progresso do SLA" />
      <div className="mt-2 flex items-center justify-between gap-3">
        <div
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide',
            tone.text,
            tone.chip
          )}
        >
          <BatteryCharging className="h-3.5 w-3.5" aria-hidden />
          <span>SLA interno</span>
        </div>
        <time
          className={cn('text-sm font-semibold tabular-nums', tone.text)}
          aria-live={hasDeadline ? 'polite' : 'off'}
        >
          {displayTime}
        </time>
      </div>
    </section>
  );
};

const Indicator = ({
  icon: Icon,
  tone = 'neutral',
  label,
  description,
  className,
  iconClassName,
}) => {
  if (!Icon) return null;

  const resolvedToneClass = tone ? INDICATOR_TONES[tone] ?? INDICATOR_TONES.neutral : null;
  const accessibleLabel = description ?? label;
  const content = (
    <span
      role="img"
      aria-label={accessibleLabel}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent bg-surface-overlay-quiet text-sm shadow-sm transition-colors',
        resolvedToneClass,
        className
      )}
    >
      <Icon className={cn('h-4 w-4', iconClassName)} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>
        <span className="text-xs font-medium text-foreground">{accessibleLabel}</span>
      </TooltipContent>
    </Tooltip>
  );
};

const getStageInfo = (stageKey) => {
  if (!stageKey) {
    return null;
  }

  const normalized = normalizeStage(stageKey);
  const label = formatStageLabel(normalized);
  const presentation = STAGE_PRESENTATION[normalized] ?? STAGE_PRESENTATION.DESCONHECIDO;

  return {
    label,
    tone: presentation.tone ?? 'neutral',
    icon: presentation.icon ?? HelpCircle,
  };
};

const useStageInfo = (ticket) => {
  const stageKey = getTicketStage(ticket);
  const primaryAction = useMemo(() => {
    const hasPhone = Boolean(
      ticket?.contact?.phone ??
        (Array.isArray(ticket?.contact?.phones) && ticket.contact.phones.length > 0) ??
        ticket?.metadata?.contactPhone
    );
    const whatsappChannel =
      ticket?.metadata?.channels?.whatsapp ??
      ticket?.channels?.whatsapp ??
      null;
    const whatsappIsInvalid =
      (typeof whatsappChannel?.valid === 'boolean' && whatsappChannel.valid === false) ||
      (typeof whatsappChannel?.isValid === 'boolean' && whatsappChannel.isValid === false) ||
      whatsappChannel === false ||
      whatsappChannel?.status === 'invalid';

    const leadHasWhatsApp = hasPhone && !whatsappIsInvalid;
    const needsContactValidation = hasPhone && whatsappIsInvalid;

    return resolvePrimaryAction({
      stageKey,
      hasWhatsApp: leadHasWhatsApp,
      needsContactValidation,
    });
  }, [
    stageKey,
    ticket?.channels?.whatsapp,
    ticket?.channels?.whatsapp?.isValid,
    ticket?.channels?.whatsapp?.status,
    ticket?.channels?.whatsapp?.valid,
    ticket?.contact?.phone,
    ticket?.contact?.phones,
    ticket?.metadata?.channels?.whatsapp,
    ticket?.metadata?.channels?.whatsapp?.isValid,
    ticket?.metadata?.channels?.whatsapp?.status,
    ticket?.metadata?.channels?.whatsapp?.valid,
    ticket?.metadata?.contactPhone,
  ]);

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
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeDialog, setActiveDialog] = useState(null);
  const [outcomeMode, setOutcomeMode] = useState('success');
  const nextStepEditorRef = useRef(null);
  const collapseFrameRef = useRef(null);

  const clearCollapseFrame = useCallback(() => {
    if (collapseFrameRef.current !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(collapseFrameRef.current);
    }
    collapseFrameRef.current = null;
  }, []);

  const focusNextStepEditor = useCallback(() => {
    const target = nextStepEditorRef.current;
    if (!target || typeof target.focus !== 'function') {
      return false;
    }
    return Boolean(target.focus());
  }, []);

  const revealNextStepEditor = useCallback(() => {
    const focusOrFallback = () => {
      const focused = focusNextStepEditor();
      if (!focused) {
        onFocusComposer?.();
      }
    };

    clearCollapseFrame();
    setIsExpanded(true);

    if (isExpanded) {
      focusOrFallback();
      return;
    }

    if (typeof window !== 'undefined') {
      const schedule = window.requestAnimationFrame ?? ((cb) => window.setTimeout(cb, 16));
      schedule(() => focusOrFallback());
    } else {
      focusOrFallback();
    }
  }, [clearCollapseFrame, focusNextStepEditor, isExpanded, onFocusComposer]);
  const dialogReturnFocusRef = useRef(null);
  const jro = useTicketJro(ticket);
  const { stageKey, primaryAction } = useStageInfo(ticket);

  useEffect(() => {
    if (!ticket) return undefined;

    setIsExpanded(false);

    if (typeof requestAnimationFrame === 'function') {
      const frame = requestAnimationFrame(() => {
        setIsExpanded(false);
        collapseFrameRef.current = null;
      });
      collapseFrameRef.current = frame;
      return () => {
        if (typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(frame);
        }
        if (collapseFrameRef.current === frame) {
          collapseFrameRef.current = null;
        }
      };
    }

    collapseFrameRef.current = null;
    return undefined;
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
  const originInfo = useMemo(() => (origin ? resolveChannelInfo(origin) : null), [origin]);
  const stageInfo = useMemo(() => getStageInfo(stageKey), [stageKey]);

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
  ]);

  const summaryRef = useRef(null);
  const [summaryHeight, setSummaryHeight] = useState(null);

  useLayoutEffect(() => {
    const node = summaryRef.current;
    if (!node) {
      return undefined;
    }

    const updateHeight = () => {
      const height = node.getBoundingClientRect().height;
      setSummaryHeight((current) => (Math.abs((current ?? 0) - height) > 0.5 ? height : current ?? height));
    };

    updateHeight();

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(() => updateHeight());
      observer.observe(node);
      return () => observer.disconnect();
    }

    if (typeof window === 'undefined') {
      return undefined;
    }

    window.addEventListener('resize', updateHeight, { passive: true });
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const node = summaryRef.current;
    if (!node) return;
    const timeout = window.setTimeout(() => {
      const height = node.getBoundingClientRect().height;
      setSummaryHeight((current) => (Math.abs((current ?? 0) - height) > 0.5 ? height : current ?? height));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [isExpanded, ticket?.id, jro.progress, jro.state]);

  const summaryContent = (
    <div
      ref={summaryRef}
      data-testid="conversation-header-summary"
      className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-start lg:justify-between"
    >
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
            <Indicator
              icon={statusInfo.icon}
              tone={statusInfo.tone}
              label={statusInfo.label}
              description={`Status: ${statusInfo.label}`}
            />
            {stageInfo ? (
              <Indicator
                icon={stageInfo.icon}
                tone={stageInfo.tone}
                label={stageInfo.label}
                description={`Etapa: ${stageInfo.label}`}
              />
            ) : null}
            {originInfo ? (
              <Indicator
                icon={originInfo.icon}
                tone={null}
                className={cn(
                  'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground',
                  originInfo.className
                )}
                label={originInfo.label}
                description={`Origem: ${originInfo.label}`}
              />
            ) : null}
          </div>
          <div className="mt-2">
            <JroIndicator jro={jro} />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
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
    <div className="flex w-full flex-col gap-4 rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/70 p-4">
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
      <NextStepEditor ref={nextStepEditorRef} value={nextStepValue} onSave={onNextStepSave} />
    </div>
  );

  const shouldShowDealPanel = DEAL_STAGE_KEYS.has(stageKey);

  const dealFields = useMemo(() => {
    if (!shouldShowDealPanel) {
      return {};
    }

    const leadDeal =
      ticket?.lead?.customFields?.deal && typeof ticket.lead.customFields.deal === 'object'
        ? ticket.lead.customFields.deal
        : null;
    const metadataDeal =
      ticket?.metadata?.deal && typeof ticket.metadata.deal === 'object'
        ? ticket.metadata.deal
        : null;

    return leadDeal ?? metadataDeal ?? {};
  }, [shouldShowDealPanel, ticket?.lead?.customFields?.deal, ticket?.metadata?.deal]);

  const dealContent = shouldShowDealPanel ? (
    <div className="w-full rounded-2xl border border-surface-overlay-glass-border bg-surface-overlay-quiet/70 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Liquidação</h4>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <InlineField
          label="Parcela"
          value={dealFields?.installmentValue ?? ''}
          placeholder="R$ 0,00"
          formatter={formatCurrencyField}
          onSave={onDealFieldSave ? (value) => onDealFieldSave('installmentValue', value) : undefined}
        />
        <InlineField
          label="Líquido"
          value={dealFields?.netValue ?? ''}
          placeholder="R$ 0,00"
          formatter={formatCurrencyField}
          onSave={onDealFieldSave ? (value) => onDealFieldSave('netValue', value) : undefined}
        />
        <InlineField
          label="Prazo"
          value={dealFields?.term ?? ''}
          placeholder="12 meses"
          formatter={formatTermField}
          onSave={onDealFieldSave ? (value) => onDealFieldSave('term', value) : undefined}
        />
        <InlineField
          label="Produto"
          value={dealFields?.product ?? ''}
          placeholder="Produto contratado"
          onSave={onDealFieldSave ? (value) => onDealFieldSave('product', value) : undefined}
        />
        <InlineField
          label="Banco"
          value={dealFields?.bank ?? ''}
          placeholder="Banco parceiro"
          onSave={onDealFieldSave ? (value) => onDealFieldSave('bank', value) : undefined}
        />
      </div>
    </div>
  ) : null;

  const attachments = useMemo(() => {
    const source = ticket?.metadata?.attachments ?? ticket?.attachments ?? null;
    if (Array.isArray(source)) return source.filter(Boolean);
    if (source && typeof source === 'object') return Object.values(source).filter(Boolean);
    return [];
  }, [ticket?.attachments, ticket?.metadata?.attachments]);

  const detailsContent = (
    <div className="flex w-full flex-col gap-4">
      {contactContent}
      <div className="flex w-full flex-col gap-4">
        {dealContent}
        <div className="w-full rounded-2xl border border-dashed border-surface-overlay-glass-border bg-surface-overlay-quiet/60 p-4 text-xs text-foreground-muted">
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

  const detailsStyle = useMemo(() => {
    const style = {};
    if (Number.isFinite(composerHeight) && composerHeight > 0) {
      style['--conversation-header-composer'] = `${composerHeight}px`;
    }
    if (Number.isFinite(summaryHeight) && summaryHeight > 0) {
      style['--conversation-header-summary'] = `${summaryHeight}px`;
    }
    return Object.keys(style).length ? style : undefined;
  }, [composerHeight, summaryHeight]);

  const renderedDetails = (
    <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
      <div
        data-testid="conversation-header-details"
        className="mt-4 max-h-[calc(100vh-var(--conversation-header-composer,18rem)-var(--conversation-header-summary,12rem)-var(--conversation-header-safe-area,3rem))] overflow-y-auto overscroll-contain pr-1 sm:pr-2 [scrollbar-gutter:stable]"
        style={detailsStyle}
      >
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
    </Collapsible>
  );
};

export { ConversationHeader, normalizeStage, resolvePrimaryAction, formatStageLabel, PRIMARY_ACTION_MAP, PrimaryActionButton };
export default ConversationHeader;
