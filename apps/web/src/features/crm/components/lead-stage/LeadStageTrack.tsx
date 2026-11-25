import { cn } from '@/lib/utils.js';
import {
  LEAD_PIPELINE_STAGES,
  LEAD_STAGE_DEFINITIONS,
  LEAD_STAGE_TONE_CLASSES,
  normalizeLeadStage,
} from '../../utils/lead-stage';

type LeadStageTrackProps = {
  stage: unknown;
  className?: string;
};

/**
 * Trilho compacto do funil (7 segmentos). Etapas concluídas ficam preenchidas;
 * nas saídas o trilho inteiro assume o tom da saída (Ganho, Perdido, Reciclar).
 */
const LeadStageTrack = ({ stage, className }: LeadStageTrackProps) => {
  const current = normalizeLeadStage(stage);
  const definition = LEAD_STAGE_DEFINITIONS[current];
  const total = LEAD_PIPELINE_STAGES.length;
  const label = definition.exit
    ? `Saída do funil: ${definition.label}`
    : `Etapa ${definition.order} de ${total}: ${definition.label}`;
  const exitFill = definition.exit ? LEAD_STAGE_TONE_CLASSES[definition.tone].dot : null;

  return (
    <div role="img" aria-label={label} title={label} className={cn('flex w-full gap-1', className)}>
      {LEAD_PIPELINE_STAGES.map((step) => {
        const order = LEAD_STAGE_DEFINITIONS[step].order;
        const filled = exitFill ? true : order <= definition.order;
        return (
          <span
            key={step}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              filled ? exitFill ?? 'bg-primary' : 'bg-surface-sunken',
              exitFill && definition.id !== 'ganho' && 'opacity-60',
              !exitFill && step === current && 'ring-2 ring-primary/25'
            )}
          />
        );
      })}
    </div>
  );
};

export default LeadStageTrack;
