import { useCallback, useMemo, useRef } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { Clock3, MessageCircleMore, PanelRightOpen, Sparkles } from 'lucide-react';
import { cn, buildInitials } from '@/lib/utils.js';
import { CommandBar } from './CommandBar.jsx';
import { AiModeControlMenu } from './AiModeMenu.jsx';
import { ACTIONS_BY_ID } from '@/features/chat/actions/inventory';
import InstanceBadge from '../Shared/InstanceBadge.jsx';

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

const normalizeTicketString = (value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
};

const resolveTicketMetadataField = (ticket, key) => {
  if (!ticket || typeof ticket !== 'object') {
    return null;
  }
  const metadata = ticket.metadata;
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }
  return normalizeTicketString(metadata[key]);
};

const resolveTicketSourceInstance = (ticket) => {
  const metadataSource = resolveTicketMetadataField(ticket, 'sourceInstance');
  if (metadataSource) {
    return metadataSource;
  }
  const metadataInstance = resolveTicketMetadataField(ticket, 'instanceId');
  if (metadataInstance) {
    return metadataInstance;
  }
  return normalizeTicketString(ticket?.instanceId);
};

const resolveTicketCampaignId = (ticket) => {
  const metadataCampaignId = resolveTicketMetadataField(ticket, 'campaignId');
  if (metadataCampaignId) {
    return metadataCampaignId;
  }
  return normalizeTicketString(ticket?.lead?.campaignId);
};

const resolveTicketCampaignName = (ticket) => {
  const metadataCampaignName = resolveTicketMetadataField(ticket, 'campaignName');
  if (metadataCampaignName) {
    return metadataCampaignName;
  }
  const leadCampaignName = normalizeTicketString(ticket?.lead?.campaignName);
  if (leadCampaignName) {
    return leadCampaignName;
  }
  return normalizeTicketString(ticket?.lead?.campaign?.name);
};

const resolveTicketProductType = (ticket) => {
  return resolveTicketMetadataField(ticket, 'productType');
};

