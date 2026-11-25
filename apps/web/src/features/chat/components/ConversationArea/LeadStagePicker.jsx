import { Check, Loader2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import {
  LEAD_STAGE_DEFINITIONS,
  LEAD_STAGE_ICONS,
  LEAD_STAGE_TONE_CLASSES,
  getLeadStageOptions,
  normalizeLeadStage,
} from '@/features/crm/utils/lead-stage';

const STATUS_TEXT = {
  done: 'Concluída',
  current: 'Etapa atual',
  next: null,
};

/** Passo do funil: marcador (concluído ✓ / atual / próximo) + rótulo, ligado ao próximo por um trilho. */
const PipelineStep = ({ option, status, isLast, disabled, pending, onSelect }) => {
  const Icon = LEAD_STAGE_ICONS[option.id];
  const statusText = STATUS_TEXT[status];
  const isCurrent = status === 'current';

  return (
    <li className="relative">
      {!isLast ? (
        <span
          aria-hidden
          className={cn(
            'absolute left-[15px] top-8 h-[calc(100%-1.625rem)] w-px',
            status === 'done' ? 'bg-primary/40' : 'bg-border',
          )}
        />
      ) : null}
      <button
        type="button"
        data-stage={option.id}
        aria-current={isCurrent ? 'step' : undefined}
        aria-label={`${option.label}${statusText ? ` (${statusText.toLowerCase()})` : ''}`}
        title={option.reason ?? option.description}
        disabled={disabled || isCurrent}
        onClick={() => onSelect?.(option.id)}
        className={cn(
          'group relative flex w-full items-center gap-2.5 rounded-md py-1 pl-0.5 pr-2 text-left transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          !disabled && !isCurrent && 'hover:bg-surface-hover',
          disabled && !isCurrent && 'cursor-not-allowed opacity-50',
          isCurrent && 'cursor-default',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors',
            status === 'done' && 'border-transparent bg-primary-soft text-primary-soft-foreground',
            isCurrent && 'border-primary bg-primary text-primary-foreground shadow-xs',
            status === 'next' && 'border-border bg-surface text-muted-foreground group-hover:border-border-strong group-hover:text-foreground',
          )}
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : status === 'done' ? (
            <Check className="size-3.5" />
          ) : (
            <Icon className="size-3.5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-sm', isCurrent ? 'font-semibold text-foreground' : 'text-foreground')}>
            {option.label}
          </span>
          {isCurrent ? <span className="line-clamp-2 text-xs text-muted-foreground">{option.description}</span> : null}
        </span>
        {isCurrent ? (
          <span className="shrink-0 rounded-full bg-primary-soft px-1.5 py-0.5 text-2xs font-medium text-primary-soft-foreground">
            Atual
          </span>
        ) : null}
      </button>
    </li>
  );
};

const ExitButton = ({ option, disabled, pending, onSelect }) => {
  const Icon = LEAD_STAGE_ICONS[option.id];
  const tone = LEAD_STAGE_TONE_CLASSES[option.tone];
  return (
    <button
      type="button"
      data-stage={option.id}
      aria-current={option.current ? 'step' : undefined}
      aria-label={`${option.label}${option.current ? ' (etapa atual)' : ''}`}
      title={option.reason ?? option.description}
      disabled={disabled || option.current}
      onClick={() => onSelect?.(option.id)}
      className={cn(
        'inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        option.current
          ? cn('border-transparent', tone.chip)
          : 'border-border bg-surface text-foreground hover:bg-surface-hover',
        disabled && !option.current && 'cursor-not-allowed opacity-50 hover:bg-surface',
      )}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Icon className={cn('size-3.5', !option.current && tone.text)} aria-hidden />}
      <span className="truncate">{option.label}</span>
    </button>
  );
};

/**
 * Seletor da etapa do lead no Inbox: as 7 etapas do funil como progresso vertical e,
 * abaixo, as saídas (Ganho, Perdido, Reciclar). Transições que o contrato proíbe ficam
 * desabilitadas, com o motivo explicado no rodapé.
 */
const LeadStagePicker = ({ stage, onChange, pendingStage = null, disabled = false, className }) => {
  const current = normalizeLeadStage(stage);
  const currentDefinition = LEAD_STAGE_DEFINITIONS[current];
  const options = getLeadStageOptions(current);
  const pipeline = options.filter((option) => !option.exit);
  const exits = options.filter((option) => option.exit);
  const blockedReason = options.find((option) => option.disabled)?.reason ?? null;
  const busy = Boolean(pendingStage);
  const canChange = typeof onChange === 'function' && !disabled;

  const statusFor = (option) => {
    if (option.current) return 'current';
    if (!currentDefinition.exit && option.id !== current && LEAD_STAGE_DEFINITIONS[option.id].order < currentDefinition.order) {
      return 'done';
    }
    return 'next';
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <ol aria-label="Etapas do funil" className="flex flex-col gap-0.5">
        {pipeline.map((option, index) => (
          <PipelineStep
            key={option.id}
            option={option}
            status={statusFor(option)}
            isLast={index === pipeline.length - 1}
            disabled={!canChange || option.disabled || busy}
            pending={pendingStage === option.id}
            onSelect={onChange}
          />
        ))}
      </ol>
      <div className="flex flex-col gap-1.5 border-t border-border pt-3">
        <p className="text-xs font-medium text-muted-foreground">Saídas do funil</p>
        <div className="flex gap-1.5" role="group" aria-label="Saídas do funil">
          {exits.map((option) => (
            <ExitButton
              key={option.id}
              option={option}
              disabled={!canChange || option.disabled || busy}
              pending={pendingStage === option.id}
              onSelect={onChange}
            />
          ))}
        </div>
      </div>
      {blockedReason ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
          {blockedReason}
        </p>
      ) : null}
    </div>
  );
};

export default LeadStagePicker;
