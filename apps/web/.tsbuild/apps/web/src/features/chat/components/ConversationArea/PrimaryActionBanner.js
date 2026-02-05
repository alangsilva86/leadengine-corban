import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useMemo, useRef } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover.jsx';
import { Clock3, MessageCircleMore, PanelRightOpen, Sparkles } from 'lucide-react';
import { cn, buildInitials } from '@/lib/utils.js';
import { CommandBar } from './CommandBar.jsx';
import { AiModeControlMenu } from './AiModeMenu.jsx';
import { ACTIONS_BY_ID } from '@/features/chat/actions/inventory';
import InstanceBadge from '../Shared/InstanceBadge.jsx';
import StageProgress from './StageProgress.jsx';
import { resolveTicketProductType, resolveTicketSourceInstance, } from './utils/ticketMetadata.js';
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
    if (!label)
        return null;
    const resolvedToneClass = INDICATOR_TONES[tone] ?? INDICATOR_TONES.neutral;
    return (_jsxs("span", { "aria-label": description ?? label, className: cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium', resolvedToneClass, className), children: [Icon ? _jsx(Icon, { className: "h-3.5 w-3.5", "aria-hidden": true }) : null, _jsx("span", { className: "truncate", children: label })] }));
};
const TypingIndicator = ({ agents = [] }) => {
    if (!agents.length)
        return null;
    const label = agents[0]?.userName ?? 'Agente';
    return (_jsxs("div", { className: "inline-flex items-center", children: [_jsxs("div", { className: "hidden xl:inline-flex min-h-[28px] items-center gap-2 rounded-full border border-surface-overlay-glass-border bg-surface-overlay-quiet px-3 text-[12px] text-foreground-muted", children: [_jsx("div", { className: "flex -space-x-2", children: agents.slice(0, 3).map((agent) => (_jsx(Avatar, { className: "h-6 w-6 border border-surface-overlay-glass-border", children: _jsx(AvatarFallback, { children: buildInitials(agent.userName, 'AG') }) }, agent.userId))) }), _jsxs("span", { children: [label, " digitando\u2026"] })] }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsxs("span", { tabIndex: 0, "aria-label": `${label} digitando…`, className: "inline-flex h-9 w-9 cursor-default items-center justify-center rounded-full border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground shadow-none outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-shell)] xl:hidden", children: [_jsx(MessageCircleMore, { className: "h-4 w-4", "aria-hidden": true }), _jsxs("span", { className: "sr-only", children: [label, " digitando\u2026"] })] }) }), _jsxs(TooltipContent, { sideOffset: 8, children: [label, " digitando\u2026"] })] })] }));
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
    return (_jsxs("div", { className: "min-w-[160px] flex-1", role: "group", "aria-label": `SLA interno. ${readableStatus}`, children: [_jsx(Indicator, { icon: Clock3, tone: chipTone, label: `SLA interno · ${displayTime}` }), _jsx("div", { className: "mt-1.5 h-1 rounded-full bg-surface-overlay-glass-border/60", "aria-hidden": "true", children: _jsx("div", { className: cn('h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none', tone.bar, tone.pulse), style: { width: `${meterValue}%` } }) }), _jsx("meter", { className: "sr-only", min: 0, max: 100, value: meterValue, "aria-label": "Progresso do SLA" })] }));
};
const PrimaryActionButton = ({ action, jroState, onExecute, disabled }) => {
    if (!action) {
        return null;
    }
    const toneClass = PRIMARY_BUTTON_TONE[jroState] ?? PRIMARY_BUTTON_TONE.neutral;
    const isDisabled = Boolean(disabled || action.disabled);
    return (_jsx(Button, { type: "button", onClick: onExecute, disabled: isDisabled, className: cn('flex shrink-0 items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold shadow-[var(--shadow-md)]', toneClass), children: _jsx("span", { children: action.label }) }));
};
const PrimaryActionBanner = ({ name, title, shortId, statusInfo, stageKey, stageInfo, originInfo, typingAgents, primaryAction, onPrimaryAction, jro, commandContext, detailsOpen = false, onRequestDetails, nextStepValue, ticket, aiMode = 'assist', aiConfidence = null, aiModeChangeDisabled = false, onAiModeChange, onTakeOver, onGiveBackToAi, contactPhone, instanceId, instancePresentation, }) => {
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
    const handleDetails = (intent = {}) => {
        onRequestDetails?.(intent);
    };
    const hasNextStep = typeof nextStepValue === 'string' && nextStepValue.trim().length > 0;
    const askAiAction = ACTIONS_BY_ID['ask-ai-help'];
    const aiHelpButtonRef = useRef(null);
    const aiHelpState = useMemo(() => askAiAction?.getState?.(commandContext) ?? {}, [askAiAction, commandContext]);
    const aiHelpLoading = Boolean(aiHelpState.loading);
    const aiHelpDisabled = useMemo(() => {
        if (!askAiAction)
            return true;
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
    const canShowStageProgress = typeof stageKey === 'string' && stageKey.trim().length > 0;
    return (_jsx("div", { "data-testid": "conversation-header-summary", className: "py-0.5", children: _jsxs("div", { className: cn('grid items-center gap-2', 'md:grid-cols-[minmax(0,1fr)_auto]', 'lg:grid-cols-[minmax(0,1fr)_auto_auto]'), children: [_jsxs("div", { className: "flex min-w-0 items-center gap-2.5", children: [_jsx(Avatar, { className: "h-11 w-11", children: _jsx(AvatarFallback, { children: buildInitials(name, 'CT') }) }), _jsx("div", { className: "min-w-0 space-y-1", children: _jsxs("div", { className: "flex min-w-0 flex-wrap items-center gap-2", children: [_jsx("h3", { className: "truncate text-base font-semibold leading-tight text-foreground", children: title }), shortId ? (_jsxs("span", { className: "inline-flex items-center rounded-md bg-surface-overlay-quiet px-2 py-0.5 text-[11px] font-medium uppercase text-foreground-muted", children: ["#", shortId] })) : null, _jsx(InstanceBadge, { instanceId: instanceId })] }) })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-1.5 md:justify-self-end lg:justify-self-start", children: [_jsx(Indicator, { icon: statusInfo?.icon, tone: statusInfo?.tone, label: statusInfo?.label, description: statusInfo ? `Status: ${statusInfo.label}` : undefined }), stageInfo
                            ? canShowStageProgress
                                ? (_jsxs(Popover, { children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs("button", { type: "button", "aria-haspopup": "dialog", "aria-label": `Etapa: ${stageInfo.label}`, className: cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-shell)]', INDICATOR_TONES[stageInfo.tone] ?? INDICATOR_TONES.neutral), children: [stageInfo.icon ? _jsx(stageInfo.icon, { className: "h-3.5 w-3.5", "aria-hidden": true }) : null, _jsx("span", { className: "truncate", children: stageInfo.label })] }) }), _jsx(PopoverContent, { className: "max-w-sm", align: "end", sideOffset: 12, children: _jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-foreground-muted", children: "Pr\u00F3ximas etapas" }), _jsx(StageProgress, { currentStage: stageKey })] }) })] }))
                                : (_jsx(Indicator, { icon: stageInfo.icon, tone: stageInfo.tone, label: stageInfo.label, description: `Etapa: ${stageInfo.label}` }))
                            : null, originInfo ? (_jsx(Indicator, { icon: originInfo.icon, tone: "neutral", className: cn('text-foreground', originInfo.className), label: originInfo.label, description: `Origem: ${originInfo.label}` })) : null, hasNextStep ? (_jsx(Indicator, { icon: Clock3, tone: "info", label: `Follow-up · ${nextStepValue}` })) : null] }), _jsxs("div", { className: "flex items-center gap-2 justify-self-end", children: [_jsx(JroIndicator, { jro: jro }), _jsxs(Button, { type: "button", variant: "outline", size: "sm", className: cn('inline-flex items-center gap-2 rounded-xl border-surface-overlay-glass-border bg-surface-overlay-quiet px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-surface-overlay-strong', detailsOpen && 'bg-surface-overlay-strong text-foreground'), "aria-label": detailsOpen ? 'Ocultar detalhes do contato' : 'Mostrar detalhes do contato', onClick: () => handleDetails({}), children: [_jsx(PanelRightOpen, { className: "h-4 w-4", "aria-hidden": true }), _jsx("span", { className: "hidden sm:inline", children: "Detalhes" })] })] }), _jsxs("div", { className: cn('flex flex-wrap items-center gap-1.5', 'md:col-span-2 md:justify-self-end', 'lg:col-span-3 lg:justify-self-end lg:flex-nowrap'), children: [_jsx(PrimaryActionButton, { action: primaryAction, jroState: jro?.state, onExecute: onPrimaryAction, disabled: !primaryAction }), _jsx(AiModeControlMenu, { ticket: ticket, aiMode: aiMode, aiConfidence: aiConfidence, onAiModeChange: onAiModeChange, onTakeOver: onTakeOver, onGiveBackToAi: onGiveBackToAi, aiModeChangeDisabled: aiModeChangeDisabled, className: "h-9" }), _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsxs(Button, { ref: aiHelpButtonRef, type: "button", variant: "outline", size: "sm", className: "inline-flex items-center gap-2 rounded-full border-surface-overlay-glass-border bg-surface-overlay-quiet px-3 text-xs font-semibold text-foreground transition hover:bg-surface-overlay-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-inbox-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-shell)]", disabled: aiHelpDisabled || aiHelpLoading, onClick: handleAskAiHelp, "aria-disabled": aiHelpDisabled || aiHelpLoading, "aria-label": "Solicitar sugest\u00E3o da IA", children: [aiHelpLoading ? (_jsx("span", { className: "size-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" })) : (_jsx(Sparkles, { className: "h-3.5 w-3.5", "aria-hidden": true })), _jsx("span", { className: "hidden sm:inline", children: "Sugest\u00E3o IA" })] }) }), _jsxs(TooltipContent, { side: "bottom", sideOffset: 6, children: ["Sugest\u00E3o da IA ", askAiAction?.shortcutDisplay ? `(${askAiAction.shortcutDisplay})` : ''] })] }), _jsx(CommandBar, { context: commandContext, className: "w-auto shrink-0 flex-nowrap gap-1 border-none bg-transparent p-0 shadow-none" }), _jsx("div", { className: "ml-auto flex w-full justify-end lg:w-auto", children: _jsx(TypingIndicator, { agents: typingAgents }) })] })] }) }));
};
export { PrimaryActionBanner as default, PrimaryActionButton, TypingIndicator, JroIndicator, Indicator };