const resolveTicketStrategy = (ticket) => {
  return resolveTicketMetadataField(ticket, 'strategy');
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
  ticket,
  aiMode = 'assist',
  aiConfidence = null,
  aiModeChangeDisabled = false,
  onAiModeChange,
  onTakeOver,
  onGiveBackToAi,
  contactPhone,
  instanceId,
  instancePresentation,
}) => {
  const resolvedInstance = useMemo(() => {
    const metadataInstance = resolveTicketSourceInstance(ticket);
    const fallback = {
      label: metadataInstance ?? 'Instância desconhecida',
      color: '#94A3B8',
      number: metadataInstance ?? null,
      phone: metadataInstance ?? null,
    };

    if (!instancePresentation) {
      return fallback;
    }

    return {
      label: instancePresentation.label ?? fallback.label,
      color: instancePresentation.color ?? fallback.color,
      number: instancePresentation.number ?? instancePresentation.phone ?? metadataInstance ?? null,
      phone: instancePresentation.phone ?? metadataInstance ?? null,
    };
  }, [instancePresentation, ticket]);

  const showContactPhone = useMemo(() => {
    if (!contactPhone) return false;
    if (!resolvedInstance.number) return true;
    return contactPhone !== resolvedInstance.number;
  }, [contactPhone, resolvedInstance.number]);

  const enrichmentChips = useMemo(() => {
    const campaignId = resolveTicketCampaignId(ticket);
    const campaignName = resolveTicketCampaignName(ticket);
    const productType = resolveTicketProductType(ticket);
    const strategy = resolveTicketStrategy(ticket);

    return [
      { id: 'instance', label: `Instância · ${resolvedInstance.label ?? 'Instância desconhecida'}` },
      { id: 'campaign', label: `Campanha · ${campaignName ?? campaignId ?? 'Não informada'}` },
      { id: 'productType', label: `Convênio · ${productType ?? 'Não informado'}` },
      { id: 'strategy', label: `Estratégia · ${strategy ?? 'Não informada'}` },
    ];
  }, [resolvedInstance.label, ticket]);

  const handleDetails = (intent = {}) => {
    onRequestDetails?.(intent);
  };

  const hasNextStep = typeof nextStepValue === 'string' && nextStepValue.trim().length > 0;
  const askAiAction = ACTIONS_BY_ID['ask-ai-help'];
  const aiHelpButtonRef = useRef(null);

  const aiHelpState = useMemo(() => askAiAction?.getState?.(commandContext) ?? {}, [askAiAction, commandContext]);
  const aiHelpLoading = Boolean(aiHelpState.loading);
  const aiHelpDisabled = useMemo(() => {
    if (!askAiAction) return true;
    return !(askAiAction.canExecute?.(commandContext) ?? true);
  }, [askAiAction, commandContext]);

  const handleAskAiHelp = useCallback(() => {
    if (!askAiAction) {
      return;
    }
    const contextWithFocus = { ...commandContext, returnFocus: aiHelpButtonRef.current ?? null };
    askAiAction.run(contextWithFocus);
    askAiAction.analytics?.(contextWithFocus);
  }, [askAiAction, commandContext]);

  return (
    <div data-testid="conversation-header-summary" className="py-1">
      <div
        className={cn(
          'grid gap-3 items-start',
          'md:grid-cols-[minmax(0,1fr)_auto]',
          'lg:grid-cols-[minmax(0,1fr)_auto_auto]',
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-11 w-11">
            <AvatarFallback>{buildInitials(name, 'CT')}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold leading-tight text-foreground">{title}</h3>
              {shortId ? (
                <span className="inline-flex items-center rounded-md bg-surface-overlay-quiet px-2 py-0.5 text-[11px] font-medium uppercase text-foreground-muted">
                  #{shortId}
                </span>
              ) : null}
              <InstanceBadge instanceId={instanceId} />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-muted">
              <span className="truncate" title={resolvedInstance.number ?? undefined}>
                {resolvedInstance.number ?? 'Número não informado'}
              </span>
              <span>Etapa: {stageKey ?? 'Não definida'}</span>
              {showContactPhone ? (
                <span data-testid="ticket-contact-phone">{contactPhone}</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {enrichmentChips.map((chip) => (
                <Indicator key={chip.id} tone="neutral" label={chip.label} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-self-end lg:justify-self-start">
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
        <div className="flex items-center gap-2 justify-self-end">
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
        <div
          className={cn(
            'flex flex-wrap items-center gap-2',
            'md:col-span-2 md:justify-self-end',
            'lg:col-span-3 lg:justify-self-end lg:flex-nowrap',
          )}
        >
          <PrimaryActionButton
            action={primaryAction}
            jroState={jro?.state}
            onExecute={onPrimaryAction}
            disabled={!primaryAction}
          />
          <AiModeControlMenu
            ticket={ticket}
            aiMode={aiMode}
            aiConfidence={aiConfidence}
            onAiModeChange={onAiModeChange}
            onTakeOver={onTakeOver}
            onGiveBackToAi={onGiveBackToAi}
            aiModeChangeDisabled={aiModeChangeDisabled}
            className="h-9"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                ref={aiHelpButtonRef}
                type="button"
                variant="outline"
                size="sm"
                className="inline-flex items-center gap-2 rounded-full border-surface-overlay-glass-border bg-surface-overlay-quiet px-3 text-xs font-semibold text-foreground transition hover:bg-surface-overlay-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-shell)]"
                disabled={aiHelpDisabled || aiHelpLoading}
                onClick={handleAskAiHelp}
                aria-disabled={aiHelpDisabled || aiHelpLoading}
                aria-label="Solicitar sugestão da IA"
              >
                {aiHelpLoading ? (
                  <span className="size-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                )}
                <span className="hidden sm:inline">Sugestão IA</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Sugestão da IA {askAiAction?.shortcutDisplay ? `(${askAiAction.shortcutDisplay})` : ''}
            </TooltipContent>
          </Tooltip>
          <CommandBar context={commandContext} className="w-auto shrink-0 flex-nowrap gap-1 border-none bg-transparent p-0 shadow-none" />
          <div className="ml-auto flex w-full justify-end lg:w-auto">
            <TypingIndicator agents={typingAgents} />
          </div>
        </div>
      </div>
    </div>
  );
};

export { PrimaryActionBanner as default, PrimaryActionButton, TypingIndicator, JroIndicator, Indicator };
