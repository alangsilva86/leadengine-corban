import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils.js';
import { getLeadStagePresentation } from '../../utils/lead-stage';

type LeadStageBadgeProps = {
  /** Etapa do lead (id do contrato; valores antigos são normalizados). */
  stage: unknown;
  className?: string;
  /** Mostra o ponto do tom antes do rótulo (padrão: sim). */
  withDot?: boolean;
};

/** Chip da etapa do lead — o mesmo em Inbox, CRM, Contatos e Oportunidades. */
const LeadStageBadge = ({ stage, className, withDot = true }: LeadStageBadgeProps) => {
  const presentation = getLeadStagePresentation(stage);
  return (
    <Badge variant={presentation.classes.badge} className={cn('gap-1.5', className)} title={presentation.description}>
      {withDot ? <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', presentation.classes.dot)} /> : null}
      {presentation.label}
    </Badge>
  );
};

export default LeadStageBadge;
