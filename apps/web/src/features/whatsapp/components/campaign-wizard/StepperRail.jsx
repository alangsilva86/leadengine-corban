import { Check } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { cn } from '@/lib/utils.js';

import { STEP_BLOCKED_REASON, STEP_SEQUENCE } from './constants.js';

/**
 * Trilho de etapas do assistente. Etapas bloqueadas ficam realmente desabilitadas
 * (não só "aria-disabled") e a etapa atual usa aria-current="step".
 */
const StepperRail = ({ stepStatuses, onSelectStep }) => (
  <nav aria-label="Etapas da regra" className="border-b border-border bg-surface px-4 py-3 sm:px-6">
    <ol className="flex items-center gap-1 overflow-x-auto sm:gap-2">
      {STEP_SEQUENCE.map((step, index) => {
        const status = stepStatuses[step.key];
        const isCurrent = status === 'current';
        const isCompleted = status === 'completed';
        const isBlocked = status === 'blocked';

        const button = (
          <button
            type="button"
            onClick={() => onSelectStep(index)}
            disabled={isBlocked}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isCurrent ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground hover:bg-surface-hover',
              isBlocked && 'cursor-not-allowed text-subtle-foreground hover:bg-transparent',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                isCurrent && 'bg-primary text-primary-foreground',
                isCompleted && 'bg-success-soft text-success-soft-foreground',
                !isCurrent && !isCompleted && 'bg-surface-sunken text-muted-foreground',
              )}
            >
              {isCompleted ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span className={cn('font-medium', !isCurrent && 'hidden md:inline')}>{step.title}</span>
            <span className="sr-only">
              {isCompleted ? '(concluída)' : isBlocked ? '(bloqueada)' : ''}
            </span>
          </button>
        );

        return (
          <li key={step.key} className="flex shrink-0 items-center gap-1 sm:gap-2">
            {isBlocked ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="rounded-md">
                    {button}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">{STEP_BLOCKED_REASON[step.key]}</TooltipContent>
              </Tooltip>
            ) : (
              button
            )}
            {index < STEP_SEQUENCE.length - 1 ? (
              <span aria-hidden="true" className="h-px w-3 bg-border sm:w-6" />
            ) : null}
          </li>
        );
      })}
    </ol>
  </nav>
);

export default StepperRail;
