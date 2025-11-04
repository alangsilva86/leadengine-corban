import { Avatar, AvatarFallback } from '@/components/ui/avatar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { Clock3, MessageCircleMore, PanelRightOpen } from 'lucide-react';
import { cn, buildInitials } from '@/lib/utils.js';
import { CommandBar } from './CommandBar.jsx';

const INDICATOR_TONES = {
  info: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted',
  warning: 'border-warning-soft-border bg-warning-soft text-warning-strong',
  danger: 'border-status-error-border bg-status-error-surface text-status-error-foreground',
  neutral: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted',
  success: 'border-success-soft-border bg-success-soft text-success-strong',
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

const Indicator = ({ icon: Icon, tone = 'neutral', label, description, className }) => {
  if (!label) return null;
  const resolvedToneClass = INDICATOR_TONES[tone] ?? INDICATOR_TONES.neutral;
  return (
    <span
      aria-label={description ?? label}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
        resolvedToneClass,
        className,
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
      <span className="truncate">{label}</span>
    </span>
  );
};

const TypingIndicator = ({ agents = [] }) => {
  if (!agents.length) return null;
  const label = agents[0]?.userName ?? 'Agente';
  return (
    <div className="inline-flex items-center">
      <div className="hidden xl:inline-flex min-h-[28px] items-center gap-2 rounded-full border border-surface-overlay-glass-border bg-surface-overlay-quiet px-3 text-[12px] text-foreground-muted">
        <div className="flex -space-x-2">
          {agents.slice(0, 3).map((agent) => (
            <Avatar key={agent.userId} className="h-6 w-6 border border-surface-overlay-glass-border">
              <AvatarFallback>{buildInitials(agent.userName, 'AG')}</AvatarFallback>
            </Avatar>
          ))}
        </div>
        <span>{label} digitando…</span>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            aria-label={`${label} digitando…`}
            className="inline-flex h-9 w-9 cursor-default items-center justify-center rounded-full border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground shadow-none outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-shell)] xl:hidden"
          >
            <MessageCircleMore className="h-4 w-4" aria-hidden />
            <span className="sr-only">{label} digitando…</span>
          </span>
        </TooltipTrigger>
        <TooltipContent sideOffset={8}>{label} digitando…</TooltipContent>
      </Tooltip>
    </div>
  );
};

const SLA_TONE_MAP = {
  neutral: 'neutral',
  yellow: 'warning',
  orange: 'warning',
  overdue: 'danger',
};

const JroIndicator = ({ jro }) => {
  const normalizedProgress = Number.isFinite(jro?.progress)
    ? Math.max(0, Math.min(jro.progress ?? 0, 1))
    : 0;
  const progressPercent = Math.round(normalizedProgress * 100);
  const hasDeadline = Boolean(jro?.deadline);
  const isOverdue = hasDeadline && typeof jro.msRemaining === 'number' && jro.msRemaining < 0;
  const baseTone = JRO_TONE_CLASSES[jro?.state] ?? JRO_TONE_CLASSES.neutral;
  const tone = hasDeadline
    ? baseTone
    : {
        text: 'text-foreground-muted',
        bar: 'bg-surface-overlay-glass-border/60',
        chip: 'bg-surface-overlay-glass/10',
      };
  const timeLabel = hasDeadline ? jro?.remainingLabel : '--:--:--';
  const displayTime = hasDeadline ? `${isOverdue ? '-' : ''}${timeLabel}` : '--:--:--';
  const readableStatus = !hasDeadline
    ? 'SLA indisponível'
    : isOverdue
      ? `SLA atrasado há ${timeLabel}`
      : `Tempo restante ${timeLabel}`;
  const meterValue = hasDeadline ? progressPercent : 0;
  const chipTone = SLA_TONE_MAP[jro?.state] ?? 'neutral';

  return (
    <div className="min-w-[200px] flex-1" role="group" aria-label={`SLA interno. ${readableStatus}`}>
      <Indicator icon={Clock3} tone={chipTone} label={`SLA interno · ${displayTime}`} />
      <div className="mt-2 h-1.5 rounded-full bg-surface-overlay-glass-border/60" aria-hidden="true">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none',
            tone.bar,
            tone.pulse,
          )}
          style={{ width: `${meterValue}%` }}
        />
      </div>
      <meter className="sr-only" min={0} max={100} value={meterValue} aria-label="Progresso do SLA" />
    </div>
  );
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

const AI_MODE_TONES = {
  assist: 'border border-[color:var(--accent-inbox-primary)]/40 bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_18%,transparent)] text-[color:var(--accent-inbox-primary)]',
  auto: 'border border-[color:var(--accent-inbox-primary)]/40 bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_22%,transparent)] text-[color:var(--accent-inbox-primary)]',
  manual: 'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted',
};


const PrimaryActionBanner = ({
  name,
  title,
  shortId,
  statusInfo,
  stageKey,
  stageInfo,
  originInfo,
  typingAgents,
  primaryAction,
  onPrimaryAction,
  jro,
  commandContext,
  detailsOpen = false,
  onRequestDetails,
  nextStepValue,
}) => {
  const handleDetails = (intent = {}) => {
    onRequestDetails?.(intent);
  };

  const hasNextStep = typeof nextStepValue === 'string' && nextStepValue.trim().length > 0;

  return (
    <div
      data-testid="conversation-header-summary"
      className="rounded-2xl border border-surface-overlay-glass-border/60 bg-[color:color-mix(in_srgb,var(--surface-overlay-inbox-quiet)_96%,transparent)]/95 p-4 shadow-[0_16px_32px_-28px_rgba(2,6,23,0.75)]"
    >
      <div className="grid gap-3 lg:grid-cols-12 lg:items-center">
        <div className="flex min-w-0 items-center gap-3 lg:col-span-4">
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
            </div>
            <p className="mt-1 truncate text-xs text-foreground-muted">
              {stageKey ? `Etapa atual · ${stageKey}` : 'Sem etapa definida'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:col-span-5 lg:justify-end">
          <Indicator
            icon={statusInfo?.icon}
            tone={statusInfo?.tone}
            label={statusInfo?.label}
            description={statusInfo ? `Status: ${statusInfo.label}` : undefined}
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
              tone="neutral"
              className={cn('text-foreground', originInfo.className)}
              label={originInfo.label}
              description={`Origem: ${originInfo.label}`}
            />
          ) : null}
          {hasNextStep ? (
            <Indicator icon={Clock3} tone="info" label={`Follow-up · ${nextStepValue}`} />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:col-span-3 lg:justify-end">
          <JroIndicator jro={jro} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border-surface-overlay-glass-border bg-surface-overlay-quiet px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-overlay-strong',
              detailsOpen && 'bg-surface-overlay-strong text-foreground',
            )}
            aria-label={detailsOpen ? 'Ocultar detalhes do contato' : 'Mostrar detalhes do contato'}
            onClick={() => handleDetails({})}
          >
            <PanelRightOpen className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Detalhes</span>
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryActionButton
            action={primaryAction}
            jroState={jro?.state}
            onExecute={onPrimaryAction}
            disabled={!primaryAction}
          />
          <CommandBar context={commandContext} className="w-auto shrink-0 flex-nowrap gap-1 border-none bg-transparent p-0 shadow-none" />
        </div>
        <TypingIndicator agents={typingAgents} />
      </div>
    </div>
  );
};

export { PrimaryActionBanner as default, PrimaryActionButton, TypingIndicator, JroIndicator, Indicator };
