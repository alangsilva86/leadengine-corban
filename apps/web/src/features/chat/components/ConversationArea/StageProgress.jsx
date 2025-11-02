import { Fragment, useMemo } from 'react';
import { cn } from '@/lib/utils.js';
import {
  STAGE_LABELS,
  STAGE_PRESENTATION,
  formatStageLabel,
  normalizeStage,
} from './utils/stage.js';

const STAGE_SEQUENCE = Object.keys(STAGE_LABELS).filter((key) => key !== 'DESCONHECIDO');

const ACTIVE_STEP_TONE = {
  info: 'border-[color:var(--accent-inbox-primary)] bg-[color:color-mix(in_srgb,var(--accent-inbox-primary)_14%,transparent)] text-[color:var(--accent-inbox-primary)]',
  warning: 'border-warning-soft-border bg-warning-soft text-warning-strong',
  success: 'border-success-soft-border bg-success-soft text-success-strong',
  neutral: 'border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground',
};

const ACTIVE_ICON_TONE = {
  info: 'border-[color:var(--accent-inbox-primary)] bg-[color:var(--accent-inbox-primary)] text-white',
  warning: 'border-warning-soft-border bg-warning-soft text-warning-strong',
  success: 'border-success-soft-border bg-success-soft text-success-strong',
  neutral: 'border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground',
};

const UPCOMING_STEP_CLASSES =
  'border border-dashed border-surface-overlay-glass-border bg-transparent text-foreground-muted';
const UPCOMING_ICON_CLASSES =
  'border border-surface-overlay-glass-border bg-surface-overlay-quiet text-foreground-muted';

const buildSteps = (stageKey) => {
  const normalized = normalizeStage(stageKey);
  const knownIndex = STAGE_SEQUENCE.indexOf(normalized);

  if (knownIndex === -1) {
    const presentation = STAGE_PRESENTATION[normalized] ?? STAGE_PRESENTATION.DESCONHECIDO;
    const label = formatStageLabel(normalized);
    return [
      {
        stageKey: normalized,
        label,
        Icon: presentation.icon,
        tone: presentation.tone ?? 'neutral',
        isActive: true,
      },
    ];
  }

  return STAGE_SEQUENCE.slice(knownIndex).map((key, index) => {
    const presentation = STAGE_PRESENTATION[key] ?? STAGE_PRESENTATION.DESCONHECIDO;
    return {
      stageKey: key,
      label: formatStageLabel(key),
      Icon: presentation.icon,
      tone: presentation.tone ?? 'neutral',
      isActive: index === 0,
    };
  });
};

const StageProgress = ({ currentStage, className }) => {
  const steps = useMemo(() => buildSteps(currentStage), [currentStage]);

  if (!steps.length) {
    return null;
  }

  return (
    <div className={cn('w-full', className)}>
      <ol className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-4 sm:overflow-x-auto">
        {steps.map((step, index) => {
          const { stageKey, label, Icon, tone, isActive } = step;
          const stepToneClasses = isActive ? ACTIVE_STEP_TONE[tone] ?? ACTIVE_STEP_TONE.neutral : UPCOMING_STEP_CLASSES;
          const iconToneClasses = isActive ? ACTIVE_ICON_TONE[tone] ?? ACTIVE_ICON_TONE.neutral : UPCOMING_ICON_CLASSES;
          const accessibilityLabel = `${isActive ? 'Etapa atual' : 'Próxima etapa'}: ${label}`;

          return (
            <Fragment key={stageKey}>
              <li className="flex min-w-0">
                <div
                  role="group"
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={accessibilityLabel}
                  data-stage-key={stageKey}
                  className={cn(
                    'flex min-w-[200px] flex-1 items-start gap-3 rounded-xl border px-3 py-2 shadow-[var(--shadow-xs)] transition-colors sm:min-w-[180px] lg:min-w-0',
                    stepToneClasses,
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm',
                      iconToneClasses,
                    )}
                    aria-hidden
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className={cn('truncate text-sm font-semibold', isActive ? 'text-inherit' : 'text-foreground')}>
                      {label}
                    </p>
                    <p className="text-xs text-foreground-muted">
                      {isActive ? 'Você está aqui' : 'Próxima etapa do funil'}
                    </p>
                  </div>
                </div>
              </li>
              {index < steps.length - 1 ? (
                <div
                  className="hidden items-center sm:flex sm:h-full sm:w-8 sm:shrink-0 sm:justify-center"
                  aria-hidden
                >
                  <div className="h-px w-full rounded-full bg-surface-overlay-glass-border" />
                </div>
              ) : null}
            </Fragment>
          );
        })}
      </ol>
    </div>
  );
};

export default StageProgress;
export { STAGE_SEQUENCE };
